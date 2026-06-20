using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.IdentityModel.Tokens;
using RecrutaBot.Api.Auth;
using RecrutaBot.Api.Models;
using RecrutaBot.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

const long MaxUpload = 20L * 1024 * 1024; // 20 MB

// ---- required configuration (secrets come from environment) ----
var supabaseUrl = (cfg["SUPABASE_URL"] ?? throw new InvalidOperationException("SUPABASE_URL not set")).TrimEnd('/');
var allowedOrigin = cfg["ALLOWED_ORIGIN"] ?? "http://localhost:5173"; // GitHub Pages origin in prod
var jwtSecret = cfg["SUPABASE_JWT_SECRET"]; // optional HS256 legacy fallback

// ---- services ----
builder.Services.AddHttpClient<SupabaseClient>();
builder.Services.AddHttpClient<AnthropicClient>();
builder.Services.AddSingleton<TextExtractor>();
builder.Services.AddSingleton<DocxGenerator>();
builder.Services.AddHostedService<JobProcessor>();

// JWKS holder for Supabase JWT validation
var jwks = new SupabaseJwks(new HttpClient(), supabaseUrl);

builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = MaxUpload);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = MaxUpload);

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(allowedOrigin.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    .WithMethods("GET", "POST", "OPTIONS")
    .WithHeaders("Authorization", "Content-Type")));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // keep the raw "sub" claim
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"{supabaseUrl}/auth/v1",
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
        };
        if (!string.IsNullOrWhiteSpace(jwtSecret))
        {
            // Legacy HS256 projects: validate with the shared JWT secret.
            options.TokenValidationParameters.IssuerSigningKey =
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
        }
        else
        {
            // Default: asymmetric keys discovered from the project's JWKS endpoint.
            options.TokenValidationParameters.IssuerSigningKeyResolver =
                (_, _, kid, _) => jwks.ResolveKeys(kid);
        }
    });
builder.Services.AddAuthorization();

var app = builder.Build();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

static Guid UserId(ClaimsPrincipal user)
{
    var sub = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
    return Guid.TryParse(sub, out var id) ? id : throw new InvalidOperationException("invalid sub claim");
}

// ---- health ----
app.MapGet("/health", () => Results.Ok(new { ok = true }));

// ---- POST /api/parse : upload CV -> queue parse job -> 202 { jobId } ----
app.MapPost("/api/parse", async (HttpRequest req, SupabaseClient supabase, ClaimsPrincipal user, CancellationToken ct) =>
{
    if (!req.HasFormContentType) return Results.BadRequest(new { error = "multipart/form-data esperado" });
    var form = await req.ReadFormAsync(ct);
    var file = form.Files["file"];
    if (file is null || file.Length == 0) return Results.BadRequest(new { error = "arquivo ausente" });
    if (file.Length > MaxUpload) return Results.BadRequest(new { error = "arquivo acima de 20 MB" });

    var name = file.FileName ?? "cv";
    var lower = name.ToLowerInvariant();
    if (!lower.EndsWith(".pdf") && !lower.EndsWith(".docx"))
        return Results.BadRequest(new { error = "apenas PDF ou DOCX são aceitos" });

    var userId = UserId(user);
    byte[] bytes;
    using (var ms = new MemoryStream())
    {
        await file.CopyToAsync(ms, ct);
        bytes = ms.ToArray();
    }

    // Upload the raw file first so the processor can find it, then queue the job.
    var ext = lower.EndsWith(".pdf") ? ".pdf" : ".docx";
    var storagePath = $"uploads/{userId}/{Guid.NewGuid()}{ext}";
    var contentType = ext == ".pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    await supabase.UploadAsync(storagePath, bytes, contentType, ct);

    var jobId = await supabase.CreateJobAsync(userId, JobType.Parse,
        new { fileName = name, storagePath }, ct);

    return Results.Accepted($"/api/jobs/{jobId}", new { jobId });
}).RequireAuthorization();

// ---- POST /api/generate : reviewed JSON -> queue generate job -> 202 { jobId } ----
app.MapPost("/api/generate", async (CandidateModel data, SupabaseClient supabase, ClaimsPrincipal user, CancellationToken ct) =>
{
    var userId = UserId(user);
    var jobId = await supabase.CreateJobAsync(userId, JobType.Generate, data, ct);
    return Results.Accepted($"/api/jobs/{jobId}", new { jobId });
}).RequireAuthorization();

// ---- GET /api/jobs/{id} : polling fallback (RLS-equivalent: scoped to the user) ----
app.MapGet("/api/jobs/{id:guid}", async (Guid id, SupabaseClient supabase, ClaimsPrincipal user, CancellationToken ct) =>
{
    var job = await supabase.GetJobAsync(id, UserId(user), ct);
    return job is null ? Results.NotFound() : Results.Ok(job);
}).RequireAuthorization();

app.Run();

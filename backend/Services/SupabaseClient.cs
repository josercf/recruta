using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using RecrutaBot.Api.Models;

namespace RecrutaBot.Api.Services;

/// <summary>
/// Server-side Supabase access using the SERVICE ROLE key (bypasses RLS).
/// Talks to PostgREST (`/rest/v1`) for the `jobs` table and to the Storage API
/// (`/storage/v1`) for the private bucket. This key must never reach the client.
/// </summary>
public sealed class SupabaseClient
{
    private readonly HttpClient _http;
    private readonly string _url;
    private readonly string _bucket;
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    public SupabaseClient(HttpClient http, IConfiguration cfg)
    {
        _url = (cfg["SUPABASE_URL"] ?? throw new InvalidOperationException("SUPABASE_URL not set")).TrimEnd('/');
        var key = cfg["SUPABASE_SERVICE_ROLE_KEY"] ?? throw new InvalidOperationException("SUPABASE_SERVICE_ROLE_KEY not set");
        _bucket = cfg["SUPABASE_BUCKET"] ?? "cvs";
        _http = http;
        _http.DefaultRequestHeaders.Add("apikey", key);
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
    }

    public string Bucket => _bucket;

    // ---------------- jobs (PostgREST) ----------------

    public async Task<Guid> CreateJobAsync(Guid userId, string type, object input, CancellationToken ct)
    {
        var body = new[]
        {
            new Dictionary<string, object?>
            {
                ["user_id"] = userId,
                ["type"] = type,
                ["status"] = JobStatus.Queued,
                ["input"] = input,
            }
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_url}/rest/v1/jobs")
        {
            Content = JsonContent(body),
        };
        req.Headers.Add("Prefer", "return=representation");
        using var res = await _http.SendAsync(req, ct);
        await EnsureOk(res, "create job");
        var rows = await res.Content.ReadFromJsonAsync<List<Job>>(Json, ct);
        return rows![0].Id;
    }

    /// <summary>Atomically claim the oldest queued job (queued -> processing).</summary>
    public async Task<Job?> ClaimNextQueuedAsync(CancellationToken ct)
    {
        // pick the oldest queued id
        using var sel = await _http.GetAsync(
            $"{_url}/rest/v1/jobs?status=eq.{JobStatus.Queued}&order=created_at.asc&limit=1&select=id", ct);
        await EnsureOk(sel, "select queued");
        var ids = await sel.Content.ReadFromJsonAsync<List<Job>>(Json, ct);
        if (ids is null || ids.Count == 0) return null;
        var id = ids[0].Id;

        // claim it guarded by status=queued (returns the row only if we won the race)
        using var req = new HttpRequestMessage(HttpMethod.Patch,
            $"{_url}/rest/v1/jobs?id=eq.{id}&status=eq.{JobStatus.Queued}")
        {
            Content = JsonContent(new Dictionary<string, object?>
            {
                ["status"] = JobStatus.Processing,
                ["updated_at"] = DateTimeOffset.UtcNow,
            }),
        };
        req.Headers.Add("Prefer", "return=representation");
        using var res = await _http.SendAsync(req, ct);
        await EnsureOk(res, "claim job");
        var rows = await res.Content.ReadFromJsonAsync<List<Job>>(Json, ct);
        return rows is { Count: > 0 } ? rows[0] : null;
    }

    public async Task UpdateJobAsync(Guid id, IDictionary<string, object?> fields, CancellationToken ct)
    {
        fields["updated_at"] = DateTimeOffset.UtcNow;
        using var req = new HttpRequestMessage(HttpMethod.Patch, $"{_url}/rest/v1/jobs?id=eq.{id}")
        {
            Content = JsonContent(fields),
        };
        using var res = await _http.SendAsync(req, ct);
        await EnsureOk(res, "update job");
    }

    public async Task<Job?> GetJobAsync(Guid id, Guid userId, CancellationToken ct)
    {
        using var res = await _http.GetAsync(
            $"{_url}/rest/v1/jobs?id=eq.{id}&user_id=eq.{userId}&limit=1", ct);
        await EnsureOk(res, "get job");
        var rows = await res.Content.ReadFromJsonAsync<List<Job>>(Json, ct);
        return rows is { Count: > 0 } ? rows[0] : null;
    }

    // ---------------- storage ----------------

    public async Task UploadAsync(string path, byte[] bytes, string contentType, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_url}/storage/v1/object/{_bucket}/{path}")
        {
            Content = new ByteArrayContent(bytes),
        };
        req.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        req.Headers.Add("x-upsert", "true");
        using var res = await _http.SendAsync(req, ct);
        await EnsureOk(res, "storage upload");
    }

    public async Task<byte[]> DownloadAsync(string path, CancellationToken ct)
    {
        using var res = await _http.GetAsync($"{_url}/storage/v1/object/{_bucket}/{path}", ct);
        await EnsureOk(res, "storage download");
        return await res.Content.ReadAsByteArrayAsync(ct);
    }

    public async Task DeleteAsync(string path, CancellationToken ct)
    {
        using var res = await _http.DeleteAsync($"{_url}/storage/v1/object/{_bucket}/{path}", ct);
        if (res.StatusCode != HttpStatusCode.OK && res.StatusCode != HttpStatusCode.NotFound)
            await EnsureOk(res, "storage delete");
    }

    /// <summary>Create a time-limited signed download URL (absolute).</summary>
    public async Task<string> CreateSignedUrlAsync(string path, int expiresInSeconds, CancellationToken ct)
    {
        using var res = await _http.PostAsync(
            $"{_url}/storage/v1/object/sign/{_bucket}/{path}",
            JsonContent(new { expiresIn = expiresInSeconds }), ct);
        await EnsureOk(res, "sign url");
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        var signed = doc.RootElement.GetProperty("signedURL").GetString()!;
        // PostgREST returns a path relative to /storage/v1
        return $"{_url}/storage/v1{signed}";
    }

    // ---------------- helpers ----------------

    private static StringContent JsonContent(object o) =>
        new(JsonSerializer.Serialize(o, Json), Encoding.UTF8, "application/json");

    private static async Task EnsureOk(HttpResponseMessage res, string what)
    {
        if (res.IsSuccessStatusCode) return;
        var body = await res.Content.ReadAsStringAsync();
        throw new HttpRequestException($"Supabase {what} failed ({(int)res.StatusCode}): {body}");
    }
}

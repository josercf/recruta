using System.Text.Json;
using RecrutaBot.Api.Models;

namespace RecrutaBot.Api.Services;

/// <summary>
/// BackgroundService (IHostedService) that drains the persisted `jobs` table.
/// Jobs survive restarts because they live in Postgres, not in memory — on
/// boot we just resume claiming queued rows. No `Task.Run`, no in-memory queue.
/// </summary>
public sealed class JobProcessor : BackgroundService
{
    private readonly SupabaseClient _supabase;
    private readonly TextExtractor _extractor;
    private readonly AnthropicClient _ai;
    private readonly DocxGenerator _docx;
    private readonly ILogger<JobProcessor> _log;
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(2);

    public JobProcessor(SupabaseClient supabase, TextExtractor extractor, AnthropicClient ai,
        DocxGenerator docx, ILogger<JobProcessor> log)
    {
        _supabase = supabase; _extractor = extractor; _ai = ai; _docx = docx; _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _log.LogInformation("JobProcessor started.");
        while (!ct.IsCancellationRequested)
        {
            Job? job = null;
            try
            {
                job = await _supabase.ClaimNextQueuedAsync(ct);
            }
            catch (Exception e)
            {
                _log.LogError(e, "Failed to claim job");
            }

            if (job is null)
            {
                try { await Task.Delay(IdleDelay, ct); } catch (TaskCanceledException) { }
                continue;
            }

            try
            {
                if (job.Type == JobType.Parse) await ProcessParseAsync(job, ct);
                else if (job.Type == JobType.Generate) await ProcessGenerateAsync(job, ct);
                else await Fail(job, $"tipo de job desconhecido: {job.Type}", ct);
            }
            catch (ScannedPdfException e)
            {
                await Fail(job, e.Message, ct);
            }
            catch (Exception e)
            {
                _log.LogError(e, "Job {Id} failed", job.Id);
                await Fail(job, e.Message, ct);
            }
        }
    }

    // ---- parse: storage file -> text -> AI -> JSON result; then discard upload (LGPD) ----
    private async Task ProcessParseAsync(Job job, CancellationToken ct)
    {
        var input = job.Input ?? throw new InvalidOperationException("parse job sem input");
        var storagePath = input.GetProperty("storagePath").GetString()!;
        var fileName = input.TryGetProperty("fileName", out var fn) ? fn.GetString() ?? "" : "";

        var bytes = await _supabase.DownloadAsync(storagePath, ct);
        var text = _extractor.Extract(bytes, fileName);          // throws ScannedPdfException if no text
        var model = await _ai.ExtractAsync(text, ct);

        var resultJson = JsonSerializer.SerializeToElement(model);
        await _supabase.UpdateJobAsync(job.Id, new Dictionary<string, object?>
        {
            ["status"] = JobStatus.Parsed,
            ["result"] = resultJson,
            ["error"] = null,
        }, ct);

        // Retention policy: the candidate's raw upload is deleted right after parsing.
        try { await _supabase.DeleteAsync(storagePath, ct); }
        catch (Exception e) { _log.LogWarning(e, "Could not delete upload {Path}", storagePath); }
    }

    // ---- generate: JSON -> DOCX -> storage -> signed URL ----
    private async Task ProcessGenerateAsync(Job job, CancellationToken ct)
    {
        var input = job.Input ?? throw new InvalidOperationException("generate job sem input");
        var model = input.Deserialize<CandidateModel>(new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                    ?? new CandidateModel();

        var docx = _docx.Generate(model);
        var path = $"generated/{job.UserId}/{job.Id}.docx";
        await _supabase.UploadAsync(path, docx,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ct);
        var url = await _supabase.CreateSignedUrlAsync(path, 3600, ct);

        await _supabase.UpdateJobAsync(job.Id, new Dictionary<string, object?>
        {
            ["status"] = JobStatus.Done,
            ["docx_url"] = url,
            ["error"] = null,
        }, ct);
    }

    private async Task Fail(Job job, string message, CancellationToken ct)
    {
        try
        {
            await _supabase.UpdateJobAsync(job.Id, new Dictionary<string, object?>
            {
                ["status"] = JobStatus.Error,
                ["error"] = message,
            }, ct);
        }
        catch (Exception e) { _log.LogError(e, "Could not mark job {Id} as error", job.Id); }
    }
}

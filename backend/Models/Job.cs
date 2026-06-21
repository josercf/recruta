using System.Text.Json;
using System.Text.Json.Serialization;

namespace RecrutaBot.Api.Models;

/// <summary>Row of the Supabase `jobs` table (PostgREST JSON, snake_case).</summary>
public sealed class Job
{
    [JsonPropertyName("id")] public Guid Id { get; set; }
    [JsonPropertyName("user_id")] public Guid UserId { get; set; }
    [JsonPropertyName("type")] public string Type { get; set; } = "";       // parse | generate
    [JsonPropertyName("status")] public string Status { get; set; } = "";   // queued|processing|parsed|done|error
    [JsonPropertyName("input")] public JsonElement? Input { get; set; }
    [JsonPropertyName("result")] public JsonElement? Result { get; set; }
    [JsonPropertyName("docx_url")] public string? DocxUrl { get; set; }
    [JsonPropertyName("error")] public string? Error { get; set; }
    [JsonPropertyName("created_at")] public DateTimeOffset? CreatedAt { get; set; }
    [JsonPropertyName("updated_at")] public DateTimeOffset? UpdatedAt { get; set; }
}

public static class JobStatus
{
    public const string Queued = "queued";
    public const string Processing = "processing";
    public const string Parsed = "parsed";
    public const string Done = "done";
    public const string Error = "error";
}

public static class JobType
{
    public const string Parse = "parse";
    public const string Generate = "generate";
}

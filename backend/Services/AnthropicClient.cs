using System.Text;
using System.Text.Json;
using RecrutaBot.Api.Models;

namespace RecrutaBot.Api.Services;

/// <summary>
/// Calls the Anthropic Messages API over HttpClient to structure raw CV text
/// into the candidate JSON schema. The model is parameterizable via the
/// ANTHROPIC_MODEL env var (defaults to a current Sonnet for the cost/quality
/// balance the brief asks for). The prompt forces JSON-only output and the
/// parser is defensive against stray markdown/prose.
/// </summary>
public sealed class AnthropicClient
{
    private readonly HttpClient _http;
    private readonly string _model;
    private readonly int _maxTokens;
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public AnthropicClient(HttpClient http, IConfiguration cfg)
    {
        var key = cfg["ANTHROPIC_API_KEY"] ?? throw new InvalidOperationException("ANTHROPIC_API_KEY not set");
        _model = cfg["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-6";
        _maxTokens = int.TryParse(cfg["ANTHROPIC_MAX_TOKENS"], out var m) ? m : 8192;
        _http = http;
        _http.BaseAddress = new Uri("https://api.anthropic.com/");
        _http.DefaultRequestHeaders.Add("x-api-key", key);
        _http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
    }

    public async Task<CandidateModel> ExtractAsync(string rawText, CancellationToken ct)
    {
        var text = (rawText ?? "").Length > 60000 ? rawText![..60000] : rawText ?? "";
        var prompt = BuildPrompt(text);

        var body = new
        {
            model = _model,
            max_tokens = _maxTokens,
            messages = new[] { new { role = "user", content = prompt } },
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "v1/messages")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
        };
        using var res = await _http.SendAsync(req, ct);
        var payload = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"Anthropic API failed ({(int)res.StatusCode}): {payload}");

        // Response: { "content": [ { "type": "text", "text": "..." }, ... ], ... }
        var sb = new StringBuilder();
        using (var doc = JsonDocument.Parse(payload))
        {
            if (doc.RootElement.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Array)
            {
                foreach (var block in content.EnumerateArray())
                {
                    if (block.TryGetProperty("type", out var t) && t.GetString() == "text" &&
                        block.TryGetProperty("text", out var txt))
                        sb.Append(txt.GetString());
                }
            }
        }

        var model = ParseCandidate(sb.ToString());
        model.SanitizeAsExtraction();
        return model;
    }

    private static string BuildPrompt(string text) =>
        $$"""
        Você é um assistente de recrutamento tech. Abaixo está o texto bruto de um currículo.
        Extraia as informações e responda SOMENTE com um objeto JSON válido — sem markdown,
        sem cercas de código, sem nenhum texto fora do JSON — exatamente neste formato:
        {
          "nome":"", "consultoria":"", "cidade":"", "nacionalidade":"", "telefone":"", "email":"",
          "segmento":"", "especialidade":"", "tempoExperiencia":"", "moduloExpertise":"", "tempoModulo":"",
          "proficiencia":"", "nivelIngles":"", "nivelEspanhol":"", "baseAtual":"", "disponibilidade":"",
          "qualificacao":"",
          "certificacoes":[],
          "experiencias":[{"empresa":"","cargo":"","periodo":"","local":"","atividades":""}],
          "formacao":""
        }
        Regras:
        - Preencha apenas com dados presentes no currículo; não invente nada.
        - "nome": nome completo. "cidade": cidade/UF. "nacionalidade": se mencionada.
        - "segmento" (ex: "Tecnologia da Informação – SAP"), "especialidade", "tempoExperiencia" (ex: "+15 anos"),
          "moduloExpertise", "tempoModulo", "proficiencia" (senioridade, ex: "Alta (Sênior)"),
          níveis de idioma (Básico/Intermediário/Avançado/Fluente). Deixe "" o que não houver.
        - "qualificacao": parágrafo de resumo profissional (use o resumo/objetivo do CV).
        - "certificacoes": lista de cursos/certificações técnicas (strings curtas).
        - "experiencias": TODAS as experiências, na ordem do documento; "atividades" resumidas em até 60 palavras
          mantendo termos técnicos; "local" = cidade/remoto se houver, senão "".
        - "formacao": formação acadêmica + certificações formais (texto, uma por linha).
        - NÃO inclua campos do processo de recrutamento (valores salariais, Accenture, referências, parecer):
          esses não existem no currículo e serão preenchidos manualmente pelo recrutador.
        Texto do currículo:
        """ + "\"\"\"" + text + "\"\"\"";

    /// <summary>Defensive JSON parse — strips code fences and slices to the outer braces.</summary>
    private static CandidateModel ParseCandidate(string raw)
    {
        var s = (raw ?? "").Trim();
        if (s.StartsWith("```"))
        {
            var nl = s.IndexOf('\n');
            if (nl >= 0) s = s[(nl + 1)..];
            if (s.EndsWith("```")) s = s[..^3];
            s = s.Trim();
        }
        int a = s.IndexOf('{'), b = s.LastIndexOf('}');
        if (a >= 0 && b > a) s = s.Substring(a, b - a + 1);
        try
        {
            return JsonSerializer.Deserialize<CandidateModel>(s, Json) ?? new CandidateModel();
        }
        catch (JsonException e)
        {
            throw new InvalidOperationException("A IA não retornou JSON válido: " + e.Message);
        }
    }
}

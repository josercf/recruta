using System.Text.Json.Serialization;

namespace RecrutaBot.Api.Models;

/// <summary>
/// Flat candidate model — the single contract shared by the Anthropic output,
/// the review form, POST /api/generate and the DocxTemplater placeholders.
///
/// Property names are intentionally lowercase/camelCase so they match BOTH:
///   - the incoming JSON keys (System.Text.Json, case-insensitive), and
///   - the template placeholders bound under prefix "c" (e.g. {{c.nome}},
///     {{#c.experiencias}}{{.empresa}}{{/c.experiencias}}).
/// </summary>
public sealed class CandidateModel
{
    // Header / contact (AI-filled)
    public string nome { get; set; } = "";
    public string consultoria { get; set; } = "Hays Consultoria";
    public string cidade { get; set; } = "";
    public string nacionalidade { get; set; } = "";
    public string telefone { get; set; } = "";
    public string email { get; set; } = "";

    // Perfil — técnico (AI-filled)
    public string segmento { get; set; } = "";
    public string especialidade { get; set; } = "";
    public string tempoExperiencia { get; set; } = "";
    public string moduloExpertise { get; set; } = "";
    public string tempoModulo { get; set; } = "";
    public string proficiencia { get; set; } = "";
    public string nivelIngles { get; set; } = "";
    public string nivelEspanhol { get; set; } = "";
    public string baseAtual { get; set; } = "";
    public string disponibilidade { get; set; } = "";

    // Perfil — comercial / Accenture (recruiter-only; AI must NOT invent these)
    public string valorRecursoCLT { get; set; } = "";
    public string valorConsultoriaCLT { get; set; } = "";
    public string exAccenture { get; set; } = "";
    public string atuouAccenture { get; set; } = "";
    public string disponibilidadeAgendas { get; set; } = "";

    // Body
    public string qualificacao { get; set; } = "";
    public List<string> certificacoes { get; set; } = new();
    public List<ExperienciaModel> experiencias { get; set; } = new();
    public string referencias { get; set; } = "";          // recruiter-only
    public string formacao { get; set; } = "";             // AI-filled (single field)
    public string parecer { get; set; } = "";              // recruiter-only

    /// <summary>Fields the AI must never fabricate; blanked after extraction.</summary>
    [JsonIgnore]
    public static readonly string[] RecruiterOnlyFields =
    {
        "valorRecursoCLT", "valorConsultoriaCLT", "exAccenture",
        "atuouAccenture", "disponibilidadeAgendas", "referencias", "parecer"
    };

    /// <summary>Normalize after AI extraction: enforce defaults and clear
    /// recruiter-only fields so the AI never leaks invented values.</summary>
    public void SanitizeAsExtraction()
    {
        if (string.IsNullOrWhiteSpace(consultoria)) consultoria = "Hays Consultoria";
        valorRecursoCLT = valorConsultoriaCLT = exAccenture = atuouAccenture =
            disponibilidadeAgendas = referencias = parecer = "";
        certificacoes ??= new();
        experiencias ??= new();
        foreach (var e in experiencias) e.Sanitize();
    }
}

public sealed class ExperienciaModel
{
    public string empresa { get; set; } = "";
    public string cargo { get; set; } = "";
    public string periodo { get; set; } = "";
    public string local { get; set; } = "";
    public string atividades { get; set; } = "";

    public void Sanitize()
    {
        empresa ??= ""; cargo ??= ""; periodo ??= ""; local ??= ""; atividades ??= "";
    }
}

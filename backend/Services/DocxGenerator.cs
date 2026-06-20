using DocxTemplater;
using RecrutaBot.Api.Models;

namespace RecrutaBot.Api.Services;

/// <summary>
/// Fills the marked Hays template with the candidate data using
/// Amberg/DocxTemplater. The model is bound under the prefix "c", so the
/// template placeholders are {{c.nome}}, {{#c.experiencias}}{{.empresa}}...,
/// {{#c.certificacoes}}{{.}}{{/c.certificacoes}}, etc. Output is byte-faithful
/// to the original Hays model — only the values change.
/// </summary>
public sealed class DocxGenerator
{
    private readonly byte[] _template;

    public DocxGenerator(IConfiguration cfg, IWebHostEnvironment env)
    {
        var path = cfg["TEMPLATE_PATH"]
                   ?? Path.Combine(AppContext.BaseDirectory, "Templates", "Hays_Template_marked.docx");
        if (!File.Exists(path))
            throw new FileNotFoundException($"Marked template not found at {path}");
        // Read once into memory; each generation works on a fresh stream copy.
        _template = File.ReadAllBytes(path);
    }

    public byte[] Generate(CandidateModel model)
    {
        using var input = new MemoryStream(_template, writable: false);
        var template = new DocxTemplate(input);
        template.BindModel("c", model);
        using var result = template.Process();
        using var output = new MemoryStream();
        result.Position = 0;
        result.CopyTo(output);
        return output.ToArray();
    }
}

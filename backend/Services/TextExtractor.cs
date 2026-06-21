using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

namespace RecrutaBot.Api.Services;

/// <summary>Raised when a PDF has no extractable text (likely a scan). No OCR in v0.</summary>
public sealed class ScannedPdfException : Exception
{
    public ScannedPdfException()
        : base("Este PDF parece digitalizado. OCR não é suportado nesta versão.") { }
}

public sealed class TextExtractor
{
    // Below this many non-whitespace characters we treat a PDF as a scan.
    private const int MinChars = 20;

    public string Extract(byte[] bytes, string fileName)
    {
        var lower = (fileName ?? "").ToLowerInvariant();
        if (lower.EndsWith(".pdf")) return ExtractPdf(bytes);
        if (lower.EndsWith(".docx")) return ExtractDocx(bytes);
        // Unknown extension: try DOCX, then PDF.
        try { return ExtractDocx(bytes); }
        catch { return ExtractPdf(bytes); }
    }

    private static string ExtractPdf(byte[] bytes)
    {
        var sb = new StringBuilder();
        using (var doc = PdfDocument.Open(bytes))
        {
            foreach (var page in doc.GetPages())
            {
                // ContentOrderTextExtractor keeps reading order better than page.Text.
                var text = ContentOrderTextExtractor.GetText(page);
                if (!string.IsNullOrWhiteSpace(text)) sb.AppendLine(text);
            }
        }
        var result = sb.ToString();
        var meaningful = result.Count(c => !char.IsWhiteSpace(c));
        if (meaningful < MinChars) throw new ScannedPdfException();
        return result;
    }

    private static string ExtractDocx(byte[] bytes)
    {
        using var ms = new MemoryStream(bytes);
        using var doc = WordprocessingDocument.Open(ms, false);
        var body = doc.MainDocumentPart?.Document?.Body;
        if (body is null) return "";
        var sb = new StringBuilder();
        foreach (var p in body.Descendants<Paragraph>())
        {
            sb.AppendLine(p.InnerText);
        }
        return sb.ToString();
    }
}

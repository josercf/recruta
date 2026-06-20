/* RecrutaBot — file text extraction (PDF via pdf.js, DOCX via inline unzip) */
(function () {
  async function inflateRaw(u8) {
    const ds = new DecompressionStream("deflate-raw");
    const w = ds.writable.getWriter();
    w.write(u8);
    w.close();
    const ab = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(ab);
  }

  // Minimal unzip: returns map name -> Uint8Array (handles stored + deflate-raw)
  async function unzip(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const u16 = (o) => dv.getUint16(o, true);
    const u32 = (o) => dv.getUint32(o, true);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (u32(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("EOCD não encontrado");
    const count = u16(eocd + 10);
    let p = u32(eocd + 16);
    const dec = new TextDecoder();
    const out = {};
    for (let i = 0; i < count; i++) {
      const method = u16(p + 10);
      const compSize = u32(p + 20);
      const nameLen = u16(p + 28);
      const extraLen = u16(p + 30);
      const commentLen = u16(p + 32);
      const localOffset = u32(p + 42);
      const name = dec.decode(bytes.slice(p + 46, p + 46 + nameLen));
      const lNameLen = u16(localOffset + 26);
      const lExtraLen = u16(localOffset + 28);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const data = bytes.slice(dataStart, dataStart + compSize);
      out[name] = method === 0 ? data : await inflateRaw(data);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  function xmlToText(xml) {
    // Insert breaks for paragraphs and tabs, then strip tags.
    let s = xml
      .replace(/<w:tab[^>]*\/?>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:br[^>]*\/?>/g, "\n")
      .replace(/<[^>]+>/g, "");
    s = s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    return s.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
  }

  async function fromDocx(file) {
    const ab = await file.arrayBuffer();
    const files = await unzip(ab);
    const dec = new TextDecoder();
    let text = "";
    for (const name of ["word/document.xml"]) {
      if (files[name]) text += xmlToText(dec.decode(files[name])) + "\n";
    }
    // also footnotes/headers occasionally hold content
    for (const name of Object.keys(files)) {
      if (/^word\/(header\d+|footer\d+)\.xml$/.test(name)) {
        text += xmlToText(dec.decode(files[name])) + "\n";
      }
    }
    return text.trim();
  }

  async function fromPdf(file) {
    if (!window.pdfjsLib) throw new Error("pdf.js não carregou");
    const ab = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let last = null;
      let line = "";
      const lines = [];
      for (const item of content.items) {
        if (last && Math.abs(item.transform[5] - last) > 3) {
          lines.push(line.trim());
          line = "";
        }
        line += item.str + (item.hasEOL ? "" : " ");
        last = item.transform[5];
      }
      if (line.trim()) lines.push(line.trim());
      text += lines.filter(Boolean).join("\n") + "\n";
    }
    return text.trim();
  }

  async function extractText(file) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".pdf") || file.type === "application/pdf") return fromPdf(file);
    if (name.endsWith(".docx") || file.type.includes("word")) return fromDocx(file);
    // fallback: try docx then pdf
    try { return await fromDocx(file); } catch (e) { return fromPdf(file); }
  }

  window.RBParse = { extractText };
})();

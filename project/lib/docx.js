/* RecrutaBot — .docx generation via docxtemplater filling the Hays standard template.
   Output is byte-faithful to the original template; only token values change. */
(function () {
  function b64ToUint8(b64) {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  function flatten(data) {
    const M = window.RBModel;
    const h = data.header || {};
    const perfil = data.perfil || {};
    const out = {
      nome: h.name || "",
      consultoria: h.consultancy || "Hays Consultoria",
      localizacao: h.location || "",
      nacionalidade: h.nationality || "",
      telefone: h.phone || "",
      email: h.email || "",
      qualificacao: data.qualificacao || "",
      certificacoes: (data.certificacoes || []).filter(Boolean),
      experiencias: (data.experiencias || []).map((e) => ({
        empresa: e.empresa || "",
        cargo: e.cargo || "",
        periodo: e.periodo || "",
        local: e.local || "",
        atividades: e.atividades || "",
      })),
      formacao: (data.formacao || []).filter(Boolean),
      referencias: data.referencias || "N/A",
      parecer: data.parecer || "",
    };
    M.perfilFields.forEach((f) => { out["p_" + f.key] = perfil[f.key] || ""; });
    return out;
  }

  function build(data) {
    const Pizzip = window.PizZip;
    const Docx = window.docxtemplater || window.Docxtemplater;
    if (!Pizzip || !Docx) throw new Error("docxtemplater/pizzip não carregaram");
    if (!window.RB_TEMPLATE_B64) throw new Error("template não carregado");
    const zip = new Pizzip(b64ToUint8(window.RB_TEMPLATE_B64).buffer);
    const doc = new Docx(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(flatten(data));
    return doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  window.RBDocx = { build, flatten };
})();

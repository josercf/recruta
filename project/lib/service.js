/* RecrutaBot — service boundary.
   Hoje roda 100% no navegador (modo local). Para usar um backend, defina BACKEND_URL:
   o app passa a enviar o arquivo para /api/extract e os dados para /api/generate.
   O contrato (JSON de dados e .docx de saída) é idêntico ao backend de referência em /backend. */
(function () {
  // Ex.: "https://seu-backend.com"  (null = processa no navegador)
  const BACKEND_URL = null;

  async function extract(file, onProgress) {
    const prog = onProgress || (() => {});
    if (BACKEND_URL) {
      prog({ phase: "core" });
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(BACKEND_URL + "/api/extract", { method: "POST", body: fd });
      if (!r.ok) throw new Error("Falha no backend (extract): " + r.status);
      const data = await r.json();
      prog({ phase: "done", current: (data.experiencias || []).length });
      return data;
    }
    // local
    const raw = await window.RBParse.extractText(file);
    prog({ phase: "core" });
    return await window.RBExtract.run(raw, prog);
  }

  async function generateDocx(data) {
    if (BACKEND_URL) {
      const r = await fetch(BACKEND_URL + "/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Falha no backend (generate): " + r.status);
      return await r.blob();
    }
    return window.RBDocx.build(data);
  }

  window.RBService = { extract, generateDocx, backendUrl: BACKEND_URL };
})();

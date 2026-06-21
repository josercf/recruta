/* RecrutaBot — AI extraction (window.claude.complete, batched experiences) */
(function () {
  function parseJSON(txt) {
    if (!txt) throw new Error("empty");
    let s = txt.trim();
    s = s.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    return JSON.parse(s);
  }

  async function callJSON(prompt, tries) {
    tries = tries || 2;
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try {
        const out = await window.claude.complete({ messages: [{ role: "user", content: prompt }] });
        return parseJSON(out);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  async function run(rawText, onProgress) {
    const progress = onProgress || (() => {});
    const text = String(rawText || "").slice(0, 24000);

    // ---- core fields ----
    progress({ phase: "core" });
    const corePrompt =
`Você é um assistente de recrutamento. Abaixo está o texto bruto de um currículo. Extraia as informações e responda APENAS com JSON válido (sem comentários), no formato:
{
 "header": {"name":"","location":"","nationality":"","phone":"","email":""},
 "perfil": {
   "segmentoArea":"", "especialidade":"", "especialidadeTempo":"",
   "expertiseModulo":"", "expertiseTempo":"", "proficiencia":"",
   "nivelIngles":"", "nivelEspanhol":"", "baseAtual":"", "disponibilidade":""
 },
 "qualificacao":"",
 "certificacoes":[],
 "formacao":[]
}
Regras:
- "name": nome completo do candidato. "location"/"baseAtual": cidade, estado. "nationality": se mencionada.
- Em "perfil", infira a área/segmento principal (ex: "Tecnologia da Informação – SAP"), especialidade, tempo total de experiência (ex: "+15 anos"), módulo/expertise principal, e níveis de idioma (Básico/Intermediário/Avançado/Fluente). Deixe "" o que não houver.
- "proficiencia": senioridade (ex: "Alta (Senior)"), se inferível.
- "qualificacao": parágrafo de resumo profissional (use o resumo/objetivo do CV; se não houver, escreva 2-3 frases a partir do conteúdo).
- "certificacoes": lista de cursos/certificações técnicas citados (strings curtas).
- "formacao": formação acadêmica + certificações formais (ex: graduação, PMP, ITIL) como strings.
Não invente dados pessoais. Texto do currículo:
"""${text}"""`;
    let core;
    try {
      core = await callJSON(corePrompt);
    } catch (e) {
      core = { header: {}, perfil: {}, qualificacao: "", certificacoes: [], formacao: [] };
    }

    // ---- experiences in batches ----
    const experiencias = [];
    const seen = [];
    const maxCalls = 18;
    for (let call = 0; call < maxCalls; call++) {
      progress({ phase: "exp", current: experiencias.length });
      const seenList = seen.length
        ? "Empresas JÁ extraídas (NÃO repita, continue a PRÓXIMA na ordem do documento):\n" + seen.map((s) => "- " + s).join("\n")
        : "Nenhuma ainda — comece pela primeira experiência do documento.";
      const expPrompt =
`Extraia as PRÓXIMAS experiências profissionais (no máximo 4) deste currículo, na ordem em que aparecem. Responda APENAS com JSON:
{"exps":[{"empresa":"","cargo":"","periodo":"","local":"","atividades":""}],"done":false}
Regras:
- "done": true quando NÃO houver mais experiências após as já extraídas.
- "atividades": copie/resuma as atividades em até 60 palavras, mantendo termos técnicos.
- "periodo": ex "Jan/2020 – Abr/2020". "local": cidade/remoto se houver, senão "".
- Se não houver mais experiências, retorne {"exps":[],"done":true}.
${seenList}
Texto do currículo:
"""${text}"""`;
      let res;
      try {
        res = await callJSON(expPrompt);
      } catch (e) {
        break;
      }
      const exps = Array.isArray(res.exps) ? res.exps : [];
      let added = 0;
      for (const e of exps) {
        if (!e || !e.empresa) continue;
        const key = (e.empresa + "|" + (e.periodo || "")).toLowerCase().trim();
        if (seen.some((s) => s.toLowerCase().includes((e.empresa || "").toLowerCase()) && experiencias.some((x) => (x.empresa || "").toLowerCase() === (e.empresa || "").toLowerCase() && (x.periodo || "") === (e.periodo || "")))) continue;
        if (experiencias.some((x) => (x.empresa || "").toLowerCase() === (e.empresa || "").toLowerCase() && (x.periodo || "") === (e.periodo || ""))) continue;
        experiencias.push({
          empresa: e.empresa || "",
          cargo: e.cargo || "",
          periodo: e.periodo || "",
          local: e.local || "",
          atividades: e.atividades || "",
        });
        seen.push(e.empresa + (e.periodo ? " (" + e.periodo + ")" : ""));
        added++;
      }
      if (res.done || added === 0) break;
      if (experiencias.length >= 60) break;
    }

    const M = window.RBModel;
    const data = M.emptyData();
    data.header.name = (core.header && core.header.name) || "";
    data.header.location = (core.header && core.header.location) || "";
    data.header.nationality = (core.header && core.header.nationality) || "";
    data.header.phone = (core.header && core.header.phone) || "";
    data.header.email = (core.header && core.header.email) || "";
    if (core.perfil) {
      Object.keys(data.perfil).forEach((k) => {
        if (core.perfil[k]) data.perfil[k] = core.perfil[k];
      });
      if (!data.perfil.baseAtual && data.header.location) data.perfil.baseAtual = data.header.location;
    }
    data.qualificacao = core.qualificacao || "";
    data.certificacoes = Array.isArray(core.certificacoes) ? core.certificacoes.filter(Boolean) : [];
    data.formacao = Array.isArray(core.formacao) ? core.formacao.filter(Boolean) : [];
    data.experiencias = experiencias;
    progress({ phase: "done", current: experiencias.length });
    return data;
  }

  async function draftParecer(data, lang) {
    const exps = (data.experiencias || []).slice(0, 6).map((e) => `${e.empresa} (${e.cargo})`).join(", ");
    const prompt =
      (lang === "en"
        ? "Write a concise recruiter interview assessment (3-4 sentences, professional, third person) for this candidate. Output plain text only."
        : "Escreva um parecer de entrevista do recrutador, conciso (3-4 frases, profissional, terceira pessoa) sobre este candidato. Responda em texto puro.") +
      `\nNome: ${data.header.name}\nÁrea: ${data.perfil.segmentoArea}\nResumo: ${(data.qualificacao || "").slice(0, 600)}\nEmpresas: ${exps}`;
    const out = await window.claude.complete({ messages: [{ role: "user", content: prompt }] });
    return (out || "").replace(/^```.*$/gm, "").trim();
  }

  window.RBExtract = { run, draftParecer };
})();

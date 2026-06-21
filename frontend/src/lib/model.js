/* RecrutaBot — canonical data model (single source of truth for the flat JSON
   contract shared by: AI extraction output, the review form, POST /api/generate,
   and the DocxTemplater placeholders in the Hays template).

   `source: "ai"`  -> field is pre-filled by the AI from the candidate's CV.
   `source: "rec"` -> recruiter-only field; the AI must NOT invent it, the
                      Hudson completes it during review. */

// Header / contact (rendered at the top of the Hays document).
export const headerFields = [
  { key: "nome",          pt: "Nome do candidato", en: "Candidate name", source: "ai", required: true },
  { key: "consultoria",   pt: "Consultoria",       en: "Consultancy",    source: "ai" },
  { key: "cidade",        pt: "Localização",       en: "Location",       source: "ai" },
  { key: "nacionalidade", pt: "Nacionalidade",     en: "Nationality",    source: "ai" },
  { key: "telefone",      pt: "Telefone",          en: "Phone",          source: "ai" },
  { key: "email",         pt: "E-mail",            en: "Email",          source: "ai" },
];

// Perfil do candidato (Hays profile table). Commercial/Accenture fields are
// recruiter-only and stay blank until the Hudson fills them.
export const perfilFields = [
  { key: "segmento",               pt: "Segmento/Área",                           en: "Segment/Area",                  source: "ai" },
  { key: "especialidade",          pt: "Especialidade",                           en: "Specialty",                     source: "ai" },
  { key: "tempoExperiencia",       pt: "Tempo de experiência",                    en: "Years of experience",           source: "ai" },
  { key: "moduloExpertise",        pt: "Expertise/Módulo",                        en: "Expertise/Module",              source: "ai" },
  { key: "tempoModulo",            pt: "Tempo no módulo",                         en: "Years in module",               source: "ai" },
  { key: "proficiencia",           pt: "Proficiência",                            en: "Proficiency",                   source: "ai" },
  { key: "nivelIngles",            pt: "Nível de inglês",                         en: "English level",                 source: "ai" },
  { key: "nivelEspanhol",          pt: "Nível de espanhol",                       en: "Spanish level",                 source: "ai" },
  { key: "baseAtual",              pt: "Base atual do profissional",              en: "Current base location",         source: "ai" },
  { key: "disponibilidade",        pt: "Disponibilidade",                         en: "Availability",                  source: "ai" },
  { key: "valorRecursoCLT",        pt: "Recurso – Valor Salarial (CLT)",          en: "Resource – Salary (CLT)",       source: "rec" },
  { key: "valorConsultoriaCLT",    pt: "Consultoria – Valor Salarial + Impostos", en: "Consultancy – Salary + Taxes",  source: "rec" },
  { key: "exAccenture",            pt: "Ex-funcionário Accenture?",               en: "Ex-Accenture employee?",        source: "rec" },
  { key: "atuouAccenture",         pt: "Atuou em projetos Accenture?",            en: "Worked on Accenture projects?", source: "rec" },
  { key: "disponibilidadeAgendas", pt: "Disponibilidade de agendas",              en: "Schedule availability",         source: "rec" },
];

export function newExperience() {
  return { empresa: "", cargo: "", periodo: "", local: "", atividades: "" };
}

// A complete, empty record matching the flat JSON contract.
export function emptyData() {
  const d = {
    qualificacao: "",
    certificacoes: [],
    experiencias: [],
    referencias: "N/A",
    formacao: "",
    parecer: "",
  };
  headerFields.forEach((f) => (d[f.key] = f.key === "consultoria" ? "Hays Consultoria" : ""));
  perfilFields.forEach((f) => (d[f.key] = ""));
  return d;
}

// Normalize whatever the backend returns into the canonical shape, so the form
// never crashes on a missing field.
export function normalize(raw) {
  const d = emptyData();
  if (!raw || typeof raw !== "object") return d;
  [...headerFields, ...perfilFields].forEach((f) => {
    if (typeof raw[f.key] === "string") d[f.key] = raw[f.key];
  });
  if (!d.consultoria) d.consultoria = "Hays Consultoria";
  if (typeof raw.qualificacao === "string") d.qualificacao = raw.qualificacao;
  if (typeof raw.formacao === "string") d.formacao = raw.formacao;
  else if (Array.isArray(raw.formacao)) d.formacao = raw.formacao.filter(Boolean).join("\n");
  if (typeof raw.referencias === "string" && raw.referencias) d.referencias = raw.referencias;
  if (typeof raw.parecer === "string") d.parecer = raw.parecer;
  if (Array.isArray(raw.certificacoes)) d.certificacoes = raw.certificacoes.filter((s) => typeof s === "string");
  if (Array.isArray(raw.experiencias)) {
    d.experiencias = raw.experiencias.map((e) => ({
      empresa: e?.empresa || "",
      cargo: e?.cargo || "",
      periodo: e?.periodo || "",
      local: e?.local || "",
      atividades: e?.atividades || "",
    }));
  }
  return d;
}

export function candidateArea(d) {
  return d.segmento || d.especialidade || "—";
}

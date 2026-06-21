/* RecrutaBot — shared data model & field schema (single source of truth) */
(function () {
  // Perfil do candidato — ordered fields. manual:true = recruiter fills in review.
  const perfilFields = [
    { key: "segmentoArea",          pt: "Segmento/Área",                               en: "Segment/Area" },
    { key: "especialidade",         pt: "Especialidade",                               en: "Specialty" },
    { key: "especialidadeTempo",    pt: "Tempo de experiência",                        en: "Years of experience" },
    { key: "expertiseModulo",       pt: "Expertise/Módulo",                            en: "Expertise/Module" },
    { key: "expertiseTempo",        pt: "Tempo de experiência",                        en: "Years of experience" },
    { key: "proficiencia",          pt: "Proficiência",                                en: "Proficiency" },
    { key: "nivelIngles",           pt: "Nível de inglês",                             en: "English level" },
    { key: "nivelEspanhol",         pt: "Nível de espanhol",                           en: "Spanish level" },
    { key: "baseAtual",             pt: "Base atual do profissional",                  en: "Current base location" },
    { key: "disponibilidade",       pt: "Disponibilidade",                             en: "Availability" },
    { key: "valorRecurso",          pt: "Recurso – Valor Salarial (CLT)",              en: "Resource – Salary (CLT)",            manual: true },
    { key: "valorConsultoria",      pt: "Consultoria – Valor Salarial + Impostos",     en: "Consultancy – Salary + Taxes",       manual: true },
    { key: "exAccenture",           pt: "Ex-funcionário Accenture?",                   en: "Ex-Accenture employee?",             manual: true },
    { key: "projetosAccenture",     pt: "Atuou em projetos Accenture?",                en: "Worked on Accenture projects?",      manual: true },
    { key: "disponibilidadeAgendas",pt: "Disponibilidade de agendas",                  en: "Schedule availability",              manual: true },
  ];

  function emptyData() {
    const perfil = {};
    perfilFields.forEach((f) => (perfil[f.key] = ""));
    return {
      header: { name: "", consultancy: "", location: "", nationality: "", phone: "", email: "" },
      perfil,
      qualificacao: "",
      certificacoes: [],          // list lines under Qualificação (courses/certs summary)
      experiencias: [],           // { empresa, cargo, periodo, local, atividades }
      referencias: "N/A",
      formacao: [],               // education/cert lines
      parecer: "",                // recruiter interview opinion (manual)
    };
  }

  function newExperience() {
    return { empresa: "", cargo: "", periodo: "", local: "", atividades: "" };
  }

  window.RBModel = { perfilFields, emptyData, newExperience };
})();

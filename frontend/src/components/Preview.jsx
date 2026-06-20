import { I18N } from "../lib/i18n.js";

/* HTML approximation of the generated .docx — mirrors the Hays template
   (navy name, green "Hays Consultoria", dotted section bars, profile table). */
function DocPreview({ data, lang }) {
  const T = I18N[lang];
  const reqPt = lang === "en" ? " (Required)" : " (Obrigatório)";
  const Bar = (txt) => <div className="doc-bar">{txt}</div>;

  const perfilRows = [
    [lang === "en" ? "Segment/Area" : "Segmento/Área", data.segmento],
    [lang === "en" ? "Specialty / Years" : "Especialidade / Tempo", [data.especialidade, data.tempoExperiencia].filter(Boolean).join("  —  ")],
    [lang === "en" ? "Expertise/Module / Years" : "Expertise/Módulo / Tempo", [data.moduloExpertise, data.tempoModulo].filter(Boolean).join("  —  ")],
    [lang === "en" ? "Proficiency" : "Proficiência", data.proficiencia],
    [lang === "en" ? "English level" : "Nível de inglês", data.nivelIngles],
    [lang === "en" ? "Spanish level" : "Nível de espanhol", data.nivelEspanhol],
    [lang === "en" ? "Current base location" : "Base atual do profissional", data.baseAtual],
    [lang === "en" ? "Availability" : "Disponibilidade", data.disponibilidade],
    [lang === "en" ? "Resource – Salary (CLT)" : "Recurso – Valor Salarial (CLT)", data.valorRecursoCLT],
    [lang === "en" ? "Consultancy – Salary + Taxes" : "Consultoria – Valor Salarial + Impostos", data.valorConsultoriaCLT],
    [lang === "en" ? "Ex-Accenture employee?" : "Ex-funcionário Accenture?", data.exAccenture],
    [lang === "en" ? "Worked on Accenture projects?" : "Atuou em projetos Accenture?", data.atuouAccenture],
    [lang === "en" ? "Schedule availability" : "Disponibilidade de agendas", data.disponibilidadeAgendas],
  ];

  return (
    <div className="doc">
      <div className="doc-head">
        <div>
          <div className="doc-name">{data.nome || "—"}</div>
          <div className="doc-cons">{data.consultoria || "Hays Consultoria"}</div>
        </div>
        <div className="doc-contact">
          {data.cidade || data.nacionalidade ? <div>{[data.cidade, data.nacionalidade].filter(Boolean).join(" · ")}</div> : null}
          {data.telefone ? <div>{(lang === "en" ? "Phone: " : "Telefone: ") + data.telefone}</div> : null}
          {data.email ? <div>E-mail: <b>{data.email}</b></div> : null}
        </div>
      </div>

      {Bar(T.secPerfil + reqPt)}
      <table className="doc-kv">
        <tbody>
          {perfilRows.map((r, i) => (
            <tr key={i}>
              <td className="kv-l">{r[0]}</td>
              <td className="kv-v">{r[1] || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {Bar(T.secQualificacao)}
      {data.qualificacao ? <p className="doc-p">{data.qualificacao}</p> : null}
      {data.certificacoes.map((c, i) => <div className="doc-li" key={"c" + i}>{c}</div>)}

      {Bar(T.secExperiencias)}
      {data.experiencias.map((e, i) => (
        <div className="doc-exp" key={"e" + i}>
          <div className="doc-exp-co">{e.empresa || "—"}</div>
          {e.cargo ? <div className="doc-li"><b>{T.fCargo}: </b>{e.cargo}</div> : null}
          {e.periodo ? <div className="doc-li"><b>{T.fPeriodo}: </b>{e.periodo}</div> : null}
          {e.local ? <div className="doc-li"><b>{T.fLocal}: </b>{e.local}</div> : null}
          {e.atividades ? <div className="doc-li"><b>{T.fAtividades}: </b>{e.atividades}</div> : null}
        </div>
      ))}

      {Bar(T.secReferencias)}
      <p className="doc-p">{data.referencias || "N/A"}</p>

      {Bar(T.secFormacao)}
      {(data.formacao || "").split("\n").filter(Boolean).map((c, i) => <div className="doc-li" key={"f" + i}>{c}</div>)}

      {Bar(T.secParecer + reqPt)}
      <p className="doc-p">{data.parecer || ""}</p>
    </div>
  );
}

export default function Preview({ data, lang, gen, onGenerate, onDownload, goBack }) {
  const T = I18N[lang];
  const status = gen?.status; // undefined | queued | processing | done | error
  const busy = status === "queued" || status === "processing";

  return (
    <div className="screen preview">
      <div className="screen-head sticky-head">
        <div>
          <h2>{T.previewTitle}</h2>
          <p className="muted">{T.previewSub}</p>
          {busy ? <p className="status-note">{T.generating}</p> : null}
          {status === "error" ? <p className="status-note" style={{ color: "#c0392b" }}>{gen.error || T.docError}</p> : null}
          {status === "done" ? <p className="status-note">{T.docReady}</p> : null}
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost" onClick={goBack} disabled={busy}>← {T.backReview}</button>
          {status === "done" ? (
            <button className="btn btn-primary" onClick={onDownload}>⤓ {T.download}</button>
          ) : (
            <button className="btn btn-primary" onClick={onGenerate} disabled={busy}>
              {busy ? T.generating : "⤓ " + T.generate}
            </button>
          )}
        </div>
      </div>
      <div className="doc-stage">
        <DocPreview data={data} lang={lang} />
      </div>
    </div>
  );
}

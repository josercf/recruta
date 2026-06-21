/* RecrutaBot — Review form + document preview (depends on window.RBModel/RBI18n) */
const { useState: rbUseState } = React;

function rbClone(o) { return JSON.parse(JSON.stringify(o)); }

function RBField({ label, badge, required, children }) {
  return (
    React.createElement("label", { className: "field" },
      React.createElement("span", { className: "field-label" },
        label,
        badge ? React.createElement("span", { className: "badge badge-" + badge.type }, badge.text) : null,
        required ? React.createElement("span", { className: "req" }, "*") : null
      ),
      children
    )
  );
}

function RBListEditor({ items, onChange, placeholder, addLabel }) {
  return (
    React.createElement("div", { className: "list-editor" },
      items.map((v, i) =>
        React.createElement("div", { className: "list-row", key: i },
          React.createElement("textarea", {
            className: "input", rows: 1, value: v, placeholder,
            onInput: (e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; },
            onChange: (e) => { const n = items.slice(); n[i] = e.target.value; onChange(n); },
          }),
          React.createElement("button", { className: "icon-btn", title: "—", onClick: () => onChange(items.filter((_, j) => j !== i)) }, "✕")
        )
      ),
      React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => onChange(items.concat([""])) }, "+ " + addLabel)
    )
  );
}

function RBReview({ data, setData, lang, accent, goBack, goNext }) {
  const T = window.RBI18n[lang];
  const M = window.RBModel;
  const [drafting, setDrafting] = rbUseState(false);
  const L = (f) => (lang === "en" ? f.en : f.pt);

  const patchHeader = (k, v) => { const d = rbClone(data); d.header[k] = v; setData(d); };
  const patchPerfil = (k, v) => { const d = rbClone(data); d.perfil[k] = v; setData(d); };
  const setField = (k, v) => { const d = rbClone(data); d[k] = v; setData(d); };
  const patchExp = (i, k, v) => { const d = rbClone(data); d.experiencias[i][k] = v; setData(d); };
  const moveExp = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= data.experiencias.length) return;
    const d = rbClone(data); const t = d.experiencias[i]; d.experiencias[i] = d.experiencias[j]; d.experiencias[j] = t; setData(d);
  };
  const removeExp = (i) => { const d = rbClone(data); d.experiencias.splice(i, 1); setData(d); };
  const addExp = () => { const d = rbClone(data); d.experiencias.push(M.newExperience()); setData(d); };

  const autoGrow = (e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; };

  const draftParecer = async () => {
    setDrafting(true);
    try { const txt = await window.RBExtract.draftParecer(data, lang); setField("parecer", txt); }
    catch (e) { /* ignore */ }
    setDrafting(false);
  };

  const Section = (title, opts, children) =>
    React.createElement("section", { className: "rcard" },
      React.createElement("div", { className: "rcard-head" },
        React.createElement("h3", null, title),
        opts && opts.required ? React.createElement("span", { className: "tag tag-req" }, T.required) : null
      ),
      React.createElement("div", { className: "rcard-body" }, children)
    );

  const hdr = data.header;
  return (
    React.createElement("div", { className: "screen review" },
      React.createElement("div", { className: "screen-head" },
        React.createElement("div", null,
          React.createElement("h2", null, T.reviewTitle),
          React.createElement("p", { className: "muted" }, T.reviewSub)
        )
      ),

      Section(T.secHeader, null,
        React.createElement("div", { className: "grid2" },
          React.createElement(RBField, { label: T.fName, required: true },
            React.createElement("input", { className: "input", value: hdr.name, onChange: (e) => patchHeader("name", e.target.value) })),
          React.createElement(RBField, { label: T.fConsultancy },
            React.createElement("input", { className: "input", value: hdr.consultancy, placeholder: "Hays Consultoria", onChange: (e) => patchHeader("consultancy", e.target.value) })),
          React.createElement(RBField, { label: T.fLocation },
            React.createElement("input", { className: "input", value: hdr.location, onChange: (e) => patchHeader("location", e.target.value) })),
          React.createElement(RBField, { label: T.fNationality },
            React.createElement("input", { className: "input", value: hdr.nationality, onChange: (e) => patchHeader("nationality", e.target.value) })),
          React.createElement(RBField, { label: T.fPhone },
            React.createElement("input", { className: "input", value: hdr.phone, onChange: (e) => patchHeader("phone", e.target.value) })),
          React.createElement(RBField, { label: T.fEmail },
            React.createElement("input", { className: "input", value: hdr.email, onChange: (e) => patchHeader("email", e.target.value) }))
        )
      ),

      Section(T.secPerfil, { required: true },
        React.createElement("div", { className: "grid2" },
          M.perfilFields.map((f) =>
            React.createElement(RBField, {
              key: f.key, label: L(f),
              badge: f.manual ? { type: "rec", text: T.recruiterField } : { type: "ai", text: T.aiField },
            },
              React.createElement("input", {
                className: "input" + (f.manual ? " input-rec" : ""),
                value: data.perfil[f.key], placeholder: f.manual ? "—" : "",
                onChange: (e) => patchPerfil(f.key, e.target.value),
              })
            )
          )
        )
      ),

      Section(T.secQualificacao, null,
        React.createElement("textarea", { className: "input", rows: 6, value: data.qualificacao, onInput: autoGrow, onChange: (e) => setField("qualificacao", e.target.value) })
      ),

      Section(T.secCerts, null,
        React.createElement(RBListEditor, { items: data.certificacoes, onChange: (v) => setField("certificacoes", v), placeholder: "Curso / certificação", addLabel: T.addLine })
      ),

      Section(T.secExperiencias, null,
        React.createElement("div", { className: "exp-list" },
          data.experiencias.map((e, i) =>
            React.createElement("div", { className: "exp-item", key: i },
              React.createElement("div", { className: "exp-bar" },
                React.createElement("span", { className: "exp-n" }, i + 1),
                React.createElement("div", { className: "exp-bar-actions" },
                  React.createElement("button", { className: "icon-btn", title: "↑", onClick: () => moveExp(i, -1) }, "↑"),
                  React.createElement("button", { className: "icon-btn", title: "↓", onClick: () => moveExp(i, 1) }, "↓"),
                  React.createElement("button", { className: "icon-btn", title: T.remove, onClick: () => removeExp(i) }, "✕")
                )
              ),
              React.createElement("div", { className: "grid2" },
                React.createElement(RBField, { label: T.fEmpresa },
                  React.createElement("input", { className: "input", value: e.empresa, onChange: (ev) => patchExp(i, "empresa", ev.target.value) })),
                React.createElement(RBField, { label: T.fCargo },
                  React.createElement("input", { className: "input", value: e.cargo, onChange: (ev) => patchExp(i, "cargo", ev.target.value) })),
                React.createElement(RBField, { label: T.fPeriodo },
                  React.createElement("input", { className: "input", value: e.periodo, onChange: (ev) => patchExp(i, "periodo", ev.target.value) })),
                React.createElement(RBField, { label: T.fLocal },
                  React.createElement("input", { className: "input", value: e.local, onChange: (ev) => patchExp(i, "local", ev.target.value) }))
              ),
              React.createElement(RBField, { label: T.fAtividades },
                React.createElement("textarea", { className: "input", rows: 3, value: e.atividades, onInput: autoGrow, onChange: (ev) => patchExp(i, "atividades", ev.target.value) }))
            )
          ),
          React.createElement("button", { className: "btn btn-ghost", onClick: addExp }, "+ " + T.addExperience)
        )
      ),

      Section(T.secFormacao, null,
        React.createElement(RBListEditor, { items: data.formacao, onChange: (v) => setField("formacao", v), placeholder: "Formação / certificação", addLabel: T.addLine })
      ),

      Section(T.secReferencias, null,
        React.createElement("input", { className: "input", value: data.referencias, onChange: (e) => setField("referencias", e.target.value) })
      ),

      Section(T.secParecer, { required: true },
        React.createElement("p", { className: "muted small" }, T.parecerHint),
        React.createElement("textarea", { className: "input input-rec", rows: 5, value: data.parecer, onInput: autoGrow, onChange: (e) => setField("parecer", e.target.value) }),
        React.createElement("button", { className: "btn btn-ghost btn-sm", disabled: drafting, onClick: draftParecer, style: { marginTop: 8 } },
          drafting ? T.generating : "✦ " + T.generateParecer)
      ),

      React.createElement("div", { className: "action-bar" },
        React.createElement("button", { className: "btn btn-ghost", onClick: goBack }, "← " + T.back),
        React.createElement("button", { className: "btn btn-primary", onClick: goNext }, T.previewTitle + " →")
      )
    )
  );
}

/* ---------- Document preview (HTML approximation of the .docx) ---------- */
function RBDocPreview({ data, lang, brandName }) {
  const T = window.RBI18n[lang];
  const M = window.RBModel;
  const L = (f) => (lang === "en" ? f.en : f.pt);
  const h = data.header;
  const Bar = (txt) => React.createElement("div", { className: "doc-bar" }, txt);
  const reqPt = lang === "en" ? " (Required)" : " (Obrigatório)";
  // perfil rows: pair especialidade/expertise with their tempo
  const perfilRows = [];
  M.perfilFields.forEach((f) => {
    if (f.key === "especialidadeTempo" || f.key === "expertiseTempo") return;
    if (f.key === "especialidade") perfilRows.push([L(M.perfilFields[1]) + " / " + L(M.perfilFields[2]), [data.perfil.especialidade, data.perfil.especialidadeTempo].filter(Boolean).join("  —  ")]);
    else if (f.key === "expertiseModulo") perfilRows.push([L(M.perfilFields[3]) + " / " + L(M.perfilFields[4]), [data.perfil.expertiseModulo, data.perfil.expertiseTempo].filter(Boolean).join("  —  ")]);
    else perfilRows.push([L(f), data.perfil[f.key] || ""]);
  });
  return (
    React.createElement("div", { className: "doc" },
      React.createElement("div", { className: "doc-head" },
        React.createElement("div", null,
          React.createElement("div", { className: "doc-name" }, h.name || "—"),
          React.createElement("div", { className: "doc-cons" }, h.consultancy || "Hays Consultoria")
        ),
        React.createElement("div", { className: "doc-contact" },
          (h.location || h.nationality) ? React.createElement("div", null, [h.location, h.nationality].filter(Boolean).join(" · ")) : null,
          h.phone ? React.createElement("div", null, (lang === "en" ? "Phone: " : "Telefone: ") + h.phone) : null,
          h.email ? React.createElement("div", null, "E-mail: ", React.createElement("b", null, h.email)) : null
        )
      ),

      Bar(T.secPerfil + reqPt),
      React.createElement("table", { className: "doc-kv" },
        React.createElement("tbody", null,
          perfilRows.map((r, i) =>
            React.createElement("tr", { key: i },
              React.createElement("td", { className: "kv-l" }, r[0]),
              React.createElement("td", { className: "kv-v" }, r[1] || "")
            )
          )
        )
      ),

      Bar(T.secQualificacao),
      data.qualificacao ? React.createElement("p", { className: "doc-p" }, data.qualificacao) : null,
      data.certificacoes.map((c, i) => React.createElement("div", { className: "doc-li", key: "c" + i }, c)),

      Bar(T.secExperiencias),
      data.experiencias.map((e, i) =>
        React.createElement("div", { className: "doc-exp", key: "e" + i },
          React.createElement("div", { className: "doc-exp-co" }, e.empresa || "—"),
          e.cargo ? React.createElement("div", { className: "doc-li" }, React.createElement("b", null, T.fCargo + ": "), e.cargo) : null,
          e.periodo ? React.createElement("div", { className: "doc-li" }, React.createElement("b", null, T.fPeriodo + ": "), e.periodo) : null,
          e.local ? React.createElement("div", { className: "doc-li" }, React.createElement("b", null, T.fLocal + ": "), e.local) : null,
          e.atividades ? React.createElement("div", { className: "doc-li" }, React.createElement("b", null, T.fAtividades + ": "), e.atividades) : null
        )
      ),

      Bar(T.secReferencias),
      React.createElement("p", { className: "doc-p" }, data.referencias || "N/A"),

      Bar(T.secFormacao),
      data.formacao.map((c, i) => React.createElement("div", { className: "doc-li", key: "f" + i }, c)),

      Bar(T.secParecer + reqPt),
      React.createElement("p", { className: "doc-p" }, data.parecer || "")
    )
  );
}

function RBPreview({ data, lang, brandName, accent, goBack, onDownload }) {
  const T = window.RBI18n[lang];
  return (
    React.createElement("div", { className: "screen preview" },
      React.createElement("div", { className: "screen-head sticky-head" },
        React.createElement("div", null,
          React.createElement("h2", null, T.previewTitle),
          React.createElement("p", { className: "muted" }, T.previewSub)
        ),
        React.createElement("div", { className: "head-actions" },
          React.createElement("button", { className: "btn btn-ghost", onClick: goBack }, "← " + T.backReview),
          React.createElement("button", { className: "btn btn-primary", onClick: onDownload }, "⤓ " + T.download)
        )
      ),
      React.createElement("div", { className: "doc-stage" },
        React.createElement(RBDocPreview, { data, lang, brandName })
      )
    )
  );
}

Object.assign(window, { RBReview, RBPreview, RBDocPreview });

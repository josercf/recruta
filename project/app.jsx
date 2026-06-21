/* RecrutaBot — main app shell, routing, upload, processing, history, tweaks */
const { useState, useEffect, useRef, useCallback } = React;

function rbClone(o) { return JSON.parse(JSON.stringify(o)); }

const RB_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "a",
  "accent": "#2A5C9E",
  "density": "comfortable"
}/*EDITMODE-END*/;

const RB_ACCENTS = ["#2A5C9E", "#1F3A5F", "#1F7A6B", "#7A4FB0"];
const LS_RECORDS = "recrutabot_records_v1";
const LS_SESSION = "recrutabot_session_v1";

function rbLoad(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function rbSave(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

function rbArea(data) {
  return (data.perfil && (data.perfil.segmentoArea || data.perfil.especialidade)) || "—";
}
async function rbDownloadDocx(data) {
  const blob = await window.RBService.generateDocx(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (data.header.name || "candidato").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  a.href = url; a.download = "CV_Padrao_" + safe + ".docx";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------------- Logo ---------------- */
function RBLogo({ small }) {
  return (
    React.createElement("div", { className: "logo" + (small ? " logo-sm" : "") },
      React.createElement("span", { className: "logo-mark" },
        React.createElement("span", { className: "logo-eye" }),
        React.createElement("span", { className: "logo-eye" })
      ),
      React.createElement("span", { className: "logo-word" }, "Recruta", React.createElement("b", null, "Bot"))
    )
  );
}

/* ---------------- Upload ---------------- */
function RBUpload({ lang, onFile, records, openRecord }) {
  const T = window.RBI18n[lang];
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const handle = (file) => { if (file) onFile(file); };
  return (
    React.createElement("div", { className: "screen upload" },
      React.createElement("div", { className: "upload-hero" },
        React.createElement("h1", null, T.uploadTitle),
        React.createElement("p", { className: "muted lead" }, T.uploadSub),
        React.createElement("div", {
          className: "dropzone" + (drag ? " drag" : ""),
          onDragOver: (e) => { e.preventDefault(); setDrag(true); },
          onDragLeave: () => setDrag(false),
          onDrop: (e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); },
          onClick: () => inputRef.current && inputRef.current.click(),
        },
          React.createElement("div", { className: "dz-icon" }, "⤓"),
          React.createElement("div", { className: "dz-title" }, T.dropHere),
          React.createElement("div", { className: "dz-or" }, T.or),
          React.createElement("button", { className: "btn btn-primary", onClick: (e) => { e.stopPropagation(); inputRef.current.click(); } }, T.browse),
          React.createElement("div", { className: "dz-accepts" }, T.accepts),
          React.createElement("input", {
            ref: inputRef, type: "file", accept: ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            style: { display: "none" }, onChange: (e) => handle(e.target.files[0]),
          })
        )
      ),
      React.createElement("div", { className: "recent" },
        React.createElement("h4", null, T.recent),
        records.length === 0
          ? React.createElement("p", { className: "muted small" }, T.noRecent)
          : React.createElement("div", { className: "recent-list" },
            records.slice(0, 4).map((r) =>
              React.createElement("button", { className: "recent-item", key: r.id, onClick: () => openRecord(r) },
                React.createElement("span", { className: "ri-avatar" }, (r.name || "?").slice(0, 1).toUpperCase()),
                React.createElement("span", { className: "ri-main" },
                  React.createElement("span", { className: "ri-name" }, r.name || "—"),
                  React.createElement("span", { className: "ri-area" }, r.area)
                ),
                React.createElement("span", { className: "ri-date" }, r.date)
              )
            )
          )
      )
    )
  );
}

/* ---------------- Processing ---------------- */
function RBProcessing({ lang, phase, count, error, onManual, fileName }) {
  const T = window.RBI18n[lang];
  const steps = [
    { key: "read", label: T.procReading },
    { key: "core", label: T.procExtracting },
    { key: "exp", label: T.procExp + (count ? " (" + count + ")" : "") },
  ];
  const order = ["read", "core", "exp", "done"];
  const cur = order.indexOf(phase);
  return (
    React.createElement("div", { className: "screen processing" },
      React.createElement("div", { className: "proc-card" },
        error
          ? React.createElement("div", { className: "proc-error" },
              React.createElement("div", { className: "proc-x" }, "!"),
              React.createElement("h3", null, T.procError),
              React.createElement("p", { className: "muted" }, T.procErrorSub),
              React.createElement("button", { className: "btn btn-primary", onClick: onManual }, T.continueManually)
            )
          : React.createElement(React.Fragment, null,
              React.createElement("div", { className: "spinner" }),
              React.createElement("div", { className: "proc-file" }, fileName),
              React.createElement("ul", { className: "proc-steps" },
                steps.map((s, i) => {
                  const idx = order.indexOf(s.key);
                  const state = idx < cur ? "done" : idx === cur ? "active" : "todo";
                  return React.createElement("li", { key: s.key, className: "ps ps-" + state },
                    React.createElement("span", { className: "ps-dot" }, state === "done" ? "✓" : ""),
                    React.createElement("span", null, s.label)
                  );
                })
              )
            )
      )
    )
  );
}

/* ---------------- History ---------------- */
function RBHistory({ lang, records, openRecord, deleteRecord, downloadRecord, goNew }) {
  const T = window.RBI18n[lang];
  return (
    React.createElement("div", { className: "screen history" },
      React.createElement("div", { className: "screen-head" },
        React.createElement("div", null,
          React.createElement("h2", null, T.historyTitle),
          React.createElement("p", { className: "muted" }, T.historySub)
        ),
        React.createElement("button", { className: "btn btn-primary", onClick: goNew }, "+ " + T.navUpload)
      ),
      records.length === 0
        ? React.createElement("div", { className: "empty" }, T.emptyHistory)
        : React.createElement("table", { className: "htable" },
            React.createElement("thead", null,
              React.createElement("tr", null,
                React.createElement("th", null, T.colName),
                React.createElement("th", null, T.colArea),
                React.createElement("th", null, T.colDate),
                React.createElement("th", { className: "ta-r" }, T.colActions)
              )
            ),
            React.createElement("tbody", null,
              records.map((r) =>
                React.createElement("tr", { key: r.id },
                  React.createElement("td", null,
                    React.createElement("div", { className: "hcell" },
                      React.createElement("span", { className: "ri-avatar sm" }, (r.name || "?").slice(0, 1).toUpperCase()),
                      React.createElement("span", null, r.name || "—")
                    )
                  ),
                  React.createElement("td", { className: "muted" }, r.area),
                  React.createElement("td", { className: "muted" }, r.date),
                  React.createElement("td", { className: "ta-r" },
                    React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => openRecord(r) }, T.open),
                    React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => downloadRecord(r) }, T.downloadShort),
                    React.createElement("button", { className: "icon-btn", title: T.delete, onClick: () => deleteRecord(r.id) }, "✕")
                  )
                )
              )
            )
          )
    )
  );
}

/* ---------------- App ---------------- */
function App() {
  const [t, setTweak] = window.useTweaks(RB_TWEAK_DEFAULTS);
  const session = rbLoad(LS_SESSION, {});
  const [lang, setLang] = useState(session.lang || "pt");
  const [route, setRoute] = useState(session.route && session.route !== "processing" ? session.route : "upload");
  const [data, setData] = useState(session.data || null);
  const [records, setRecords] = useState(rbLoad(LS_RECORDS, []));
  const [proc, setProc] = useState({ phase: "read", count: 0, error: false, fileName: "" });
  const [curId, setCurId] = useState(session.curId || null);
  const T = window.RBI18n[lang];

  // theme application
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", t.accent || "#2A5C9E");
    document.body.className = "dir-" + (t.direction || "a") + " dens-" + (t.density || "comfortable");
  }, [t.accent, t.direction, t.density]);

  // persist session
  useEffect(() => {
    rbSave(LS_SESSION, { lang, route: route === "processing" ? "upload" : route, data, curId });
  }, [lang, route, data, curId]);
  useEffect(() => { rbSave(LS_RECORDS, records); }, [records]);

  const accent = t.accent || "#2A5C9E";

  const startFile = useCallback(async (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert("Arquivo acima de 20 MB."); return; }
    setProc({ phase: "read", count: 0, error: false, fileName: file.name });
    setRoute("processing");
    let result;
    try {
      result = await window.RBService.extract(file, (pr) => {
        setProc((p) => ({ ...p, phase: pr.phase === "done" ? "done" : pr.phase, count: pr.current || p.count }));
      });
    } catch (e) {
      setProc((p) => ({ ...p, error: true }));
      return;
    }
    if (!result || (!result.header.name && result.experiencias.length === 0)) {
      const base = window.RBModel.emptyData();
      const guess = file.name.replace(/\.(pdf|docx)$/i, "").replace(/[_-]+/g, " ").replace(/cv|curriculo|currículo|resume/gi, "").trim();
      if (result) Object.assign(base, result);
      if (!base.header.name) base.header.name = guess;
      setData(base); setCurId(null); setRoute("review");
      return;
    }
    setData(result); setCurId(null);
    setRoute("review");
  }, []);

  const goManual = () => {
    const base = window.RBModel.emptyData();
    base.header.name = proc.fileName.replace(/\.(pdf|docx)$/i, "").replace(/[_-]+/g, " ").trim();
    setData(base); setCurId(null); setRoute("review");
  };

  const upsertRecord = (d) => {
    const now = new Date();
    const date = now.toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + now.toLocaleTimeString(lang === "en" ? "en-US" : "pt-BR", { hour: "2-digit", minute: "2-digit" });
    const rec = { id: curId || "r" + Date.now(), name: d.header.name || "—", area: rbArea(d), date, lang, data: rbClone(d) };
    setRecords((rs) => {
      const i = rs.findIndex((x) => x.id === rec.id);
      if (i >= 0) { const n = rs.slice(); n[i] = rec; return n; }
      return [rec].concat(rs);
    });
    setCurId(rec.id);
    return rec;
  };

  const handleDownload = () => {
    upsertRecord(data);
    rbDownloadDocx(data);
  };

  const openRecord = (r) => { setData(rbClone(r.data)); setLang(r.lang || lang); setCurId(r.id); setRoute("preview"); };
  const downloadRecord = (r) => rbDownloadDocx(r.data);
  const deleteRecord = (id) => setRecords((rs) => rs.filter((x) => x.id !== id));

  const nav = (r) => () => setRoute(r);

  const NavLinks = () =>
    React.createElement(React.Fragment, null,
      React.createElement("button", { className: "navitem" + (["upload", "processing", "review", "preview"].includes(route) ? " active" : ""), onClick: nav("upload") }, T.navUpload),
      React.createElement("button", { className: "navitem" + (route === "history" ? " active" : ""), onClick: nav("history") },
        T.navHistory, records.length ? React.createElement("span", { className: "nav-count" }, records.length) : null)
    );

  const LangToggle = () =>
    React.createElement("div", { className: "lang-toggle" },
      ["pt", "en"].map((l) =>
        React.createElement("button", { key: l, className: "lt" + (lang === l ? " on" : ""), onClick: () => setLang(l) }, l.toUpperCase())
      )
    );

  let screen;
  if (route === "upload") screen = React.createElement(RBUpload, { lang, onFile: startFile, records, openRecord });
  else if (route === "processing") screen = React.createElement(RBProcessing, { lang, phase: proc.phase, count: proc.count, error: proc.error, fileName: proc.fileName, onManual: goManual });
  else if (route === "review") screen = React.createElement(window.RBReview, { data, setData, lang, accent, goBack: nav("upload"), goNext: nav("preview") });
  else if (route === "preview") screen = React.createElement(window.RBPreview, { data, lang, brandName: "RecrutaBot", accent, goBack: nav("review"), onDownload: handleDownload });
  else if (route === "history") screen = React.createElement(RBHistory, { lang, records, openRecord, deleteRecord, downloadRecord, goNew: nav("upload") });

  const dir = t.direction || "a";
  return (
    React.createElement("div", { className: "app" },
      dir === "a"
        ? React.createElement("header", { className: "topbar" },
            React.createElement("div", { className: "tb-left" }, React.createElement(RBLogo, null)),
            React.createElement("nav", { className: "tb-nav" }, React.createElement(NavLinks, null)),
            React.createElement("div", { className: "tb-right" }, React.createElement(LangToggle, null))
          )
        : React.createElement("aside", { className: "sidebar" },
            React.createElement("div", { className: "sb-logo" }, React.createElement(RBLogo, null)),
            React.createElement("nav", { className: "sb-nav" }, React.createElement(NavLinks, null)),
            React.createElement("div", { className: "sb-foot" }, React.createElement(LangToggle, null))
          ),
      React.createElement("main", { className: "content" }, screen),

      // Tweaks
      React.createElement(window.TweaksPanel, null,
        React.createElement(window.TweakSection, { label: lang === "en" ? "Layout" : "Layout" }),
        React.createElement(window.TweakRadio, {
          label: lang === "en" ? "Direction" : "Direção",
          value: t.direction,
          options: [
            { value: "a", label: lang === "en" ? "Top bar" : "Barra topo" },
            { value: "b", label: lang === "en" ? "Sidebar" : "Lateral" },
          ],
          onChange: (v) => setTweak("direction", v),
        }),
        React.createElement(window.TweakRadio, {
          label: lang === "en" ? "Density" : "Densidade",
          value: t.density,
          options: [
            { value: "compact", label: lang === "en" ? "Compact" : "Compacta" },
            { value: "comfortable", label: lang === "en" ? "Comfortable" : "Confortável" },
          ],
          onChange: (v) => setTweak("density", v),
        }),
        React.createElement(window.TweakSection, { label: lang === "en" ? "Brand" : "Marca" }),
        React.createElement(window.TweakColor, {
          label: lang === "en" ? "Accent" : "Destaque",
          value: t.accent, options: RB_ACCENTS, onChange: (v) => setTweak("accent", v),
        })
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));

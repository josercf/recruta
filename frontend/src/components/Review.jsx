import { I18N } from "../lib/i18n.js";
import { headerFields, perfilFields, newExperience } from "../lib/model.js";

function autoGrow(e) {
  e.target.style.height = "auto";
  e.target.style.height = e.target.scrollHeight + "px";
}

function Field({ label, badge, required, children }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {badge ? <span className={"badge badge-" + badge.type}>{badge.text}</span> : null}
        {required ? <span className="req">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function ListEditor({ items, onChange, placeholder, addLabel }) {
  return (
    <div className="list-editor">
      {items.map((v, i) => (
        <div className="list-row" key={i}>
          <textarea
            className="input"
            rows={1}
            value={v}
            placeholder={placeholder}
            onInput={autoGrow}
            onChange={(e) => {
              const n = items.slice();
              n[i] = e.target.value;
              onChange(n);
            }}
          />
          <button className="icon-btn" title="—" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => onChange(items.concat([""]))}>+ {addLabel}</button>
    </div>
  );
}

function Section({ title, required, requiredLabel, children }) {
  return (
    <section className="rcard">
      <div className="rcard-head">
        <h3>{title}</h3>
        {required ? <span className="tag tag-req">{requiredLabel}</span> : null}
      </div>
      <div className="rcard-body">{children}</div>
    </section>
  );
}

export default function Review({ data, setData, lang, goNext }) {
  const T = I18N[lang];
  const L = (f) => (lang === "en" ? f.en : f.pt);
  const badgeFor = (f) =>
    f.source === "rec" ? { type: "rec", text: T.recruiterField } : { type: "ai", text: T.aiField };

  const set = (k, v) => setData({ ...data, [k]: v });
  const patchExp = (i, k, v) => {
    const exps = data.experiencias.map((e, j) => (j === i ? { ...e, [k]: v } : e));
    set("experiencias", exps);
  };
  const moveExp = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= data.experiencias.length) return;
    const exps = data.experiencias.slice();
    [exps[i], exps[j]] = [exps[j], exps[i]];
    set("experiencias", exps);
  };
  const removeExp = (i) => set("experiencias", data.experiencias.filter((_, j) => j !== i));
  const addExp = () => set("experiencias", data.experiencias.concat([newExperience()]));

  return (
    <div className="screen review">
      <div className="screen-head">
        <div>
          <h2>{T.reviewTitle}</h2>
          <p className="muted">{T.reviewSub}</p>
        </div>
      </div>

      {/* Identificação */}
      <Section title={T.secHeader}>
        <div className="grid2">
          {headerFields.map((f) => (
            <Field key={f.key} label={L(f)} required={f.required}>
              <input
                className="input"
                value={data[f.key] || ""}
                placeholder={f.key === "consultoria" ? "Hays Consultoria" : ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </Section>

      {/* Perfil do candidato */}
      <Section title={T.secPerfil} required requiredLabel={T.required}>
        <div className="grid2">
          {perfilFields.map((f) => (
            <Field key={f.key} label={L(f)} badge={badgeFor(f)}>
              <input
                className={"input" + (f.source === "rec" ? " input-rec" : "")}
                value={data[f.key] || ""}
                placeholder={f.source === "rec" ? "—" : ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </Section>

      {/* Qualificação */}
      <Section title={T.secQualificacao}>
        <textarea
          className="input"
          rows={6}
          value={data.qualificacao}
          onInput={autoGrow}
          onChange={(e) => set("qualificacao", e.target.value)}
        />
      </Section>

      {/* Cursos e certificações (lista) */}
      <Section title={T.secCerts}>
        <ListEditor
          items={data.certificacoes}
          onChange={(v) => set("certificacoes", v)}
          placeholder={lang === "en" ? "Course / certification" : "Curso / certificação"}
          addLabel={T.addLine}
        />
      </Section>

      {/* Experiência profissional */}
      <Section title={T.secExperiencias}>
        <div className="exp-list">
          {data.experiencias.map((e, i) => (
            <div className="exp-item" key={i}>
              <div className="exp-bar">
                <span className="exp-n">{i + 1}</span>
                <div className="exp-bar-actions">
                  <button className="icon-btn" title="↑" onClick={() => moveExp(i, -1)}>↑</button>
                  <button className="icon-btn" title="↓" onClick={() => moveExp(i, 1)}>↓</button>
                  <button className="icon-btn" title={T.remove} onClick={() => removeExp(i)}>✕</button>
                </div>
              </div>
              <div className="grid2">
                <Field label={T.fEmpresa}>
                  <input className="input" value={e.empresa} onChange={(ev) => patchExp(i, "empresa", ev.target.value)} />
                </Field>
                <Field label={T.fCargo}>
                  <input className="input" value={e.cargo} onChange={(ev) => patchExp(i, "cargo", ev.target.value)} />
                </Field>
                <Field label={T.fPeriodo}>
                  <input className="input" value={e.periodo} onChange={(ev) => patchExp(i, "periodo", ev.target.value)} />
                </Field>
                <Field label={T.fLocal}>
                  <input className="input" value={e.local} onChange={(ev) => patchExp(i, "local", ev.target.value)} />
                </Field>
              </div>
              <Field label={T.fAtividades}>
                <textarea
                  className="input"
                  rows={3}
                  value={e.atividades}
                  onInput={autoGrow}
                  onChange={(ev) => patchExp(i, "atividades", ev.target.value)}
                />
              </Field>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={addExp}>+ {T.addExperience}</button>
        </div>
      </Section>

      {/* Formação (campo único, conforme placeholder {{formacao}}) */}
      <Section title={T.secFormacao}>
        <textarea
          className="input"
          rows={4}
          value={data.formacao}
          onInput={autoGrow}
          onChange={(e) => set("formacao", e.target.value)}
        />
      </Section>

      {/* Referências (recrutador) */}
      <Section title={T.secReferencias}>
        <input className="input input-rec" value={data.referencias} onChange={(e) => set("referencias", e.target.value)} />
      </Section>

      {/* Parecer da entrevista (recrutador) */}
      <Section title={T.secParecer} required requiredLabel={T.required}>
        <p className="muted small" style={{ marginBottom: 8 }}>{T.parecerHint}</p>
        <textarea
          className="input input-rec"
          rows={5}
          value={data.parecer}
          onInput={autoGrow}
          onChange={(e) => set("parecer", e.target.value)}
        />
      </Section>

      <div className="action-bar" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={goNext}>{T.previewTitle} →</button>
      </div>
    </div>
  );
}

import { I18N } from "../lib/i18n.js";

/* Processing screen driven by the parse job's status:
   queued -> processing -> parsed (terminal-success) | error (terminal-fail). */
export default function Processing({ lang, status, error, fileName, onRetry }) {
  const T = I18N[lang];

  if (status === "error") {
    return (
      <div className="screen processing">
        <div className="proc-card">
          <div className="proc-error">
            <div className="proc-x">!</div>
            <h3>{T.procError}</h3>
            <p className="muted">{error || T.procErrorSub}</p>
            <button className="btn btn-primary" onClick={onRetry}>{T.tryAgain}</button>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { key: "queued", label: T.procQueued },
    { key: "processing", label: T.procExtracting },
    { key: "parsed", label: T.procExp },
  ];
  const order = ["queued", "processing", "parsed"];
  const cur = Math.max(0, order.indexOf(status));

  return (
    <div className="screen processing">
      <div className="proc-card">
        <div className="spinner" />
        <div className="proc-file">{fileName}</div>
        <ul className="proc-steps">
          {steps.map((s, i) => {
            const state = i < cur ? "done" : i === cur ? "active" : "todo";
            return (
              <li key={s.key} className={"ps ps-" + state}>
                <span className="ps-dot">{state === "done" ? "✓" : ""}</span>
                <span>{s.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

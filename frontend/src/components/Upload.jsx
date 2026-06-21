import { useRef, useState } from "react";
import { I18N } from "../lib/i18n.js";

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX = 20 * 1024 * 1024;

export default function Upload({ lang, onFile }) {
  const T = I18N[lang];
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handle = (file) => {
    if (!file) return;
    if (file.size > MAX) {
      alert(lang === "en" ? "File over 20 MB." : "Arquivo acima de 20 MB.");
      return;
    }
    onFile(file);
  };

  return (
    <div className="screen upload">
      <div className="upload-hero">
        <h1>{T.uploadTitle}</h1>
        <p className="muted lead">{T.uploadSub}</p>
        <div
          className={"dropzone" + (drag ? " drag" : "")}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current && inputRef.current.click()}
        >
          <div className="dz-icon">⤓</div>
          <div className="dz-title">{T.dropHere}</div>
          <div className="dz-or">{T.or}</div>
          <button
            className="btn btn-primary"
            onClick={(e) => { e.stopPropagation(); inputRef.current.click(); }}
          >
            {T.browse}
          </button>
          <div className="dz-accepts">{T.accepts}</div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            style={{ display: "none" }}
            onChange={(e) => handle(e.target.files[0])}
          />
        </div>
      </div>
    </div>
  );
}

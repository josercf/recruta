import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { I18N } from "./lib/i18n.js";
import { normalize } from "./lib/model.js";
import { startParse, startGenerate, watchJob, downloadFromUrl } from "./lib/api.js";
import Logo from "./components/Logo.jsx";
import Login from "./components/Login.jsx";
import Upload from "./components/Upload.jsx";
import Processing from "./components/Processing.jsx";
import Review from "./components/Review.jsx";
import Preview from "./components/Preview.jsx";

const ROUTES = ["upload", "review", "preview"];
function routeFromHash() {
  const r = (window.location.hash || "").replace(/^#\/?/, "");
  return ROUTES.includes(r) ? r : "upload";
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [lang, setLang] = useState("pt");
  const [route, setRoute] = useState(routeFromHash());
  const [data, setData] = useState(null);

  // parse job state
  const [fileName, setFileName] = useState("");
  const [parseStatus, setParseStatus] = useState("queued");
  const [parseError, setParseError] = useState("");
  // generate job state
  const [gen, setGen] = useState(null);

  const stopRef = useRef(null); // active watchJob unsubscribe
  const T = I18N[lang];

  // ---- auth ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- hash routing ----
  const navigate = useCallback((r) => {
    window.location.hash = "#/" + r;
    setRoute(r);
  }, []);
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => () => stopRef.current && stopRef.current(), []);

  // Guard: can't be on review/preview without data (e.g. after a refresh).
  const screen = (route === "review" || route === "preview") && !data ? "upload" : route;

  // ---- parse flow ----
  const onFile = useCallback(async (file) => {
    if (stopRef.current) stopRef.current();
    setFileName(file.name);
    setParseError("");
    setParseStatus("queued");
    setRoute("processing"); // transient (not pushed to hash)
    try {
      const { jobId } = await startParse(file);
      stopRef.current = watchJob(jobId, (job) => {
        setParseStatus(job.status);
        if (job.status === "parsed") {
          stopRef.current && stopRef.current();
          setData(normalize(job.result));
          setGen(null);
          navigate("review");
        } else if (job.status === "error") {
          stopRef.current && stopRef.current();
          setParseError(job.error || "");
        }
      });
    } catch (e) {
      setParseStatus("error");
      setParseError(e?.message === "not-authenticated" ? "" : String(e?.message || e));
    }
  }, [navigate]);

  // ---- generate flow ----
  const onGenerate = useCallback(async () => {
    if (stopRef.current) stopRef.current();
    setGen({ status: "queued", error: "", url: "" });
    try {
      const { jobId } = await startGenerate(data);
      stopRef.current = watchJob(jobId, (job) => {
        if (job.status === "done") {
          stopRef.current && stopRef.current();
          setGen({ status: "done", url: job.docx_url, error: "" });
        } else if (job.status === "error") {
          stopRef.current && stopRef.current();
          setGen({ status: "error", url: "", error: job.error || "" });
        } else {
          setGen((g) => ({ ...g, status: job.status }));
        }
      });
    } catch (e) {
      setGen({ status: "error", url: "", error: String(e?.message || e) });
    }
  }, [data]);

  const onDownload = useCallback(() => downloadFromUrl(gen?.url, data?.nome), [gen, data]);

  // ---- render ----
  if (session === undefined) {
    return <div className="login-wrap"><div className="spinner" /></div>;
  }
  if (!session) return <Login lang={lang} />;

  let body;
  if (screen === "processing") {
    body = <Processing lang={lang} status={parseStatus} error={parseError} fileName={fileName} onRetry={() => navigate("upload")} />;
  } else if (screen === "review") {
    body = <Review data={data} setData={setData} lang={lang} goNext={() => navigate("preview")} />;
  } else if (screen === "preview") {
    body = <Preview data={data} lang={lang} gen={gen} onGenerate={onGenerate} onDownload={onDownload} goBack={() => navigate("review")} />;
  } else {
    body = <Upload lang={lang} onFile={onFile} />;
  }

  const LangToggle = () => (
    <div className="lang-toggle">
      {["pt", "en"].map((l) => (
        <button key={l} className={"lt" + (lang === l ? " on" : "")} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="tb-left"><Logo /></div>
        <nav className="tb-nav">
          <button
            className={"navitem" + (["upload", "processing", "review", "preview"].includes(screen) ? " active" : "")}
            onClick={() => { setData((d) => d); navigate("upload"); }}
          >
            + {T.navUpload}
          </button>
        </nav>
        <div className="tb-right">
          <LangToggle />
          <button className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>{T.signOut}</button>
        </div>
      </header>
      <main className="content">{body}</main>
    </div>
  );
}

import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { I18N } from "../lib/i18n.js";
import Logo from "./Logo.jsx";

export default function Login({ lang }) {
  const T = I18N[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(T.loginFailed);
    setBusy(false);
    // On success, the auth listener in App swaps to the app shell.
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <Logo />
        <div className="login-head">
          <h2>{T.loginTitle}</h2>
          <p className="muted small">{T.loginSub}</p>
        </div>
        {error ? <div className="login-error">{error}</div> : null}
        <div className="login-form">
          <label className="field">
            <span className="field-label">{T.fEmailLogin}</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">{T.fPassword}</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ justifyContent: "center" }}>
            {busy ? T.signingIn : T.signIn}
          </button>
        </div>
      </form>
    </div>
  );
}

/* RecrutaBot — backend API client + Realtime job subscription.

   The backend owns all secrets (Anthropic key, Supabase service role). The
   frontend only:
     - sends the file / revised JSON with the user's Supabase JWT, and
     - watches the `jobs` row over Supabase Realtime for status changes. */
import { supabase } from "./supabase.js";

const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("not-authenticated");
  return { Authorization: `Bearer ${token}` };
}

/** Upload a CV. Returns { jobId }. Backend responds 202 Accepted. */
export async function startParse(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/api/parse`, {
    method: "POST",
    headers: await authHeader(),
    body: fd,
  });
  if (!res.ok) throw new Error(`parse failed: ${res.status}`);
  return res.json(); // { jobId }
}

/** Submit the reviewed JSON to generate the DOCX. Returns { jobId }. */
export async function startGenerate(data) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`generate failed: ${res.status}`);
  return res.json(); // { jobId }
}

/** Polling fallback (used if Realtime is momentarily unavailable). */
export async function getJob(jobId) {
  const res = await fetch(`${BASE}/api/jobs/${jobId}`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`getJob failed: ${res.status}`);
  return res.json();
}

/**
 * Watch a job until it reaches a terminal/expected state.
 * Calls `onChange(job)` on every update. Combines Supabase Realtime with a
 * light polling safety net. Returns an unsubscribe function.
 */
export function watchJob(jobId, onChange) {
  let stopped = false;

  const channel = supabase
    .channel(`job-${jobId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
      (payload) => { if (!stopped) onChange(payload.new); }
    )
    .subscribe();

  // Safety-net poll (every 4s) in case a Realtime event is missed.
  const poll = setInterval(async () => {
    if (stopped) return;
    try {
      const job = await getJob(jobId);
      onChange(job);
    } catch { /* ignore transient errors */ }
  }, 4000);

  return () => {
    stopped = true;
    clearInterval(poll);
    supabase.removeChannel(channel);
  };
}

/** Download a generated DOCX from a (signed) URL with a friendly filename. */
export async function downloadFromUrl(url, name) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (name || "candidato").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  a.href = objUrl;
  a.download = `CV_Padrao_${safe}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
}

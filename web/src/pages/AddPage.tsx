import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { timeAgo } from "../lib/format";
import { detectSource, extractUrl, SOURCE_ICON } from "../lib/source";
import { supabase } from "../lib/supabase";
import type { Job, SourceType } from "../lib/types";

const SOURCE_NAMES: Record<SourceType, string> = { tiktok: "TikTok", instagram: "Instagram", web: "Web page" };

const STATUS: Record<Job["status"], { label: string; cls: string }> = {
  queued: { label: "Queued ⏳", cls: "queued" },
  processing: { label: "Processing…", cls: "processing" },
  done: { label: "Done", cls: "done" },
  failed: { label: "Failed", cls: "failed" },
  not_recipe: { label: "Not a recipe", cls: "failed" },
};

export default function AddPage() {
  const [input, setInput] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const url = extractUrl(input);
  const source = url ? detectSource(url) : null;

  useEffect(() => {
    const load = () =>
      supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30)
        .then(({ data }) => data && setJobs(data as Job[]));
    load();
    const channel = supabase
      .channel("jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, load)
      .subscribe();
    const poll = setInterval(load, 15000); // backup in case realtime drops on mobile
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  const paste = async () => {
    try {
      setInput(await navigator.clipboard.readText());
    } catch {
      setMessage("Couldn't read the clipboard. Long-press the box and choose Paste.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source) return;
    setSubmitting(true);
    setMessage(null);
    const { error } = await supabase.from("jobs").insert({ url, source_type: source });
    setSubmitting(false);
    if (error) setMessage(error.message);
    else {
      setInput("");
      setMessage("Added to the queue. It'll be processed when your Mac is on.");
    }
  };

  const pending = jobs.filter((j) => j.status === "queued").length;

  return (
    <main className="page with-tabbar">
      <header className="list-header">
        <h1>Add a recipe</h1>
        <p className="muted small">Paste a TikTok, Instagram or recipe website link.</p>
      </header>

      <form className="add-form" onSubmit={submit}>
        <div className="input-with-btn">
          <input
            type="url"
            inputMode="url"
            placeholder="https://www.tiktok.com/@…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <button type="button" className="btn" onClick={paste}>Paste</button>
        </div>
        {source && (
          <p className="detected">
            {SOURCE_ICON[source]} Detected: <strong>{SOURCE_NAMES[source]}</strong>
          </p>
        )}
        <button className="btn primary block" disabled={!source || submitting}>
          {submitting ? "Adding…" : "Add recipe"}
        </button>
        {message && <p className="muted small">{message}</p>}
      </form>

      <div className="section-head">
        <h2>Recent</h2>
        {pending > 0 && <span className="muted small">{pending} waiting for your Mac</span>}
      </div>
      {jobs.length === 0 && <p className="muted">Nothing added yet.</p>}
      <ul className="jobs">
        {jobs.map((job) => <JobRow key={job.id} job={job} />)}
      </ul>

      <p className="footer-link">
        <button className="link-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </p>
    </main>
  );
}

function JobRow({ job }: { job: Job }) {
  const [manual, setManual] = useState(job.manual_text ?? "");
  const [open, setOpen] = useState(false);
  const s = STATUS[job.status];
  const canRetry = job.status === "failed" || job.status === "not_recipe";

  const retry = async (withText?: string) => {
    await supabase
      .from("jobs")
      .update({ status: "queued", error: null, ...(withText != null ? { manual_text: withText } : {}) })
      .eq("id", job.id);
    setOpen(false);
  };
  const remove = () => supabase.from("jobs").delete().eq("id", job.id);

  return (
    <li className="job">
      <div className="job-top">
        <span className="job-icon">{SOURCE_ICON[job.source_type]}</span>
        <span className="job-url">{job.kind === "reextract" ? "Re-extract: " : ""}{job.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
        <span className={`status ${s.cls}`}>{s.label}</span>
      </div>
      <div className="job-meta muted small">
        {timeAgo(job.created_at)}
        {job.status === "done" && job.recipe_id && (
          <> · <Link to={`/r/${encodeURIComponent(job.recipe_id)}`}>Open recipe →</Link></>
        )}
      </div>
      {job.error && <p className="job-error">{job.error}</p>}
      {canRetry && (
        <div className="job-actions">
          <button className="btn small" onClick={() => retry()}>Retry</button>
          <button className="btn small" onClick={() => setOpen(!open)}>Paste text instead</button>
          <button className="btn small ghost" onClick={remove}>Remove</button>
        </div>
      )}
      {open && (
        <div className="manual">
          <textarea
            rows={6}
            placeholder="Paste the caption or recipe text here…"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button className="btn primary block" disabled={!manual.trim()} onClick={() => retry(manual.trim())}>
            Use this text
          </button>
        </div>
      )}
    </li>
  );
}

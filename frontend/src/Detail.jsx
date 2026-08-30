import { useEffect, useState } from "react";
import { request } from "./api";
import { label } from "./constants";

const TABS = ["interviews", "notes", "history"];

export function Detail({ id, close, refresh }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("interviews");

  const [note, setNote] = useState("");
  const [round, setRound] = useState("");
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const nextData = await request(`/applications/${id}`);
    setData(nextData);
    return nextData;
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return null;

  async function saveNote(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await request(`/applications/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: note }),
      }).then(({ note: savedNote }) => {
        setData((current) =>
          current
            ? { ...current, notes: [savedNote, ...current.notes] }
            : current
        );
      });
      setNote("");
      try {
        await load();
      } catch (refreshError) {
        console.warn("Note saved, but the detail refresh failed", refreshError);
      }
    } catch (err) {
      setError(err.message || "Could not save that note.");
    } finally {
      setBusy(false);
    }
  }

  async function saveInterview(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await request(`/applications/${id}/interviews`, {
        method: "POST",
        body: JSON.stringify({
          round_name: round,
          scheduled_at: new Date(when).toISOString(),
          location,
        }),
      });
      setRound("");
      setWhen("");
      setLocation("");
      await load();
      refresh();
    } catch (err) {
      setError(err.message || "Could not schedule that interview.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay">
      <section className="detail-drawer">
        <header className="drawer-header">
          <h2>{data.application.job_title}</h2>
          <p>
            {data.application.company_name} · {data.application.status}
          </p>
          <button className="close" onClick={close}>
            ×
          </button>
        </header>

        <nav className="detail-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={tab === t ? "tab-active" : ""}
              onClick={() => setTab(t)}
            >
              {label(t)}
            </button>
          ))}
        </nav>

        <section className="drawer-body">
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}

          {tab === "interviews" && (
            <>
              <form className="compact-form" onSubmit={saveInterview}>
                <h3>Schedule an interview</h3>
                <input
                  placeholder="Round name"
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  required
                />
                <div className="field-row">
                  <input
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    required
                  />
                  <input
                    placeholder="Location or link"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <button disabled={busy}>{busy ? "Scheduling…" : "Schedule reminder"}</button>
              </form>

              {data.interviews.length === 0 && (
                <p className="empty-copy">No interviews scheduled yet.</p>
              )}

              {data.interviews.map((interview) => (
                <article className="detail-item" key={interview.id}>
                  <b>{interview.round_name}</b>
                  <small>{new Date(interview.scheduled_at).toLocaleString()}</small>
                </article>
              ))}
            </>
          )}

          {tab === "notes" && (
            <>
              <form className="compact-form" onSubmit={saveNote}>
                <textarea
                  placeholder="Recruiter details, preparation notes…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                />
                <button disabled={busy}>{busy ? "Saving…" : "Save note"}</button>
              </form>

              {data.notes.length === 0 && (
                <p className="empty-copy">No notes yet.</p>
              )}

              {data.notes.map((n) => (
                <article className="detail-item" key={n.id}>
                  {n.content}
                  <small>{new Date(n.created_at).toLocaleDateString()}</small>
                </article>
              ))}
            </>
          )}

          {tab === "history" &&
            (data.history.length === 0 ? (
              <p className="empty-copy">No status changes yet.</p>
            ) : (
              data.history.map((h) => (
                <article className="detail-item" key={h.id}>
                  <b>
                    {h.from_status || "Created"} → {h.to_status}
                  </b>
                  <small>{new Date(h.changed_at).toLocaleString()}</small>
                </article>
              ))
            ))}
        </section>
      </section>
    </div>
  );
}

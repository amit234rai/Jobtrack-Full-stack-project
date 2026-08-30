import { useEffect, useState, useRef, useCallback } from "react";
import { request, token } from "./api";
import { stages, label } from "./constants";
import { Auth } from "./Auth";
import { Detail } from "./Detail";

export function App() {
  const [apps, setApps] = useState([]);
  const [dash, setDash] = useState({});
  const [view, setView] = useState("overview");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loadError, setLoadError] = useState("");
  const [openStatusFor, setOpenStatusFor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(!token());
  const debounceRef = useRef(null);

  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!token()) {
      setAuthChecked(true);
      return;
    }
    request("/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => {
        localStorage.removeItem("jobtrack_token");
        setUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const load = useCallback(() => {
    Promise.all([
      request(`/applications?limit=100&page=${page}&search=${encodeURIComponent(debouncedSearch)}`),
      request("/dashboard"),
    ])
      .then(([apps, dashboard]) => {
        setApps(apps.applications);
        setPagination(apps.pagination);
        setDash(dashboard.dashboard);
        setLoadError("");
      })
      .catch((err) => {
        setLoadError(err.message || "Could not refresh your board. Please try again.");
      });
  }, [debouncedSearch, page]);

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, user]);

  function handleLoggedIn(session) {
    localStorage.setItem("jobtrack_token", session.token);
    setUser(session.user);
    setAuthChecked(true);
  }

  if (!authChecked) {
    return (
      <div className="shell">
        <aside>
          <span className="brand">JobTrack</span>
        </aside>
        <main className="workspace">
          <p>Loading…</p>
        </main>
      </div>
    );
  }

  if (!user) return <Auth onLoggedIn={handleLoggedIn} />;

  async function createRole(e) {
    e.preventDefault();
    setFormError("");
    try {
      await request("/applications/with-job", {
        method: "POST",
        body: JSON.stringify({ title, company_name: company }),
      });
      setAddOpen(false);
      setTitle("");
      setCompany("");
      load();
    } catch (err) {
      setFormError(err.message || "Could not add that role.");
    }
  }

  async function moveStatus(applicationId, status) {
    try {
      await request(`/applications/${applicationId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOpenStatusFor(null);
      load();
    } catch (err) {
      setFormError(err.message || "Could not update that status.");
    }
  }

  function signOut() {
    localStorage.removeItem("jobtrack_token");
    location.reload();
  }

  return (
    <div className="shell">
      <aside>
        <span className="brand">JobTrack</span>
        <nav>
          {["overview", "applications", "insights"].map((v) => (
            <button
              key={v}
              className={`nav-btn ${view === v ? "active" : ""}`}
              onClick={() => setView(v)}
            >
              {label(v)}
            </button>
          ))}
          <button className="nav-btn signout" onClick={signOut}>
            ↪ Sign out
          </button>
        </nav>
      </aside>

      <main className="workspace">
        <header>
          <div>
            <p className="eyebrow">JOB SEARCH COMMAND CENTER</p>
            <h1>{label(view)}</h1>
          </div>
          <button onClick={() => { setFormError(""); setAddOpen(true); }}>+ Add a role</button>
        </header>

        {loadError && <p className="notice error" role="alert">{loadError}</p>}

        {view === "overview" && (
          <>
            <section className="metrics">
              {stages.map((s) => (
                <div key={s}>
                  <small>{label(s)}</small>
                  <strong>{dash.counts?.[s] || 0}</strong>
                </div>
              ))}
            </section>

            <h3>Interview-stage roles</h3>
            <section className="board">
              {apps
                .filter((a) => a.status === "interview")
                .map((a) => (
                  <article className="clickable" key={a.id} onClick={() => setSelected(a.id)}>
                    <b>{a.job_title}</b>
                    <span>{a.company_name}</span>
                    <small>Open to schedule interview</small>
                  </article>
                ))}
            </section>

            <section className="dashboard-lists">
              <div className="dashboard-panel">
                <h3>Recent applications</h3>
                {dash.recent?.length ? (
                  dash.recent.map((application) => (
                    <article
                      className="clickable dashboard-item"
                      key={application.id}
                      onClick={() => setSelected(application.id)}
                    >
                      <b>{application.title}</b>
                      <span>{application.company_name || "Company not specified"}</span>
                      <small>{label(application.status)}</small>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">No applications yet.</p>
                )}
              </div>

              <div className="dashboard-panel">
                <h3>Upcoming interviews</h3>
                {dash.upcoming_interviews?.length ? (
                  dash.upcoming_interviews.map((interview) => (
                    <article className="dashboard-item" key={interview.id}>
                      <b>{interview.title}</b>
                      <span>{interview.company_name || "Company not specified"}</span>
                      <small>
                        {interview.round_name} · {new Date(interview.scheduled_at).toLocaleString()}
                      </small>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">No upcoming interviews.</p>
                )}
              </div>
            </section>
            {pagination.total_pages > 1 && (
              <nav className="pagination" aria-label="Application pages">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                <span>Page {pagination.page} of {pagination.total_pages} ({pagination.total} roles)</span>
                <button disabled={page === pagination.total_pages} onClick={() => setPage(page + 1)}>Next</button>
              </nav>
            )}
          </>
        )}

        {view === "applications" && (
          <>
            <div className="toolbar">
              <input
                placeholder="Search company or role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span>{apps.length} roles</span>
            </div>

            <section className="board">
              {stages.map((stage) => (
                <div className="column" key={stage}>
                  <h3>{label(stage)}</h3>
                  {apps
                    .filter((a) => a.status === stage)
                    .map((a) => (
                      <article className="clickable" key={a.id} onClick={() => setSelected(a.id)}>
                        <b>{a.job_title}</b>
                        <span>{a.company_name}</span>
                        <div className="status-menu" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="status-trigger"
                            aria-haspopup="menu"
                            aria-expanded={openStatusFor === a.id}
                            onClick={() => setOpenStatusFor(openStatusFor === a.id ? null : a.id)}
                          >
                            <span>{label(a.status)}</span>
                            <span aria-hidden="true">⌄</span>
                          </button>
                          {openStatusFor === a.id && (
                            <div className="status-options" role="menu">
                              {stages.map((s) => (
                                <button
                                  type="button"
                                  key={s}
                                  role="menuitem"
                                  className={s === a.status ? "selected" : ""}
                                  onClick={() => moveStatus(a.id, s)}
                                >
                                  {label(s)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                </div>
              ))}
            </section>
          </>
        )}

        {view === "insights" && (
          <section className="metrics">
            {stages.map((s) => (
              <div key={s}>
                <small>{label(s)}</small>
                <strong>{dash.counts?.[s] || 0}</strong>
              </div>
            ))}
          </section>
        )}
      </main>

      {addOpen && (
        <div className="overlay">
          <form className="modal" onSubmit={createRole}>
            <h2>Add a role</h2>
            <input
              placeholder="Role title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <input
              placeholder="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />
            {formError && (
              <p className="notice error" role="alert">
                {formError}
              </p>
            )}
            <div>
              <button className="secondary" type="button" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button>Save to board</button>
            </div>
          </form>
        </div>
      )}

      {selected && <Detail id={selected} close={() => setSelected(null)} refresh={load} />}
    </div>
  );
}

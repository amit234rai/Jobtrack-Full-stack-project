import { useState } from "react";
import { request } from "./api";

function firstError(err) {
  if (err.fields) {
    const value = Object.values(err.fields).flat()[0];
    if (value) return String(value);
  }
  return err.message || "Something went wrong. Try again.";
}

export function Auth({ onLoggedIn }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function changeMode(next) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);

    try {
      if (mode === "forgot") {
        const data = await request("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setMode("reset");
        setError("");
        setMessage(data.message);
        return;
      }

      if (mode === "reset") {
        const data = await request("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ email, otp, password }),
        });
        setMode("login");
        setOtp("");
        setPassword("");
        setError("");
        setMessage(data.message);
        return;
      }

      const body =
        mode === "signup"
          ? { email, password, full_name: name }
          : { email, password };

      const data = await request(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!data?.token || !data?.user) {
        throw new Error("Could not complete sign-in. Please try again.");
      }

      onLoggedIn(data);
    } catch (err) {
      setError(firstError(err));
    } finally {
      setBusy(false);
    }
  }

  const heading =
    mode === "forgot"
      ? "Reset password"
      : mode === "reset"
      ? "Enter your reset code"
      : mode === "signup"
      ? "Create your workspace"
      : "Welcome back";

  const submitLabel =
    mode === "forgot"
      ? "Email reset code"
      : mode === "reset"
      ? "Reset password"
      : mode === "signup"
      ? "Create account"
      : "Sign in";

  const busyLabel =
    mode === "forgot"
      ? "Sending code…"
      : mode === "reset"
      ? "Resetting…"
      : mode === "signup"
      ? "Creating account…"
      : "Signing in…";

  return (
    <main className="auth">
      <section>
        <span className="brand">JobTrack</span>
        <h1>Your job search, with momentum.</h1>
        <p>Turn applications into a calm, focused hiring pipeline.</p>
      </section>

      <form onSubmit={submit} aria-busy={busy}>
        <h2>{heading}</h2>

        {mode === "signup" && (
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={busy}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={busy}
        />

        {mode === "reset" && (
          <input
            placeholder="6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            disabled={busy}
          />
        )}

        {mode !== "forgot" && (
          <input
            type="password"
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
        )}

        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice success" role="status">
            {message}
          </p>
        )}

        <button type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>

        {mode === "login" && (
          <button className="link" type="button" disabled={busy} onClick={() => changeMode("forgot")}>
            Forgot password?
          </button>
        )}

        <button
          className="link"
          type="button"
          disabled={busy}
          onClick={() => changeMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </form>
    </main>
  );
}

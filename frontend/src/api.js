const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const token = () => localStorage.getItem("jobtrack_token");

export async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...options.headers,
    },
  });

  let payload = {};
  const raw = await response.text();
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { error: raw };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/")) {
      localStorage.removeItem("jobtrack_token");
      window.location.reload();
    }

    const error = new Error(
      typeof payload.error === "string" ? payload.error : "Please correct the highlighted fields"
    );
    error.fields = payload.details && typeof payload.details === "object" ? payload.details : null;
    throw error;
  }

  return payload.data || payload;
}

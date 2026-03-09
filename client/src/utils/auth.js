// client/src/utils/auth.js
const KEY = "bv_session_v1";

export function saveSession({ user }) {
  const payload = {
    user: {
      id: user?.id || user?._id || "",
      email: user?.email || "",
      matric: (user?.matric || "").toUpperCase(),
      role: user?.role || "voter",
    },
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.user?.matric) {
      localStorage.removeItem(KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function getToken() {
  return "";
}

export function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export function csrfHeaders() {
  const token = getCsrfToken();
  return token ? { "X-CSRF-Token": token } : {};
}

export function clearSession() {
  localStorage.removeItem(KEY);
  fetch("http://localhost:5000/api/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

export function isLoggedIn() {
  return !!getSession();
}

export function isAdmin() {
  const s = getSession();
  return s?.user?.role === "admin";
}

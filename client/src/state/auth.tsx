import React, { createContext, useContext, useMemo, useState } from "react";

export type User = {
  matric: string;
  email: string;
};

type AuthCtx = {
  user: User | null;
  register: (u: User & { password: string }) => { ok: boolean; message: string };
  login: (email: string, password: string) => { ok: boolean; message: string };
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

function keyUsers() { return "bv_users_v1"; }
function keySession() { return "bv_session_v1"; }

type StoredUser = User & { password: string };

function readUsers(): StoredUser[] {
  try { return JSON.parse(localStorage.getItem(keyUsers()) || "[]"); } catch { return []; }
}
function writeUsers(users: StoredUser[]) {
  localStorage.setItem(keyUsers(), JSON.stringify(users));
}

function readSession(): User | null {
  try { return JSON.parse(localStorage.getItem(keySession()) || "null"); } catch { return null; }
}
function writeSession(u: User | null) {
  if (!u) localStorage.removeItem(keySession());
  else localStorage.setItem(keySession(), JSON.stringify(u));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readSession());

  const api = useMemo<AuthCtx>(() => ({
    user,
    register: (u) => {
      const users = readUsers();
      if (!u.matric.trim()) return { ok: false, message: "Matric number required" };
      if (!u.email.trim()) return { ok: false, message: "Email required" };
      if (!u.password.trim()) return { ok: false, message: "Password required" };
      if (users.some(x => x.email.toLowerCase() === u.email.toLowerCase())) {
        return { ok: false, message: "Email already registered" };
      }
      if (users.some(x => x.matric.toLowerCase() === u.matric.toLowerCase())) {
        return { ok: false, message: "Matric already registered" };
      }
      users.push({ matric: u.matric.trim(), email: u.email.trim(), password: u.password });
      writeUsers(users);
      return { ok: true, message: "Registered. Please login." };
    },
    login: (email, password) => {
      const users = readUsers();
      const found = users.find(x => x.email.toLowerCase() === email.toLowerCase());
      if (!found) return { ok: false, message: "No account for this email" };
      if (found.password !== password) return { ok: false, message: "Wrong password" };
      const session: User = { matric: found.matric, email: found.email };
      setUser(session);
      writeSession(session);
      return { ok: true, message: "Logged in" };
    },
    logout: () => {
      setUser(null);
      writeSession(null);
    },
  }), [user]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import "../styles/shell.css";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="logoDot" />
          <div>
            <div className="brandTitle">BlockVote</div>
            <div className="brandSub">{title}</div>
          </div>
        </div>

        <nav className="nav">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/vote">Vote</Link>
          <Link to="/verify">Verify</Link>
          <Link to="/admin">Admin</Link>
          <Link to="/feedback">Feedback</Link>
        </nav>

        <div className="right">
          {user && (
            <div className="userchip">
              <div className="dot" />
              <div className="u">
                <div className="u1">{user.matric}</div>
                <div className="u2">{user.email}</div>
              </div>
            </div>
          )}
          <button
            className="btn ghost"
            onClick={() => { logout(); nav("/"); }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="content">{children}</main>
    </div>
  );
}
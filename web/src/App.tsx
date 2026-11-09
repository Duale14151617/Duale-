import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { auth, get, revokeSessions } from "./api";
import { Me, MeContext, isPlatform } from "./hooks";
import { Login, Recover } from "./pages/Auth";
import Security from "./pages/Security";
import Companies from "./pages/Companies";
import Company from "./pages/Company";
import Admin from "./pages/Admin";
import Notifications from "./pages/Notifications";

const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
  bell: "M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 018 0v4",
};
const Icon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
);
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

function Shell({ me, reload }: { me: Me; reload: () => void }) {
  const [phase, setPhase] = useState<"idle" | "ask" | "working">("idle");
  const signOut = () => {
    setPhase("working");
    revokeSessions();   // fire-and-forget: the server finishes this even after we leave the page
    auth.set(null);
    setTimeout(() => window.location.assign("/login"), 1100);
  };
  const links = [
    { to: "/companies", label: "Dashboard", short: "Home", icon: "home" },
    ...(isPlatform(me) ? [{ to: "/admin", label: "Platform admin", short: "Admin", icon: "shield" }] : []),
    { to: "/notifications", label: "Notifications", short: "Alerts", icon: "bell" },
    { to: "/security", label: "Security", short: "Security", icon: "lock" },
  ];
  return (
    <MeContext.Provider value={{ me, reload }}>
      <div className="app">
        <aside className="side">
          <div className="brand"><span className="logo">D</span><span>Duale <b>BuildLink</b></span></div>
          <nav>
            {links.map((l) => <NavLink key={l.to} to={l.to}><Icon name={l.icon} /><span>{l.label}</span></NavLink>)}
          </nav>
          <div className="who">
            <span className="avatar">{initials(me.displayName)}</span>
            <span className="meta"><b>{me.displayName}</b><span>{me.email}</span></span>
            <button className="signout" onClick={() => setPhase("ask")} title="Signs out on every device">Sign out</button>
          </div>
        </aside>
        <div className="body">
          <header className="mobilebar">
            <div className="brand"><span className="logo">D</span><span>Duale <b>BuildLink</b></span></div>
            <button className="signout" onClick={() => setPhase("ask")} title="Signs out on every device">Sign out</button>
          </header>
          <main>
            <Routes>
              <Route path="/companies" element={<Companies />} />
              <Route path="/companies/:id/*" element={<Company />} />
              <Route path="/admin/*" element={isPlatform(me) ? <Admin /> : <Navigate to="/companies" />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/security" element={<Security />} />
              <Route path="*" element={<Navigate to="/companies" />} />
            </Routes>
            {me.isTechnician && <p className="muted">You also have a technician profile. Technicians use the mobile app for jobs and documents.</p>}
          </main>
        </div>
        {phase !== "idle" && (
          <div className="modal-backdrop" onClick={() => phase === "ask" && setPhase("idle")}>
            <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              {phase === "ask" ? (
                <>
                  <h2>Sign out?</h2>
                  <p className="muted">Are you sure you want to sign out? This signs you out on every device.</p>
                  <div className="row modal-actions">
                    <button className="ghost" onClick={() => setPhase("idle")}>Cancel</button>
                    <button className="danger" onClick={signOut}>Yes, sign out</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="spinner" aria-hidden="true" />
                  <h2>Signing you out…</h2>
                  <p className="muted">See you soon.</p>
                  <div className="progress"><span /></div>
                </>
              )}
            </div>
          </div>
        )}
        <nav className="tabbar">
          {links.map((l) => <NavLink key={l.to} to={l.to}><Icon name={l.icon} /><span>{l.short}</span></NavLink>)}
        </nav>
      </div>
    </MeContext.Provider>
  );
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "anon" | "ready">(auth.token ? "loading" : "anon");
  const load = () => get<Me>("/me").then((m) => { setMe(m); setState("ready"); }).catch(() => { auth.set(null); setState("anon"); });
  useEffect(() => { if (auth.token) load(); }, []);

  if (state === "loading") return <main><p>Loading…</p></main>;
  if (state === "anon" || !me) {
    return (
      <Routes>
        <Route path="/login" element={<Login onDone={() => { setState("loading"); load(); }} />} />
        <Route path="/recover" element={<Recover />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }
  return <Shell me={me} reload={load} />;
}

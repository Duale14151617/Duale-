import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { auth, get, post } from "./api";
import { Me, MeContext, isPlatform } from "./hooks";
import { Login, Recover } from "./pages/Auth";
import Security from "./pages/Security";
import Companies from "./pages/Companies";
import Company from "./pages/Company";
import Admin from "./pages/Admin";
import Notifications from "./pages/Notifications";

function Shell({ me, reload }: { me: Me; reload: () => void }) {
  const nav = useNavigate();
  const out = async () => { try { await post("/auth/logout-all"); } catch { /* token may already be invalid */ } auth.set(null); nav("/login"); };
  return (
    <MeContext.Provider value={{ me, reload }}>
      <header className="top">
        <span className="brand">Duale <b>BuildLink</b></span>
        <nav>
          <NavLink to="/companies">Companies</NavLink>
          {isPlatform(me) && <NavLink to="/admin">Platform admin</NavLink>}
          <NavLink to="/notifications">Notifications</NavLink>
          <NavLink to="/security">Security</NavLink>
        </nav>
        <span className="muted">{me.displayName}</span>
        <button className="ghost" onClick={out} title="Signs out on every device">Sign out</button>
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


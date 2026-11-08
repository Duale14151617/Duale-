import { useState } from "react";
import { post } from "../../api";
import { Msg, Status, useAction, useLoad, when } from "../../hooks";

export default function Technicians({ companyId }: { companyId: string }) {
  const { data, error, reload } = useLoad<any[]>(`/companies/${companyId}/relationships`);
  const [email, setEmail] = useState(""); const [type, setType] = useState("Independent");
  const a = useAction();
  const act = async (id: string, action: string) => { if (await a.run(() => post(`/companies/${companyId}/relationships/${id}/action`, { action }))) reload(); };
  return (
    <>
      <div className="card">
        <table>
          <thead><tr><th>Technician</th><th>Type</th><th>Status</th><th>Valid from</th><th></th></tr></thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id}><td>{r.technician}</td><td>{r.type}</td><td><Status value={r.status} /></td><td>{when(r.validFrom)}</td>
                <td className="row">
                  {r.status === "Active" && <button className="ghost" onClick={() => act(r.id, "suspend")}>Suspend</button>}
                  {r.status === "Suspended" && <button className="ghost" onClick={() => act(r.id, "reactivate")}>Reactivate</button>}
                  {["Invited", "Active", "Suspended"].includes(r.status) && <button className="ghost" onClick={() => act(r.id, "end")}>End</button>}
                </td></tr>
            ))}
          </tbody>
        </table>
        {error && <div className="error">{error}</div>}
      </div>
      <form className="card" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => post(`/companies/${companyId}/relationships`, { technicianEmail: email, type }), "Invitation sent.")) { setEmail(""); reload(); } }}>
        <h2>Invite a technician</h2>
        <p className="muted">They need a technician profile with at least one verified skill.</p>
        <div className="row">
          <label>Technician email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Relationship<select value={type} onChange={(e) => setType(e.target.value)}><option>Independent</option><option>Employed</option></select></label>
          <button className="primary" disabled={a.busy}>Invite</button>
        </div>
        <Msg error={a.error} notice={a.notice} />
      </form>
    </>
  );
}

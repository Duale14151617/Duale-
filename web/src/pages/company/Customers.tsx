import { useState } from "react";
import { post } from "../../api";
import { Msg, useAction, useLoad } from "../../hooks";

export default function Customers({ companyId }: { companyId: string }) {
  const [q, setQ] = useState("");
  const { data, error, reload } = useLoad<any[]>(`/companies/${companyId}/customers?q=${encodeURIComponent(q)}`);
  const [open, setOpen] = useState<string | null>(null);
  const detail = useLoad<any>(open ? `/companies/${companyId}/customers/${open}` : null);
  const areas = useLoad<any[]>("/catalog/service-areas");
  const [c, setC] = useState({ name: "", phone: "", email: "" });
  const [l, setL] = useState({ label: "", address: "", serviceAreaId: "" });
  const a = useAction();
  return (
    <>
      <div className="card">
        <label>Search<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="name or phone" /></label>
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th></th></tr></thead>
          <tbody>{data?.map((x) => <tr key={x.id}><td>{x.name}</td><td>{x.phone}</td><td><button className="ghost" onClick={() => setOpen(open === x.id ? null : x.id)}>Locations</button></td></tr>)}</tbody>
        </table>
        {error && <div className="error">{error}</div>}
        {open && detail.data && (
          <div className="card">
            <b>{detail.data.name}</b>
            <ul>{detail.data.locations.map((x: any) => <li key={x.id}>{x.label}: {x.address}</li>)}</ul>
            <div className="row">
              <label>Label<input value={l.label} onChange={(e) => setL({ ...l, label: e.target.value })} /></label>
              <label>Address<input value={l.address} onChange={(e) => setL({ ...l, address: e.target.value })} /></label>
              <label>Service area<select value={l.serviceAreaId} onChange={(e) => setL({ ...l, serviceAreaId: e.target.value })}><option value="">(none)</option>{areas.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <button disabled={a.busy} onClick={async () => { if (await a.run(() => post(`/companies/${companyId}/customers/${open}/locations`, { ...l, serviceAreaId: l.serviceAreaId || null }), "Location added.")) { setL({ label: "", address: "", serviceAreaId: "" }); detail.reload(); } }}>Add location</button>
            </div>
          </div>
        )}
      </div>
      <form className="card" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => post(`/companies/${companyId}/customers`, c), "Customer added.")) { setC({ name: "", phone: "", email: "" }); reload(); } }}>
        <h2>New customer</h2>
        <div className="row">
          <label>Name<input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} required /></label>
          <label>Phone<input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} required /></label>
          <label>Email<input type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></label>
          <button className="primary" disabled={a.busy}>Add</button>
        </div>
        <Msg error={a.error} notice={a.notice} />
      </form>
    </>
  );
}

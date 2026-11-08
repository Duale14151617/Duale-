import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { post } from "../api";
import { Msg, Status, useAction, useMe } from "../hooks";

export default function Companies() {
  const { me, reload } = useMe();
  const [f, setF] = useState({ displayName: "", businessCategory: "", contactEmail: "", contactPhone: "", registrationRef: "" });
  const a = useAction();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const create = async (e: FormEvent) => { e.preventDefault(); if (await a.run(() => post("/companies", f), "Submitted for review.")) reload(); };
  return (
    <>
      <h1>Your companies</h1>
      {me.companies.length === 0 && <p className="muted">You are not part of a company yet.</p>}
      {me.companies.map((c) => (
        <div className="card" key={c.id}>
          <Link to={`/companies/${c.id}`}><b>{c.displayName}</b></Link> <Status value={c.verification} />
          <div className="muted">{c.roles.join(", ")}</div>
        </div>
      ))}
      <form className="card" onSubmit={create}>
        <h2>Register a company</h2>
        <div className="row">
          <label>Name<input value={f.displayName} onChange={set("displayName")} required /></label>
          <label>Business category<input value={f.businessCategory} onChange={set("businessCategory")} required /></label>
          <label>Contact email<input type="email" value={f.contactEmail} onChange={set("contactEmail")} required /></label>
          <label>Phone<input value={f.contactPhone} onChange={set("contactPhone")} /></label>
          <label>Registration reference<input value={f.registrationRef} onChange={set("registrationRef")} /></label>
        </div>
        <Msg error={a.error} notice={a.notice} />
        <button className="primary" disabled={a.busy}>Submit for verification</button>
      </form>
    </>
  );
}

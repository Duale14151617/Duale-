import { useState } from "react";
import { post } from "../api";
import { Msg, useAction } from "../hooks";
import { useT } from "../i18n";

// Email or phone verification: ask for a code, then confirm it. If the server has no email/SMS provider yet it says so (503).
export default function VerifyBox({ channel, verified, onVerified }: { channel: "email" | "phone"; verified: boolean; onVerified: () => void }) {
  const { t } = useT();
  const [sent, setSent] = useState(false); const [code, setCode] = useState("");
  const a = useAction();
  const label = channel === "email" ? t("Email") : t("Phone");
  if (verified) return <p>✓ {label}: <b>{t("Verified")}</b></p>;
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ marginBottom: 4 }}>{label}: <b>{t("Not verified")}</b></p>
      {!sent ? (
        <button type="button" className="ghost" disabled={a.busy} onClick={async () => { if (await a.run(() => post(`/me/verify/${channel}/request`))) setSent(true); }}>{t("Send code")}</button>
      ) : (
        <div className="row">
          <label>{t("Code")}<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="one-time-code" /></label>
          <button type="button" className="primary" disabled={a.busy || code.trim().length < 6} onClick={async () => { if (await a.run(() => post(`/me/verify/${channel}/confirm`, { code: code.trim() }))) onVerified(); }}>{t("Confirm")}</button>
        </div>
      )}
      <Msg error={a.error} />
    </div>
  );
}

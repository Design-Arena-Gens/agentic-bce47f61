"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type Recipient = {
  phone: string;
};

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  // Basic heuristic: allow leading +, otherwise digits only; length 8..15 for E.164-like
  const cleaned = digits.startsWith("+") ? digits : digits.replace(/\D/g, "");
  const numeric = cleaned.replace(/\+/g, "");
  if (numeric.length < 8 || numeric.length > 15) return null;
  return numeric.startsWith("+") ? numeric : numeric; // return without + to satisfy wa.me
}

function parseNumbers(text: string): Recipient[] {
  const candidates = text
    .split(/[\n,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = new Set<string>();
  const recipients: Recipient[] = [];
  for (const c of candidates) {
    const p = normalizePhone(c);
    if (p && !unique.has(p)) {
      unique.add(p);
      recipients.push({ phone: p });
    }
  }
  return recipients;
}

function makeWhatsAppLink(phone: string, message: string): string {
  const text = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${text}`;
}

export default function Page() {
  const [rawNumbers, setRawNumbers] = useState("");
  const [message, setMessage] = useState("");
  const [delayMs, setDelayMs] = useState(1200);
  const [batchSize, setBatchSize] = useState(10);
  const [sending, setSending] = useState(false);
  const [useApi, setUseApi] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const recipients = useMemo(() => parseNumbers(rawNumbers), [rawNumbers]);

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    // Accept CSV or TXT: read all tokens as numbers
    const recips = parseNumbers(text);
    const joined = recips.map((r) => r.phone).join("\n");
    setRawNumbers((prev) => (prev ? prev + "\n" + joined : joined));
  }, []);

  const openLinks = useCallback(async () => {
    if (!message || recipients.length === 0) return;
    setSending(true);
    try {
      if (useApi) {
        // Attempt server-side send; falls back with error if not configured
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: recipients.map((r) => r.phone),
            message,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data?.error || "Server sending failed");
        } else {
          alert(`Queued ${data.count} messages via API`);
        }
        return;
      }

      // Client-side open wa.me links in controlled batches
      const toOpen = recipients.slice(0); // copy
      let index = 0;
      const openNextBatch = () => {
        const batch = toOpen.slice(index, index + batchSize);
        for (const r of batch) {
          const url = makeWhatsAppLink(r.phone, message);
          window.open(url, "_blank");
        }
        index += batchSize;
        if (index < toOpen.length) {
          setTimeout(openNextBatch, delayMs);
        }
      };
      openNextBatch();
    } finally {
      setSending(false);
    }
  }, [batchSize, delayMs, message, recipients, useApi]);

  const exportLinks = useCallback(() => {
    const lines = recipients.map((r) => makeWhatsAppLink(r.phone, message));
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "whatsapp_links.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [recipients, message]);

  const sample = `+14155552671\n+5511999999999\n447911123456`;

  return (
    <div className="container">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="h1">WhatsApp Massager</h1>
        <span className="badge">Client-side Link Generator</span>
      </div>
      <p className="muted">Paste or upload a list of phone numbers and compose a message. This tool generates WhatsApp chat links (no credentials required). Optionally, if server credentials are configured, you can send via API.</p>

      <div className="row" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="flex" style={{ justifyContent: "space-between" }}>
            <label>Recipients</label>
            <button className="ghost" onClick={() => setRawNumbers(sample)}>Load sample</button>
          </div>
          <textarea
            rows={10}
            placeholder={"One per line, or comma-separated. E.164 numbers recommended (e.g., +14155552671)."}
            value={rawNumbers}
            onChange={(e) => setRawNumbers(e.target.value)}
          />
          <div className="flex" style={{ marginTop: 8 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.currentTarget.value = "";
              }}
            />
            <small>Upload .csv or .txt containing phone numbers</small>
          </div>
          <hr />
          <label>Message</label>
          <textarea
            rows={6}
            placeholder={"Type your message here"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex" style={{ marginTop: 8 }}>
            <div>
              <label>Batch size</label>
              <input type="number" value={batchSize} min={1} max={50} onChange={(e) => setBatchSize(Number(e.target.value || 1))} />
            </div>
            <div>
              <label>Delay between batches (ms)</label>
              <input type="number" value={delayMs} min={200} step={100} onChange={(e) => setDelayMs(Number(e.target.value || 1000))} />
            </div>
            <div className="flex" style={{ marginTop: 8 }}>
              <input id="useApi" type="checkbox" checked={useApi} onChange={(e) => setUseApi(e.target.checked)} />
              <label htmlFor="useApi">Send via API (if configured)</label>
            </div>
          </div>
          <div className="flex" style={{ marginTop: 12 }}>
            <button onClick={openLinks} disabled={sending || !message || recipients.length === 0}>
              {useApi ? "Send via API" : "Open WhatsApp Chats"}
            </button>
            <button className="secondary" onClick={exportLinks} disabled={!message || recipients.length === 0}>Export Links</button>
            <small>{recipients.length} recipient(s) parsed</small>
          </div>
        </div>

        <div className="card">
          <label>Preview</label>
          <div className="list">
            {recipients.slice(0, 100).map((r) => (
              <div key={r.phone} className="flex" style={{ justifyContent: "space-between" }}>
                <span>{r.phone}</span>
                <a href={makeWhatsAppLink(r.phone, message)} target="_blank" rel="noreferrer">Open</a>
              </div>
            ))}
            {recipients.length > 100 && <small>?and {recipients.length - 100} more</small>}
          </div>
          <hr />
          <label>Tips</label>
          <ul>
            <li>Ensure numbers are in international format (country code first).</li>
            <li>Opening many tabs may be blocked by your browser. Adjust batch size.</li>
            <li>API sending requires environment variables configured on the server.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

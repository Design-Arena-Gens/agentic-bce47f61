import { NextRequest, NextResponse } from "next/server";

// Optional server-side sending using Meta's WhatsApp Cloud API
// Set these env vars in Vercel for production use
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN; // Permanent token or app token
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID; // From WhatsApp Business settings

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const recipients: string[] = body?.recipients || [];
  const message: string = body?.message || "";

  if (!Array.isArray(recipients) || recipients.length === 0 || !message) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    return NextResponse.json({ error: "Server not configured for API sending" }, { status: 501 });
  }

  // Send sequentially to avoid rate spikes; in real use add retries/backoff
  const results: Array<{ to: string; ok: boolean; id?: string; error?: unknown }> = [];
  for (const to of recipients) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        results.push({ to, ok: false, error: json });
      } else {
        results.push({ to, ok: true, id: json?.messages?.[0]?.id });
      }
    } catch (err) {
      results.push({ to, ok: false, error: String(err) });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ count: okCount, results });
}

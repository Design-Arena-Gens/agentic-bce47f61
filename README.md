# WhatsApp Massager

A minimal web app to generate WhatsApp chat links for many recipients, and optionally send via the WhatsApp Cloud API if configured.

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build && npm start
```

## Environment (optional for API sending)

- `WHATSAPP_ACCESS_TOKEN` – Meta WhatsApp Cloud API token
- `WHATSAPP_PHONE_NUMBER_ID` – Your WhatsApp Business phone number ID

If these are not set, the app still works in client-side mode generating `wa.me` links.

# n8n workflow: SnapSort – classify screenshot

SnapSort can hand its AI step to n8n. The phone sends a downscaled screenshot to an n8n webhook; n8n asks Claude what it is and answers with the category, a short title, an expiry date and whether it looks important. The API key lives in n8n, not on the phone.

```
Webhook (POST) → Claude reads the screenshot (HTTP Request) → Check the answer (Code) → Respond to Webhook
```

## Set up (about 5 minutes)

1. In n8n: **Workflows → Import from file** → `snapsort-classify.json`.
2. Open *Claude reads the screenshot* → Credential → **Create new → Header Auth**: name `x-api-key`, value your Anthropic API key.
3. **Activate** the workflow and copy the *Production URL* of the webhook node (ends in `/webhook/snapsort-classify`).
4. In SnapSort: **Settings → AI sorting** → turn it on → paste the URL into **n8n webhook URL**.

## Contract

Request (JSON): `{ "image_base64": "...", "media_type": "image/jpeg", "language": "ja" | "en", "today": "YYYY-MM-DD" }`

Response (JSON): `{ "category": "ticket|coupon|shopping|receipt|chat|map|info|tech|other", "title": "...", "keywords": "...", "expires_on": "YYYY-MM-DD" | null, "important": false }`

The app validates the answer again, so a broken workflow can never put bad data into the cleanup engine.

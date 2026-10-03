# Live WhatsApp Demo Diagnostic

Diagnostic date: 2026-08-11

## Scope

This is an inspection-only diagnostic. No client content, project flow, media, buttons, or automation behavior was changed. Temporary, safe POST webhook diagnostics were added without logging request bodies, customer data, or credentials.

## Findings

- `.env` exists in the project root, dotenv is loaded by the application, and every required environment variable is configured.
- `.env` is ignored by Git.
- `npm run typecheck` passes.
- `npm test` passes: 15 tests, including local webhook verification and signed POST parsing.
- The local development server starts on port 3000 and `GET /health` returns HTTP 200 with the expected status response.
- `GET /webhook` returns the supplied challenge with HTTP 200 for the configured verification token and HTTP 403 for an invalid token.
- `POST /webhook` captures the raw Express body before JSON parsing and verifies `X-Hub-Signature-256` against that raw body using HMAC SHA-256 and a timing-safe comparison.
- The current webhook diagnostics log only receipt, signature presence/validity, event parsing, and receipt of a text event. They do not log request bodies, customer data, or credentials.
- The Meta outbound diagnostic failed with HTTP 401 / Meta error 190 because the configured access token is expired. The WABA subscription query failed for the same reason, so the subscription cannot be independently re-verified with the current credentials.
- `cloudflared` is installed, but no `cloudflared` process is currently running. There is therefore no active public tunnel process forwarding Meta webhook POSTs to the local server.
- Normal inbound text is parsed correctly, but the router only invokes `sendProjectDetails` for a literal `PROJECT:<project-id>` message. `welcomeFlow` is a placeholder and is neither implemented nor called. Consequently, a normal incoming `Hi` cannot start the welcome sequence even after webhook delivery is restored.

## Required safe diagnostics now present

- `[WEBHOOK] POST RECEIVED`
- `[WEBHOOK] SIGNATURE PRESENT` or `[WEBHOOK] SIGNATURE MISSING`
- `[WEBHOOK] SIGNATURE VALID` or `[WEBHOOK] SIGNATURE INVALID`
- `[WEBHOOK] WHATSAPP EVENT PARSED`
- `[WEBHOOK] TEXT EVENT RECEIVED`

## Result

ENVIRONMENT: PASS
TYPECHECK: PASS
TESTS: PASS
LOCAL SERVER: PASS
LOCAL /HEALTH: PASS
OUTBOUND META API: FAIL
LOCAL WEBHOOK GET: PASS
WEBHOOK POST ROUTE: PASS
SIGNATURE IMPLEMENTATION: PASS
CLOUDFLARED INSTALLED: YES
CLOUDFLARED RUNNING: NO
WABA APP SUBSCRIBED: NO
WELCOME FLOW CODE: FAIL

## Most likely root cause

Meta cannot reach the local webhook because no Cloudflare tunnel process is running. Independently, the expired access token prevents outbound replies and WABA verification, and ordinary text messages currently have no welcome-flow handler in code.

## Next manual action

Start one Cloudflare tunnel that forwards to `http://localhost:3000`, then update Meta's callback URL to that tunnel's public `/webhook` URL.

## Next code fix

Implement and invoke the approved welcome flow for normal inbound `TEXT` events; the current router only handles `PROJECT:<project-id>` triggers.

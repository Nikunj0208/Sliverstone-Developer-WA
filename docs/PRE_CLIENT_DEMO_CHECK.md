# Pre-Client WhatsApp Demo Check

Checked: 2026-08-12 (Asia/Kolkata)

## Security and environment

- Root `.env`: configured and loaded by dotenv.
- All required environment variables: configured.
- `.env` is ignored by Git and is not tracked.
- No duplicate `.env` files were found.
- No shell override of the Meta access token was found.
- No hard-coded Meta access token was found in application source.

## Client content and assets

- Welcome image, cleaned welcome copy, welcome video URL, and office location URL are configured.
- All active project image and brochure paths exist.
- All active configured location/video URLs are syntactically valid.
- Customer-facing copy is normalized; editorial labels and raw URLs are not placed in message bodies.
- Missing client content is safely skipped rather than fabricated:
  - Mahal: video URL missing.
  - Rajmahal: video URL missing.
  - Elements: video URL missing.
  - Villas: description missing.

No file under `raw/` was modified.

## Meta checks

- The configured access token is expired. Meta returned safe authentication error `190`.
- Because the token is invalid, the WABA phone-number and subscribed-app reads cannot be revalidated in this run. This does not prove a WABA mismatch or lost subscription.
- No subscription POST was attempted.

## Local application and webhook checks

- TypeScript check passed.
- Test suite passed: 46 tests.
- One current development watcher owns port 3000; stale duplicate watcher was removed.
- Local `/health` returned HTTP 200 with the expected status payload.
- Local `GET /webhook` verification passed for valid and invalid tokens.
- Local signed `POST /webhook` returned HTTP 200; unsigned POST returned HTTP 401.
- Raw request body signature verification remains enabled.
- Safe webhook, action, image, and fallback logs are present.

## Tunnel checks

- cloudflared is installed and running.
- The current trycloudflare public `/health` endpoint returned HTTP 200.
- A signed, non-customer status-event POST through the public `/webhook` endpoint returned HTTP 200.
- Confirm the Meta callback URL still uses the current tunnel URL because trycloudflare URLs can change when the tunnel restarts.

## Flow checks

- Inbound text, reply button, and list reply parsers use Meta stable IDs, not titles.
- Project selection, brochures, Chat, Call fallback, View Projects, and site visit routing are locally covered.
- Per-customer queueing and inbound deduplication protect outgoing message order.
- Welcome image sender uses upload-then-send, no hard-coded media ID, and optional welcome stages cannot stop the remaining flow.
- No physical WhatsApp delivery was claimed in this diagnosis because the current token is expired.

## Required manual remediation before the client demo

1. Generate a new temporary Meta access token from the same Meta Developer App, replace `META_ACCESS_TOKEN` in root `.env`, save it, and restart the server.
2. Re-run the Meta auth/WABA checks after the token replacement; confirm the configured phone belongs to the configured WABA and the subscribed app is present.
3. Confirm Meta's callback URL is the current trycloudflare URL plus `/webhook`, then verify it using the existing verify token.
4. Provide approved Villas description content, or set Villas inactive before the demo, so every visible project has customer copy.

## Result

The local application, local webhook, tunnel health, and automated flow checks are ready. The live WhatsApp demo is not ready until the expired token is replaced and WABA checks are re-run. Villas also needs approved description content (or must be hidden) for a complete six-project demo.

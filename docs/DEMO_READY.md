# Demo readiness

## Result

DEMO READY: NO

## Verified checks

- `npm run typecheck`: PASS
- `npm test`: PASS (15 tests)
- `npm run dev`: starts successfully
- `GET /health`: returns `{ "status": "ok" }`
- `GET /webhook`: covered by local verification tests
- Signed `POST /webhook`: covered by local parsing tests
- `.env`: ignored by Git

## Demo-blocking problems

1. `data/welcome.json` is missing. The current welcome content is stored in `data/business.json`, so the requested welcome-data contract is not present.
2. `src/flows/welcome.ts` is still a placeholder, and ordinary inbound `TEXT` events do not start a welcome flow. The webhook currently reacts only to `PROJECT:<project-id>` text commands.
3. The welcome image, welcome-video CTA, exact welcome message, and welcome main menu are therefore not sent to a new customer.
4. `src/flows/main-menu.ts` is still a placeholder. `MAIN_CHAT`, call handling/fallback, `MAIN_VIEW_PROJECTS`, and `BOOK_SITE_VISIT` have no inbound action handlers.
5. There is no View Projects list or project-selection interaction. Project details work only after a literal `PROJECT:<project-id>` inbound text command.
6. The current welcome message contains visible raw video and office-location URLs, so it does not meet the requirement that CTA destinations remain hidden behind buttons.
7. Local project-detail tests verify payload sequencing with fakes, but no end-to-end Meta media upload/document-send delivery test has been performed.
8. The webhook code is locally tested, but a live Meta callback connection and production inbound delivery have not been verified.

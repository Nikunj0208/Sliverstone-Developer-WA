# Demo Interaction QA

## Automated verification

- The welcome flow sends the configured welcome image, welcome-video CTA, and interactive main menu. The obsolete generic main-menu body is not used.
- The welcome source contains client URLs, but URL-only lines are removed at send time. The same URLs are sent only through CTA messages.
- The main menu uses stable IDs: `MAIN_CHAT`, `MAIN_CALL`, and `MAIN_VIEW_PROJECTS`.
- Button replies are parsed from `interactive.button_reply.id` and routed by stable ID only.
- List replies are parsed from `interactive.list_reply.id`; `PROJECT:<project-id>` values route to project details.
- All six active projects are included in the data-driven project list: Spring Hill, Mahal, Rajmahal, Applewood, Elements, and Villas.
- All project image and brochure paths that are configured in project data exist locally.
- Project descriptions contain no raw HTTP(S) URLs. Location and video links are sent through CTA URL messages with the approved labels.
- Project follow-up actions use stable IDs: `MAIN_VIEW_PROJECTS`, `MAIN_CHAT`, and `BOOK_SITE_VISIT`.
- Each optional project component is isolated so a failed image, CTA, brochure, or follow-up menu does not prevent later components from being attempted.
- Safe runtime logs are present for incoming button and list replies. They log only stable action IDs and do not log customer numbers.

## Test evidence

- `npm run typecheck`: pass.
- `npm test`: pass (23 tests).
- Tests cover main chat, call, project-list, site-visit, Spring Hill list selection, Applewood list selection, invalid projects, CTA payload behavior, missing CTA values, project detail sequences, webhook parsing, and the welcome sequence.

## Manual WhatsApp confirmation still required

Automated tests do not prove that a real handset receives every media type, button, CTA, document, and reply. Restart the development server and complete one manual WhatsApp pass using a new inbound message before the client demo.

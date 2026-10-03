# Project Automation Audit: Real-Estate WhatsApp Automation

**Date:** 2026-09-24  
**Project:** Silverstone WhatsApp Automation  
**API:** Meta WhatsApp Cloud API  

---

## 1. Existing Project Structure

```
├── client-assets/
│   └── organized/
│       ├── projects/
│       │   ├── applewood/    (hero.jpg, Applewood.pdf, Applewood Welcome image.jpeg, location-url.txt, video-url.txt, description.txt)
│       │   ├── elements/     (hero.jpg, ELEMNET.jpg, brochure.pdf, location-url.txt, description.txt)
│       │   ├── mahal/        (hero.jpg, Mahel welcome image.jpeg, brochure.pdf, location-url.txt, description.txt)
│       │   ├── rajmahal/     (hero.jpg, Raj mahel welcome image.jpeg, brochure.pdf, location-url.txt, description.txt)
│       │   ├── spring-hill/  (hero.jpg, Springhill welcome image.jpeg, brochure.pdf, location-url.txt, video-url.txt, description.txt)
│       │   └── villas/       (hero.jpg, Silverstone villa welcome image.jpeg, SilverStone Villas.pdf, location-url.txt, video-url.txt)
│       └── welcome/          (Welcome image.jpeg, message.txt, video-url.txt)
├── data/
│   ├── business.json         (Legacy business profile)
│   ├── projects.json         (Data-driven project catalog)
│   └── welcome.json          (Welcome card message & location highlights)
├── docs/                     (Audit, QA, status reports)
├── raw/                      (Raw client source files: docx copy, images, PDFs)
├── scripts/                  (WABA subscription & test tools)
├── src/
│   ├── config/               (env.ts, validate.ts)
│   ├── content/              (project-service.ts, welcome-service.ts, copy-normalizer.ts)
│   ├── flows/
│   │   ├── actions.ts        (Central interactive reply button routing)
│   │   ├── call.ts           (Direct call handoff)
│   │   ├── chat.ts           (Sales team WhatsApp handoff)
│   │   ├── conversation-queue.ts (Per-user asynchronous message serialization)
│   │   ├── conversation-state.ts (In-memory user state tracking)
│   │   ├── main-menu.ts      (Interactive reply buttons for Main Menu)
│   │   ├── projects.ts       (Project presentation and media dispatching)
│   │   ├── site-visit.ts     (Multi-step site visit booking form)
│   │   └── welcome.ts        (Initial welcome flow)
│   ├── layouts/              (welcome-card.ts, project-card.ts, project-list.ts)
│   ├── meta/                 (client.ts, media.ts, messages.ts, templates.ts)
│   ├── routes/               (health.ts, webhook.ts)
│   ├── services/             (project-service.ts re-export)
│   ├── webhooks/             (dedupe.ts, parser.ts, signature.ts)
│   ├── app.ts                (Express app configuration)
│   └── server.ts             (Server entry point)
└── tests/                    (Automated test suites via Node test runner)
```

---

## 2. Existing WhatsApp Functionality

- **Meta Graph API Client** (`src/meta/client.ts`): Configured with Axios, baseURL `https://graph.facebook.com/v20.0`, bearer token authentication with `META_ACCESS_TOKEN`.
- **Text Messages** (`src/meta/messages.ts`): `sendText(to, text)` sending WhatsApp standard text payloads.
- **Interactive Reply Buttons** (`src/meta/messages.ts`): `sendReplyButtons(to, bodyText, buttons)` supporting 1 to 3 buttons with unique IDs.
- **Interactive Lists** (`src/meta/messages.ts`): `sendList(to, headerText, bodyText, buttonText, sectionTitle, rows)` supporting up to 10 rows.
- **Interactive CTA URLs** (`src/meta/messages.ts`): `sendCtaUrl(to, bodyText, buttonText, url)` sending clickable buttons opening external URLs without placing raw URLs in body.
- **Media Upload & Delivery** (`src/meta/media.ts`):
  - `uploadMedia(filePath)`: Reads file, checks MIME type, posts to `/{phoneNumberId}/media`.
  - `sendImage(to, imagePath, caption)`: Uploads image and sends image message.
  - `sendDocument(to, documentPath, filename)`: Uploads document and sends document message with filename.
- **Webhook Processing** (`src/routes/webhook.ts`):
  - `GET /webhook`: Verification token challenge exchange (`hub.challenge`).
  - `POST /webhook`: HMAC-SHA256 signature verification (`x-hub-signature-256`), message deduplication, normalized event parsing (`TEXT`, `BUTTON_REPLY`, `LIST_REPLY`, `STATUS`).
- **Sequential Queue** (`src/flows/conversation-queue.ts`): Serializes outgoing messages per WhatsApp ID to ensure order preservation.

---

## 3. Existing Project Data Source

- **File**: `data/projects.json`
- **Current Active Projects**:
  1. `spring-hill` ("Spring Hill")
  2. `mahal` ("Mahal")
  3. `rajmahal` ("Rajmahal")
  4. `applewood` ("Applewood")
  5. `elements` ("Elements")
  6. `villas` ("Villas")
- **Data Access Layer**: `src/content/project-service.ts` providing `getActiveProjects()` and `getProject(id)`.

---

## 4. Existing Media Handling

- **Images**: Supported via `sendImage` with local file resolution, Blob creation, and Meta upload.
- **Documents / PDFs**: Supported via `sendDocument` with custom filename and clean metadata.
- **Videos**: URLs sent via WhatsApp interactive CTA URL buttons or text with link previews.
- **Locations**: Google Maps URLs sent via WhatsApp interactive CTA URL buttons or location text.

---

## 5. Existing Webhook Integration

- Signature verification via `src/webhooks/signature.ts`.
- Inbound payload parsing via `src/webhooks/parser.ts`.
- Event routing in `src/routes/webhook.ts`:
  - `TEXT` → Active Site Visit booking check → Project keyword check → Welcome flow fallback.
  - `BUTTON_REPLY` → Routed via `routeButtonAction()` in `src/flows/actions.ts`.
  - `LIST_REPLY` → Routed via `projectIdFromTrigger()` or `routeButtonAction()`.

---

## 6. Existing Conversation State

- In-memory conversation state tracked in `src/flows/conversation-state.ts` (records chat handoffs, site visit bookings).
- Form step progression managed in `src/flows/site-visit.ts` (`name` → `phone` → `project` → `date` → `time`).

---

## 7. Files That Will Be Modified

1. `data/projects.json`:
   - Expand project schema to include `mainImage`, `location` (object), `video` (object), `links` (object), `brochure` (object), and `plans` (nested square feet and BHK options), preserving legacy fields for full backwards compatibility.
2. `src/services/project-service.ts`:
   - Add full query APIs required by Section 27:
     - `getAllProjects()`
     - `getProjectById(projectId)`
     - `getSquareFeetOptions(projectId)`
     - `getBhkOptions(projectId, sqftId)`
     - `getBrochure(projectId)`
     - `getPlan(projectId, sqftId, bhk)`
3. `src/meta/messages.ts`:
   - Add native `sendLocation()` and `sendVideo()` helpers to centralize Meta messaging APIs.
4. `src/meta/media.ts`:
   - Add `uploadVideo()` and `uploadDocument()` caching support so assets are not re-uploaded repeatedly if already cached.
5. `src/flows/conversation-state.ts`:
   - Extend state machine to track `projectId`, `squareFeetId`, `bhk`, and conversation state (`MAIN_MENU`, `PROJECT_LIST`, `PROJECT_SELECTED`, `PROJECT_INFO`, `PROJECT_ACTIONS`, `SELECT_SQFT`, `SELECT_BHK`, `BROCHURE_SENT`, `PLAN_SENT`, `CHAT`, `CALL`).
6. `src/flows/main-menu.ts`:
   - Add `showMainWelcomeMenu(to, dependencies?, promptText?)` with stable IDs `MAIN_VIEW_PROJECTS`, `MAIN_CHAT`, `MAIN_CALL`.
7. `src/flows/projects.ts`:
   - Implement modular handlers:
     - `sendProjectImage(to, project, dependencies)`
     - `sendProjectDescription(to, project, dependencies)`
     - `sendProjectLocation(to, project, dependencies)`
     - `sendProjectVideo(to, project, dependencies)`
     - `sendProjectLinks(to, project, dependencies)`
     - `sendProjectActionButtons(to, project, dependencies)` (`PROJECT_BROCHURE`, `PROJECT_PLANS`)
     - `sendSquareFeetOptions(to, project, dependencies)` (`PLAN_SQFT:<project-id>:<sqft-id>`)
     - `sendBhkOptions(to, project, sqftId, dependencies)` (`PLAN_BHK:<project-id>:<sqft-id>:<bhk>`)
     - `sendPlanPdf(to, project, sqftId, bhk, dependencies)`
8. `src/flows/actions.ts`:
   - Route `PROJECT_BROCHURE`, `PROJECT_PLANS`, `PLAN_SQFT`, `PLAN_BHK`, `MAIN_VIEW_PROJECTS`, `MAIN_CHAT`, `MAIN_CALL`.
9. `src/routes/webhook.ts`:
   - Ensure seamless pass-through of `BUTTON_REPLY` and `LIST_REPLY` for the new plan and brochure actions.

---

## 8. Files That Will Be Created

1. `docs/PROJECT_AUTOMATION_AUDIT.md` (this audit document)
2. `docs/PROJECT_ASSET_VALIDATION.md` (complete asset validation table)
3. `docs/PROJECT_AUTOMATION_FLOW.md` (architecture, message ID, state, and journey specification)
4. `tests/project-automation-flow.test.mjs` (comprehensive journey simulator test suite)

---

## 9. Missing Assets & Architectural Status

- **Brochure PDFs**: All 6 projects have verified local brochure PDFs (`Spring Hill`, `Mahal`, `Rajmahal`, `Applewood`, `Elements`, `Villas`).
- **Floor Plan PDFs (3 BHK, 4 BHK, 5 BHK)**: Currently **MISSING_ASSET** on disk. No separate floor plan PDF files were supplied in `raw/` or `client-assets/`.
  - In accordance with Section 3, 17, and 32 of the prompt:
    - Floor plans are marked as `MISSING_ASSET`.
    - No fake plan files will be invented.
    - If a user triggers a plan option where the PDF is missing, the system will gracefully respond:
      *"This plan is currently unavailable. Please contact our sales team."*
      followed by the Main Welcome Menu (`View Projects`, `Chat`, `Call`).
- **Compatibility Verdict**: The repository architecture is **fully compatible** with the requested project information, brochure, and floor-plan flow. We proceed with the implementation.

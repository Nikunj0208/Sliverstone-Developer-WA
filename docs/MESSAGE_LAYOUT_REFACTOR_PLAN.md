# Message Layout Refactor Plan

## Scope

This is an inspection plan only. No implementation changes were made.

## Current execution trace

### Inbound text to welcome

`src/routes/webhook.ts` receives normalized `TEXT` events from `src/webhooks/parser.ts`. A literal `PROJECT:<id>` text goes directly to project details; every other text calls `sendWelcomeFlow()` in `src/flows/welcome.ts`.

The active welcome flow currently loads `data/business.json`, sends the welcome image, sends a welcome-video CTA, then sends `sendMainMenu()`. It does not use the newly audited `data/welcome.json`.

### Main-menu actions

`src/flows/main-menu.ts` creates reply-button IDs `MAIN_CHAT`, `MAIN_CALL`, and `MAIN_VIEW_PROJECTS`. The parser reads `messages[].interactive.button_reply.id` into `BUTTON_REPLY`. `src/routes/webhook.ts` passes that stable ID to `routeButtonAction()` in `src/flows/actions.ts`.

| Stable ID | Current handler | Result |
| --- | --- | --- |
| `MAIN_CHAT` | `handleChat()` | CTA URL based on configured client phone number |
| `MAIN_CALL` | `handleCall()` | Sends configured client phone number as a text fallback |
| `MAIN_VIEW_PROJECTS` | `sendProjectList()` | Sends a data-driven interactive list |
| `BOOK_SITE_VISIT` | `handleSiteVisit()` | Reuses call fallback |

Routing is by stable ID only, not visible button titles.

### Project selection and details

`sendProjectList()` in `src/flows/projects.ts` reads active projects through `listActiveProjects()` and creates `PROJECT:<id>` list row IDs. The parser reads `messages[].interactive.list_reply.id` into `LIST_REPLY`. The webhook route validates that ID with `projectIdFromTrigger()` and calls `sendProjectDetails()`.

Project details currently send image, exact data description, location CTA, video CTA, brochure document, and a follow-up reply-button message. Each optional detail stage is isolated so later stages still run after a failure.

`DOWNLOAD_BROCHURE:<id>` has no message builder, parser routing branch, or handler. Brochures currently send automatically during project details.

## Existing message builders

| Builder | File | Current use |
| --- | --- | --- |
| `sendText()` | `src/meta/messages.ts` | Project descriptions; call fallback |
| `sendReplyButtons()` | `src/meta/messages.ts` | Welcome main menu; project follow-up menu |
| `sendList()` | `src/meta/messages.ts` | Project list |
| `sendCtaUrl()` | `src/meta/messages.ts` | Chat, welcome video, project location, project video |
| `sendImage()` | `src/meta/media.ts` | Welcome and project images |
| `sendDocument()` | `src/meta/media.ts` | Project brochures |
| `sendInteractiveButtons()` | — | No function by this name; `sendReplyButtons()` is the equivalent |
| `sendTemplate()` | — | Not implemented or used |

## Findings against the requested presentation redesign

### Raw location and video URLs

- Project location and project video URLs are not concatenated into project description text. `sendProjectDetails()` passes them directly to `sendCtaUrl()`.
- The active welcome source, `data/business.json`, still contains raw welcome-video and office-location URLs. `removeRawUrls()` in `src/flows/welcome.ts` strips URL-only lines at runtime, but this leaves the legacy source active and separate from the newly audited welcome data.
- `data/welcome.json` has dedicated video and location fields, but no active code reads it.

### Generic main-menu text

- `Please select an option.` is not currently used. The main-menu body comes from the welcome message argument.

### Editorial label

- `data/business.json` still contains `WhatsApp Message Copy:` in the active welcome source.
- `data/projects.json` has been cleaned; its project descriptions do not contain this label.

### Hard-coded content and data

- Project names and descriptions are loaded from `data/projects.json`; they are not hard-coded in the webhook or project flow.
- Fixed presentation labels such as `Project Location`, `Open Location`, `Project Video`, and `Watch Video` are intentionally hard-coded UI labels in `src/flows/projects.ts`.
- Welcome content is effectively hard-wired to the legacy `data/business.json` import in `src/flows/welcome.ts` rather than the current canonical `data/welcome.json`.

### Stable-ID routing

- Main buttons and follow-up buttons use stable IDs.
- Button and list parsing uses the correct Meta properties.
- Interactive events are not ignored: `BUTTON_REPLY` and `LIST_REPLY` have router branches.
- There is no handler for `DOWNLOAD_BROCHURE:<id>`.

## Files and functions that need to change during implementation

1. `src/flows/welcome.ts` / `sendWelcomeFlow()`
   - Replace the legacy `data/business.json` import with `data/welcome.json`.
   - Use the clean stored welcome message directly.
   - Keep welcome video and office location as separate CTA messages when their URL fields are present.

2. `src/flows/main-menu.ts` / `sendMainMenu()`
   - Preserve the existing stable button IDs and use the clean welcome message as the interactive body.
   - Do not add a generic menu body or separate menu text.

3. `src/flows/projects.ts` / `sendProjectDetails()`
   - Preserve the current CTA separation and data-driven project lookup.
   - Add a download-brochure action only if the new presentation specification requires an explicit `DOWNLOAD_BROCHURE:<id>` customer action instead of the current automatic document send.

4. `src/flows/actions.ts` / `routeButtonAction()`
   - Preserve stable-ID routing.
   - Add a `DOWNLOAD_BROCHURE:<id>` handler only after its intended customer interaction is specified.

5. `src/routes/webhook.ts`
   - No change is needed for existing button/list ID extraction and routing.
   - Add a route branch only if an explicit download-brochure action is introduced.

6. `data/business.json`
   - Retire from active welcome rendering after the code is moved to `data/welcome.json`; do not use it as a customer-message source afterward.

7. Tests
   - `tests/welcome.test.mjs`: assert the clean `data/welcome.json` message is the reply-button body and no editorial label/raw URL is sent.
   - `tests/actions.test.mjs`: extend only if an explicit download-brochure action is added.
   - `tests/project-details.test.mjs`: retain CTA, document, and follow-up-menu sequence assertions.

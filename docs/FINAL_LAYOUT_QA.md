# Final Layout QA

This is a local code-and-data QA pass. No live WhatsApp template was sent, and Meta template approval was not checked or claimed.

## Active configuration

- `WELCOME_TEMPLATE_NAME`: missing
- `PROJECT_TEMPLATE_NAME`: missing
- `CLIENT_PHONE_NUMBER`: configured (value not displayed)

Both template names being unset correctly activates the existing free-form fallback.

## Customer-facing copy

- Active welcome and project content is read only from `data/welcome.json` and `data/projects.json` through the content services.
- Customer-facing copy is normalized to remove confirmed editorial labels only.
- The legacy `data/business.json` and the extracted `client-assets/organized/**/*.txt` files retain source metadata and raw URLs as internal reference material; neither is used by the active outbound flows.
- Welcome and project descriptions contain no raw HTTP(S) URL. URLs are passed only to CTA URL actions.

## Welcome card

- Image path exists.
- Cleaned exact welcome message is available.
- Welcome video and location URLs are available for CTA/template buttons.
- The template sender supports the approved-template layout: image header, message body, Watch Video, Open Location, native Call, Chat, and View Projects.
- The Call button must be configured as a Meta `PHONE_NUMBER` template button with the configured client number; Meta does not accept a runtime phone-number parameter when sending a template.

## Project selector

- `MAIN_VIEW_PROJECTS` loads active projects dynamically, sorts by `sortOrder`, and sends rows using `project.icon + project.name`.
- All six stable project actions resolve through `PROJECT:<id>`.

## Project template data readiness

| Project | Image | Description | Location | Video | Brochure | Single template card ready |
| --- | --- | --- | --- | --- | --- | --- |
| Spring Hill | yes | yes | yes | yes | yes | yes |
| Mahal | yes | yes | yes | no | yes | no — client video URL missing |
| Rajmahal | yes | yes | yes | no | yes | no — client video URL missing |
| Applewood | yes | yes | yes | yes | yes | yes |
| Elements | yes | yes | yes | no | yes | no — client video URL missing |
| Villas | yes | no | yes | yes | yes | no — client description missing |

For cards that cannot meet the complete template layout, the code safely uses the free-form fallback and skips only missing optional content.

## Action routing

- `MAIN_CHAT`: marks demo handoff state and sends the existing Chat CTA.
- `MAIN_VIEW_PROJECTS`: reopens the dynamic project list.
- `PROJECT:<id>`: routes to the selected project details.
- `DOWNLOAD_BROCHURE:<id>`: sends the configured project PDF and logs safe success/failure.
- `BOOK_SITE_VISIT:<id>`: preserves the selected project and starts the demo form: name, phone number, preferred date, then preferred time.
- Template Call is a native phone-number button. Fallback Call uses the configured client number.
- Individual action errors are contained so they do not terminate webhook processing.

## Validation

- `npm run typecheck`: passed.
- `npm test`: passed (44 tests).
- Tests cover customer-copy cleanup, no raw URLs in active welcome/project bodies, project data/CTA routing, brochure routing, handoff state, project selection, template component construction, and fallback behavior.

## Results

- CONTENT AUDIT: PASS
- WELCOME CARD BUILDER: PASS
- PROJECT CARD BUILDER: FAIL (four projects do not currently have all client content required by the requested single template card)
- PROJECT LIST: PASS
- CHAT: PASS
- CALL: PASS
- LOCATION: PASS
- VIDEO: PASS (available URLs are routed as CTAs; missing client video data is skipped)
- BROCHURE: PASS
- SITE VISIT: PASS
- VIEW PROJECTS: PASS

- RAW URLS REMOVED FROM BODY: YES
- EDITORIAL LABELS REMOVED: YES

- TEMPLATE MODE CODE READY: YES
- FREEFORM FALLBACK READY: YES

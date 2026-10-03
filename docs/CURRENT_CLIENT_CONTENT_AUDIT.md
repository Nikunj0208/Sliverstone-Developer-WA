# Current Client Content Audit

Audit date: 2026-08-11

## Source handling

`client-assets/raw/` is not present in this repository. The supplied originals are in the protected root-level `raw/` directory, which was inspected read-only and not modified. The organized and data directories were also inspected as current repository content.

## Editorial labels found and removed from customer-facing messages

The following DOCX first-line labels are document metadata, not customer copy. Only these labels were removed from the newly extracted data messages:

- `📲 WhatsApp Message Copy: Welcome Message`
- `📲 WhatsApp Message Copy: Springhill`
- `📲 WhatsApp Message Copy: Mahel`
- `📲 WhatsApp Message Copy: Rajmahel`
- `📲 WhatsApp Message Copy: Applewood`
- `📲 WhatsApp Message Copy: Elements`

The DOCX document title `WhatsApp Automation Message Copy (Point-to-Point with Emojis)` was also treated as document metadata and was not included in customer content. No other wording, punctuation, emoji, or project name was rewritten. URL-only lines are stored as URL fields rather than customer message text.

## Welcome

| Field | Status | Source files | Notes |
| --- | --- | --- | --- |
| Image | FOUND | `raw/welcome image.png`; `client-assets/organized/welcome/image.png` | Hash matches the raw image. |
| Message | FOUND | `raw/Silverstone_Developers_WhatsApp_Messages.docx` | Extracted after removal of the confirmed editorial label. |
| Video URL | FOUND | `raw/Location and videos .txt` | Complete original URL stored in `data/welcome.json`. |
| Location URL | FOUND | `raw/Location and videos .txt` | Office location URL stored separately. |
| Business/client phone source | MISSING | — | No phone number is supplied in the audited client raw/organized content. |
| New/changed since previous data | CHANGED | `data/welcome.json` | New canonical welcome schema. |
| Unresolved | None | — | — |

## Projects

| Project | Image | Message | Video URL | Location URL | Brochure | Source files | New/changed since previous data | Missing / unresolved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Spring Hill | FOUND | FOUND | FOUND | FOUND | FOUND | `raw/SPRINGHILL.jpg`; `raw/Spring Hill.pdf`; DOCX; links TXT | Added icon and video field; description refreshed from DOCX after label removal | None |
| Mahal | FOUND | FOUND | MISSING | FOUND | FOUND | `raw/MAHEL.jpg`; `raw/MaHel By SilverStone Brochure.pdf`; DOCX; links TXT | Added icon and video field; description refreshed from DOCX after label removal | Project video missing |
| Rajmahal | FOUND | FOUND | MISSING | FOUND | FOUND | `raw/RAJ MAHEL.jpg`; `raw/Raj Mahel.pdf`; DOCX; links TXT | Added icon and video field; description refreshed from DOCX after label removal | Project video missing |
| Applewood | FOUND | FOUND | FOUND | FOUND | FOUND | `raw/APPLEWOOD - 1.jpg`; DOCX; links TXT; organized Applewood PDF/location/video files | Added icon, full current location, video, and brochure path | Raw TXT location is incomplete; current full location comes from the organized/data update rather than raw TXT |
| Elements | FOUND | FOUND | MISSING | FOUND | FOUND | `raw/ELEMNET.jpg`; `raw/Element.pdf`; DOCX; links TXT | Added icon and video field; description refreshed from DOCX after label removal | Project video missing |
| Villas | FOUND | MISSING | FOUND | FOUND | FOUND | links TXT; organized Villas hero/PDF files | Added icon, image, brochure, and video fields | No Villas description in the DOCX; second Villas video is not represented by the single-URL schema |

## URL and mapping notes

- All stored URL values retain the complete supplied URL; none was shortened or rewritten.
- Spring Hill, Mahal, Rajmahal, Elements, and Villas locations are explicitly labelled in the raw TXT file.
- Applewood's raw TXT location is explicitly incomplete. The complete current Applewood location is present in its organized folder and JSON data, but not in the raw TXT source.
- The raw TXT supplies two Villas videos. The current `videoUrl` uses the explicitly labelled live-campus video. The exclusive garden-villa video remains unrepresented because the requested schema has one video field.
- The raw labels `Mahel` and `Rajmahel` map consistently to the known projects Mahal and Rajmahal.

## Files added since previous organization

The following current files are not represented by a matching protected raw file and should be treated as later repository additions:

- `client-assets/organized/projects/applewood/Applewood.pdf`
- `client-assets/organized/projects/villas/hero.jpg`
- `client-assets/organized/projects/villas/SilverStone Villas.pdf`
- Generated organized URL/description text files under the project and welcome folders
- `data/business.json`
- `data/welcome.json`

## Files changed

- `data/projects.json` differs from the previously committed version: it now has cleaned DOCX-derived descriptions, project icons, video fields, a complete current Applewood location, and Applewood/Villas asset paths.
- `docs/asset-audit.md` and `docs/BUILD_STATUS.md` differ from their previously committed versions.
- No protected file under `raw/` is modified by this audit.

## Data output

- `data/welcome.json` now follows the requested welcome schema.
- `data/projects.json` now includes `id`, `name`, `icon`, `description`, `imagePath`, `videoUrl`, `locationUrl`, `brochurePath`, `active`, and `sortOrder` for every known project.

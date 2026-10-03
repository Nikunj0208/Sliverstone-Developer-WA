# Silverstone asset audit

Audit date: 2026-08-10

## Source handling

The supplied original assets are currently stored in `raw/` at the repository root; `client-assets/raw/` does not exist. `raw/` is treated as protected and was not modified. This audit inspected `raw/Location and videos .txt`, the only raw text file found.

## Project content status

| Project | Image | Description | Location URL | Project video URL | Brochure |
| --- | --- | --- | --- | --- | --- |
| Spring Hill | FOUND | FOUND | FOUND | FOUND | FOUND |
| Mahal | FOUND | FOUND | FOUND | MISSING | FOUND |
| Rajmahal | FOUND | FOUND | FOUND | MISSING | FOUND |
| Applewood | FOUND | FOUND | FOUND | FOUND | FOUND |
| Elements | FOUND | FOUND | FOUND | MISSING | FOUND |
| Villas | FOUND | MISSING | FOUND | FOUND | FOUND |

## URL mapping audit

All mappings below are explicitly labelled in `raw/Location and videos .txt`; full client URLs are intentionally omitted from this report.

| Source section | Purpose | Related project | Classification | Status |
| --- | --- | --- | --- | --- |
| Welcome message & office details | Office location | None | OTHER | FOUND |
| Welcome message & office details | Welcome video | None | WELCOME_VIDEO | FOUND |
| Springhill | Location | Spring Hill | LOCATION | FOUND |
| Springhill | Video | Spring Hill | PROJECT_VIDEO | FOUND |
| Mahel | Location | Mahal | LOCATION | FOUND |
| Rajmahel | Location | Rajmahal | LOCATION | FOUND |
| Applewood | Client-supplied location URL | Applewood | LOCATION | FOUND |
| Applewood | Live campus video | Applewood | PROJECT_VIDEO | FOUND |
| Elements | Location | Elements | LOCATION | FOUND |
| Villas | Location | Villas | LOCATION | FOUND |
| Villas | Live campus video | Villas | PROJECT_VIDEO | FOUND |
| Villas | Exclusive garden villa video | Villas | PROJECT_VIDEO | FOUND |

## Unresolved and multi-link handling

- The incomplete Applewood location fragment in the raw text was not used. A completed location URL was supplied directly by the client and is stored in project data.
- Villas has two clearly identified project videos. The single `videoUrl` schema field stores the explicitly labelled live-campus video; the exclusive garden-villa video remains recorded in the source audit and is not discarded or reassigned.
- The supplied project labels “Mahel” and “Rajmahel” map consistently to the known projects Mahal and Rajmahal.

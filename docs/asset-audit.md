# Silverstone asset audit

Audit date: 2026-08-10

## Source handling

The supplied originals are present in `raw/` at the repository root, rather than in `client-assets/raw/`. This audit treats `raw/` as the protected original source directory. No file in that directory was changed, moved, renamed, or deleted. Files copied into `client-assets/organized/` are separate copies.

## Project inventory

| Project | Image found | Brochure found | Description found | Location URL found | Original source filename(s) | Confidence in mapping | Missing content |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Spring Hill | Yes | Yes | Yes | Yes | `SPRINGHILL.jpg`; `Spring Hill.pdf`; `Silverstone_Developers_WhatsApp_Messages.docx`; `Location and videos .txt` | High | None in the requested fields |
| Mahal | Yes | Yes | Yes | Yes | `MAHEL.jpg`; `MaHel By SilverStone Brochure.pdf`; `Silverstone_Developers_WhatsApp_Messages.docx`; `Location and videos .txt` | High - the supplied assets consistently spell the project “Mahel”; it is mapped to the requested project name “Mahal”. | None in the requested fields |
| Rajmahal | Yes | Yes | Yes | Yes | `RAJ MAHEL.jpg`; `Raj Mahel.pdf`; `Silverstone_Developers_WhatsApp_Messages.docx`; `Location and videos .txt` | High - the supplied assets spell the project “Raj Mahel”. | None in the requested fields |
| Applewood | Yes | No | Yes | No - **UNRESOLVED** | `APPLEWOOD - 1.jpg`; `Silverstone_Developers_WhatsApp_Messages.docx`; `Location and videos .txt` | High for image and description | Brochure; complete location URL |
| Elements | Yes | Yes | Yes | Yes | `ELEMNET.jpg`; `Element.pdf`; `Silverstone_Developers_WhatsApp_Messages.docx`; `Location and videos .txt` | High - the image filename has a likely typo and the supplied project content uses “Element/Elements”; the requested project name is “Elements”. | None in the requested fields |
| Villas | No | No | No | Yes | `Location and videos .txt` | High for the location URL only | Image; brochure; description |

## Welcome asset

`welcome image.png` is a confidently identified welcome image and was copied to `client-assets/organized/welcome/welcome.png`.

## Unresolved assets and values

- Applewood’s location entry is **UNRESOLVED**: `https://maps.app.goo.gl/ [Note: Please paste complete code]`. It is not a usable, complete location URL and has not been added to `data/projects.json`.
- No source file has an uncertain project mapping. `raw/.DS_Store` is macOS metadata, not project content, and was intentionally ignored.

## Other verified source information

- `Location and videos .txt` also includes a welcome office location, a welcome video, and project video links. Video URLs are outside the requested JSON schema and were not added.
- `Silverstone_Developers_WhatsApp_Messages.docx` contains project copy for Springhill, Mahel, Rajmahel, Applewood, and Elements, but no Villas copy.

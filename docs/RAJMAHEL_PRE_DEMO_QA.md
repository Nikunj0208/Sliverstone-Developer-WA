# Rajmahel Pre-Demo QA

## Current source audit

- Image: `raw/RAJ MAHEL.jpg` is the source and matches the organized hero image byte-for-byte.
- Customer text: the Rajmahel entry in `raw/Silverstone_Developers_WhatsApp_Messages.docx` is the current source. Its `WhatsApp Message Copy:` label is removed before customer delivery.
- Brochure: `raw/Raj Mahel.pdf` is the source and matches the organized brochure byte-for-byte.
- Location: present in `raw/Location and videos .txt` and stored internally only.
- Video: no Rajmahel video URL is present in the current raw source files.
- Build plans: no separate source file exists for any of the six requested plans. The six data entries are intentionally unresolved with empty file paths; no file mapping was guessed.

## Code-test status

| Check | Status |
| --- | --- |
| RAJMAHEL IMAGE | PASS — code data points to an existing organized image |
| RAJMAHEL TEXT | PASS — exact current raw DOCX copy, without editorial metadata |
| BROCHURE BUTTON | PASS — brochure is no longer sent when the Rajmahel card opens |
| BROCHURE DELIVERY | PASS — code path is tested; live Meta delivery is not verified |
| BUILD PLAN BUTTON | FAIL — disabled because all six source files are missing |
| 6 BUILD PLAN OPTIONS | FAIL — no source files can be mapped safely |
| 124.44 SQYD | FAIL — source file missing |
| 124.44 SQYD WITH LIFT | FAIL — source file missing |
| 137.77 SQYD | FAIL — source file missing |
| 137.77 SQYD WITH SHOP | FAIL — source file missing |
| 180 SQYD | FAIL — source file missing |
| 202 SQYD | FAIL — source file missing |
| LOCATION BUTTON | PASS — code CTA uses the client-supplied internal location URL |
| VIDEO BUTTON | FAIL — no client-supplied Rajmahel video URL exists |
| CHAT | PASS — existing stable `MAIN_CHAT` action is retained |
| CALL | FAIL — native dial-pad button requires a configured, approved Meta phone-number template |
| BOOK SITE VISIT | PASS — existing stable Rajmahel action is retained |
| VIEW PROJECTS | PASS — existing stable action is retained |

RAW GOOGLE MAPS URL VISIBLE: NO

RAW YOUTUBE URL VISIBLE: NO

"WHATSAPP MESSAGE COPY" VISIBLE: NO

"PLEASE SELECT AN OPTION" VISIBLE: NO

TYPECHECK: PASS

TESTS: PASS (49 code tests)

TEMPLATE CONFIGURATION: NOT AVAILABLE

TEMPLATE APPROVAL: NOT CONFIGURED

LIVE DEMO READY: NO

## Demo-blocking issues

1. The client has not supplied a Rajmahel project-video URL in the current raw files.
2. The client has not supplied six distinct build-plan files, so their requested IDs cannot be mapped without guessing.
3. The native Call button requires a Meta-approved template with a configured phone-number button.
4. WhatsApp delivery has not been tested live; code-test success does not confirm Meta delivery.

## Manual actions required

1. Add the six correctly named Rajmahel plan PDFs/images to `raw/`.
2. Add the approved Rajmahel project-video URL to a client source file in `raw/`.
3. Create and approve the native phone-number Call template in Meta, then configure its template name privately.
4. Restart the server and perform a manual WhatsApp test after the missing client files are mapped.

# Site Visit Sheet Mapping

The supplied Google Sheet has one tab, `Sheet1`, with these existing headers.

| WhatsApp form field | Sheet column |
| --- | --- |
| Name | Name |
| Phone number | Phone number |
| Preferred date | date |
| Preferred time | time |
| Interested project name | interested project |

The WhatsApp demo now collects all five fields. Automatic row insertion requires server-side Google authorization, such as a service account shared with the sheet or a Google Apps Script HTTPS endpoint. The browser editing URL alone is not an authorization credential and is intentionally not used by the Node.js server.

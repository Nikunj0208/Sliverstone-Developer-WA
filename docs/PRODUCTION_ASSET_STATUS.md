# Production Asset Status

**Status Date:** 2026-09-24  
**Validation Standard:** Section 24 (`READY`, `MISSING`, `INVALID`)

---

## 1. Project Asset Matrix

| Project | Image | Description | Location | Video | Google Maps | Brochure | Square Foot | 3 BHK | 4 BHK | 5 BHK |
|---|---|---|---|---|---|---|---|---|---|---|
| **Spring Hill** | READY | READY | READY | READY | READY | READY | READY | MISSING | MISSING | MISSING |
| **Mahal** | READY | READY | READY | MISSING | READY | READY | READY | MISSING | MISSING | MISSING |
| **Rajmahal** | READY | READY | READY | MISSING | READY | READY | READY | MISSING | MISSING | MISSING |
| **Applewood** | READY | READY | READY | READY | READY | READY | READY | MISSING | MISSING | MISSING |
| **Elements** | READY | READY | READY | MISSING | READY | READY | READY | MISSING | MISSING | MISSING |
| **Villas** | READY | MISSING | READY | READY | READY | READY | MISSING | MISSING | MISSING | MISSING |

---

## 2. Production Asset Details & Graceful Fallbacks

### 2.1 Spring Hill (`spring-hill`)
- **Main Image**: `client-assets/organized/projects/spring-hill/Springhill welcome image.jpeg` — **READY**
- **Description**: Verified Gujarati project overview — **READY**
- **Location**: Surat 120' & 60' Junction — **READY**
- **Google Maps**: `https://maps.app.goo.gl/Wi7TGhT5QZuHHZp99` — **READY**
- **Video**: `https://youtu.be/z-s4KD0q2qk` — **READY**
- **Brochure**: `client-assets/organized/projects/spring-hill/brochure.pdf` (5.8 MB) — **READY**
- **Square Foot Options**: 84 Sq.Yd Plots, 124 Sq.Yd Anchor Plot, Row House & Bungalows — **READY**
- **3 BHK / 4 BHK / 5 BHK Plans**: PDFs not supplied on disk (`MISSING`). Handled gracefully with sales team notice and return to Main Menu.

### 2.2 Mahal (`mahal`)
- **Main Image**: `client-assets/organized/projects/mahal/Mahel welcome image.jpeg` — **READY**
- **Description**: Verified Gujarati bungalow plot overview — **READY**
- **Location**: Surat 120' & 60' Junction — **READY**
- **Google Maps**: `https://maps.app.goo.gl/PSmCZBtAwyGoNeW57` — **READY**
- **Video**: None supplied (`MISSING`). Graceful notice sent to customer.
- **Brochure**: `client-assets/organized/projects/mahal/brochure.pdf` (6.1 MB) — **READY**
- **Square Foot Options**: 28' Width Bungalow Plots — **READY**
- **Floor Plans**: `MISSING`. Graceful notice sent to customer.

### 2.3 Rajmahal (`rajmahal`)
- **Main Image**: `client-assets/organized/projects/rajmahal/Raj mahel welcome image.jpeg` — **READY**
- **Description**: Verified Gujarati palace bungalow overview — **READY**
- **Location**: Surat 120' & 60' Junction — **READY**
- **Google Maps**: `https://maps.app.goo.gl/CnkR8tcD2y3yU4fv9` — **READY**
- **Video**: None supplied (`MISSING`). Graceful notice sent to customer.
- **Brochure**: `client-assets/organized/projects/rajmahal/brochure.pdf` (4.5 MB) — **READY**
- **Square Foot Options**: 125 Sq.Yd Plots, 180 Sq.Yd Plots, 200 Sq.Yd Anchor Plots — **READY**
- **Floor Plans**: `MISSING`. Graceful notice sent to customer.

### 2.4 Applewood (`applewood`)
- **Main Image**: `client-assets/organized/projects/applewood/Applewood Welcome image.jpeg` — **READY**
- **Description**: Verified Gujarati row house project overview — **READY**
- **Location**: Chichi, Surat — **READY**
- **Google Maps**: Verified Google Maps URL — **READY**
- **Video**: `https://youtu.be/Fhi8EtCLFXA` — **READY**
- **Brochure**: `client-assets/organized/projects/applewood/Applewood.pdf` (6.8 MB) — **READY**
- **Square Foot Options**: 89 Sq.Yd Plots, 137 Sq.Yd Anchor Plot — **READY**
- **Floor Plans**: `MISSING`. Graceful notice sent to customer.

### 2.5 Elements (`elements`)
- **Main Image**: `client-assets/organized/projects/elements/ELEMNET.jpg` — **READY**
- **Description**: Verified feature bullet points — **READY**
- **Location**: Surat 120' & 60' Junction — **READY**
- **Google Maps**: `https://maps.app.goo.gl/ETf2Y8ZrJsFarUwGA` — **READY**
- **Video**: None supplied (`MISSING`). Graceful notice sent to customer.
- **Brochure**: `client-assets/organized/projects/elements/brochure.pdf` (4.2 MB) — **READY**
- **Square Foot Options**: 84 Sq.Yd Plots, 124 Sq.Yd Anchor Plot, 2000 Sq.Ft Ready Home — **READY**
- **Floor Plans**: `MISSING`. Graceful notice sent to customer.

### 2.6 Villas (`villas`)
- **Main Image**: `client-assets/organized/projects/villas/Silverstone villa welcome image.jpeg` — **READY**
- **Description**: None supplied in client assets (`MISSING`). Bypasses description and delivers media/brochure.
- **Location**: Surat — **READY**
- **Google Maps**: `https://maps.app.goo.gl/6F8E29VZWTpkxnoS9` — **READY**
- **Video**: `https://youtu.be/maggaNCbyNM` & Short `https://youtube.com/shorts/61lWVYkhYPM` — **READY**
- **Brochure**: `client-assets/organized/projects/villas/SilverStone Villas.pdf` (5.1 MB) — **READY**
- **Square Foot Options**: None supplied (`MISSING`). Graceful notice sent to customer.

---

## 3. Floor Plan Ingestion Structure

To add floor plans at any time without code changes, place PDF files in the following folder structure:

```
client-assets/organized/projects/<project-id>/plans/<sqft>/<bhk>.pdf
```

Example for Spring Hill:
- `client-assets/organized/projects/spring-hill/plans/bhk/3bhk.pdf`
- `client-assets/organized/projects/spring-hill/plans/bhk/4bhk.pdf`
- `client-assets/organized/projects/spring-hill/plans/bhk/5bhk.pdf`

Once placed, update the `"file"` path in `data/projects.json`. The automation will immediately start serving them without server restart.

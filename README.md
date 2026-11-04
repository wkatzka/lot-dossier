# Lot Dossier

Live: **https://lot-dossier-assistant.vercel.app**

Due-diligence dossiers for Utah spec-home lots, generated from public records. You enter an address or parcel ID, and the dossier covers water rights, geologic hazards, septic vs. sewer, utilities, zoning and setbacks, CC&Rs, fees and permits. If you upload a building plan, it also checks the plan against the lot.

## How it works

**In the browser** (`web/`, built into `public/index.html`):
- Finds the parcel in UGRC's statewide parcel layers.
- Queries 20+ state, county and federal map services directly (all allow cross-origin requests).
- Reads an uploaded plan-set PDF with pdf.js. The file is never uploaded anywhere.
- Writes the dossier.

**On Vercel** (`api/`), for documents counties don't expose to browsers:

| Endpoint | What it does |
|---|---|
| `GET /api/parcel-docs?county=Weber&parcel=123456789` | Reads the county parcel record and OCRs the recorded subdivision plat (tesseract.js). Returns plat-note setbacks, referenced recorded entries (development agreement, CC&Rs), utility approval blocks, the owners association and referenced geologic reports. |
| `GET /api/notices?q=<subdivision>&county=Weber&juris=<city>` | Searches Utah's Public Notice Website for the subdivision and reads the matching agendas and meeting packets. Packets are fetched as parallel byte ranges and read in memory, never stored. Returns development standards tables, utility will-serve statements, CC&R recordings and approval history, each with a citation. |

The API only fetches documents for the lot being looked up. Results are cached at Vercel's CDN, so repeat lookups are instant.

## Develop

```bash
npm install
python3 build.py            # -> public/index.html
npm run dev                 # app + API on http://localhost:3000
```

Single file to email (calls the deployed API):

```bash
python3 build.py --api https://YOUR-PROJECT.vercel.app   # -> dist/Lot Dossier.html
```

## Deploy

Vercel deploys `main` automatically (project `lot-dossier-assistant`, framework preset Other, no environment variables). `vercel.json` serves `public/` and gives the API functions up to 300 s. Run `python3 build.py` and commit `public/index.html` before pushing.

## Limits

- Recorded plats and the parcel-record API are read for **Weber County** only so far. Other counties get the map-based checks.
- The CC&R *text* is only sold by county recorders. The dossier identifies the recorded documents and uses development standards from public meeting packets.
- Cost ranges in `config/cost_assumptions.json` are placeholders. Replace them with local bids.
- This is a screening tool, not a survey, geotechnical report, title report or appraisal.

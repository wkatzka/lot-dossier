# Cornerpin

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
| `GET /api/notices?q=<subdivision>&county=Weber&juris=<city>` | Searches Utah's Public Notice Website for the subdivision and reads the matching agendas and meeting packets. Packets are fetched as parallel byte ranges and read in memory, never stored. Returns development standards tables, utility will-serve statements, CC&R recordings and approval history, each with a citation. It also splits packets into individual staff reports, so only the lot's own subdivision and phase are read, and flags scanned will-serve exhibits. |
| `GET /api/plat-sheet?url=<plat sheet>&lot=4` | OCRs one recorded plat sheet: notes, setbacks, referenced entries and what's drawn around the lot. One sheet per call, so all sheets run in parallel. |
| `GET /api/packet-ocr?url=<packet PDF>&pages=92-98` | OCRs scanned exhibit pages from a public-meeting packet (page images pulled with pdf.js) and extracts water-service facts: supplier, share classes, water rights, storage, fire flow, supply status. |
| `GET /api/hoa?q=<subdivision>&county=Weber` | Looks the association up in the Utah HOA registry: registration status, expiry and role-based contacts. |
| `GET /api/watch?entity=<city>&since=2026-01-01` | Lists fee actions (fee schedules, impact fees, fee agreements) on a public body's agendas. Dossiers compare them with `config/records.json` to flag stale fee figures. |

The API only fetches documents for the lot being looked up. Results are cached at Vercel's CDN, so repeat lookups are instant.

## Agenda watch

Fee schedules and impact fees change by council resolution, and every change has to appear on a public agenda first. `config/records.json` lists, for each pilot jurisdiction, the fee actions already reviewed and the records the dossier relies on (with the custodian to request them from).

- Every dossier checks the agendas live: the fee row says when they were last checked and turns to Verify if a fee action is newer than the reviewed list.
- `.github/workflows/agenda-watch.yml` runs `scripts/check-agendas.js` every Monday and opens an `agenda-watch` issue for each new fee action. To close one, review it, update any figures, add it to `known` and set `asOf`.

Test locally without opening issues: `DRY_RUN=1 node scripts/check-agendas.js`.

## Develop

```bash
npm install
python3 build.py            # -> public/index.html
npm run dev                 # app + API on http://localhost:3000
```

Single file to email (calls the deployed API):

```bash
python3 build.py --api https://YOUR-PROJECT.vercel.app   # -> dist/Cornerpin.html
```

## Deploy

Vercel deploys `main` automatically (project `lot-dossier-assistant`, framework preset Other, no environment variables). `vercel.json` serves `public/` and gives the API functions up to 300 s. Run `python3 build.py` and commit `public/index.html` before pushing.

## Limits

### Capability checklist

- Delivered: Cornerpin branding, address/plan dossiers, permit-packet navigation and preparation, full plat downloads and cross-sheet easement evidence.
- Delivered as screening: private in-ground pool rules for Ogden Valley City, linked to existing groundwater, terrain, hazard, service and easement findings. Runs without a pool plan; no pool placement or eligibility approval is calculated. Rules checked 2026-11-07; the verified state code version expires 2027-01-01.
- Attempted but unresolved: complete easement applicability and geometry. Recorded instrument images/title exceptions remain a records-access dependency; survey registration and interpretation are not implemented.
- Unimplemented: mineral-rights ownership determination and defensible market valuation (complete title evidence and licensed comparable sale data are dependencies), pool-plan extraction/placement, and permit submission on behalf of a user. Permit preparation is not filing.

Run `node scripts/test-pool-screen.js` for pool screening scenarios (shallow groundwater, missing evidence, non-pilot jurisdiction, expired state-code verification and sewer/septic distinctions).

- Recorded plats and the parcel-record API are read for **Weber County** only so far. Other counties get the map-based checks.
- The CC&R *text* is only sold by county recorders. The dossier identifies the recorded documents and uses development standards from public meeting packets.
- Cost ranges in `config/cost_assumptions.json` are placeholders. Replace them with local bids.
- This is a screening tool, not a survey, geotechnical report, title report or appraisal.


### Easement evidence and full plat downloads

The report and saved dossier include a five-gate evidence checklist: property identity, plat scope, recorded restrictions, survey mapping and design comparison. Each gate shows evidence, a concrete gap and a completion criterion. Linked-sheet OCR progress updates from actual results (including omitted/failed results), separately from the overall `Partial evidence` status. Zero sheets, attachments, task completion and unsupported clearance booleans cannot advance that status. The evaluation timestamp is not represented as a fresh source check or a title effective date.

Higher milestones are defined as documents reconciled, mapped, and design checked; their title/survey/design evidence ingestion and verification are **not implemented**. The current pipeline intentionally cannot award them. Refresh triggers include title updates, recorded amendments/releases and survey/design changes, plus purchase/submission milestones; annual refresh is not a completeness test.

The dossier retains all linked plat sheets and merges lot readings instead of discarding all but one sheet. Lot-label proximity to an image edge is a citation-selection hint, not verified boundary geometry. Easement excerpts from labels, general notes and legends are marked as discovery leads; they can concern other parcels. Separately recorded instruments, releases, title exceptions and survey geometry remain unresolved. Site-plan fit is a setback-only screen.

`GET /api/plat-bundle?county=Weber&parcel=...` downloads all linked sheets as a PDF, preserving native image pixels and adding source footers outside the drawing. It fails explicitly instead of omitting sheets if a source fails, exceeds the response limit, or is unsupported. Run `node scripts/test-plat-evidence.js` for cross-sheet attribution, incomplete-coverage and extraction regression checks.

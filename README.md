# Cornerpin

Live: **https://lot-dossier-assistant.vercel.app**

Due-diligence dossiers for Utah spec-home lots, generated from public records. You enter an address or parcel ID, and the dossier covers water rights, geologic hazards, septic vs. sewer, utilities, zoning and setbacks, CC&Rs, fees and permits. If you upload a building plan, it also checks the plan against the lot.

## How it works

**In the browser** (`web/`, built into `public/index.html`):
- Finds the parcel in UGRC's statewide parcel layers.
- Queries 20+ state, county and federal map services directly (all allow cross-origin requests).
- Reads an uploaded plan-set PDF with pdf.js. The file is read locally. An explicitly requested cloud save can copy project files to configured private storage.
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

The API only fetches documents for the lot being looked up. Results are cached at Vercel's CDN, so repeat lookups can be faster; source retrieval and OCR can still take minutes.

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

- Substantive-work plan: [public-source evidence, ownership, valuation and placement tasks](docs/substantive-dossier-plan.md), including dependencies and acceptance criteria. User-provided title packages, private surveys or sales subscriptions are not prerequisites to the public-source workflow.
- First source adapters: state Trust Lands mineral-interest screening queries the full mapped parcel, reconciles returned record IDs, distinguishes commodities and reports source failures separately from no matches. It does not determine private/federal mineral ownership. Weber filed-survey discovery searches the public index for subdivision-name candidates and links available original PDFs; applicability and geometry remain unverified. Unit tests: `node scripts/test-mineral-screen.js` and `node scripts/test-surveys.js`; optional live tests use `--live`.
- Workspace theme explicitly uses the homepage foreground/background palette under both light and dark device preferences; forced-light-mode browser verification compares computed homepage/workspace text colors.

- Navigation refinement: Generate dossier opens the saved project overview automatically. The workspace uses the homepage photographic background and dark palette. The site report retains its map/summary, followed by keyboard-accessible category chips showing one category at a time. Easement evidence and plan details remain with their categories; contacts, next steps and cost considerations have their own chips. The full source permit packet lives under Permit filing. Downloaded dossiers retain all sections; printing the interactive report reveals all categories.

- Permit lifecycle structure: one locally saved project per property, linked to the site report. Projects contains Overview, Permit filing, Permit management, Documents and Activity. Generated reports create/update the same property project; plan updates renew requirement reviews. Uploaded plan PDFs carry into the project document store. Assessor owner information is prefilled when available and remains subject to review.
- Filing preparation: requirements with reviewer/evidence/waiver basis, applicant details, frozen version-specific package downloads, official portal handoff, and user-recorded filing receipts. Packages are downloadable HTML archives containing document downloads and a JSON snapshot, not jurisdiction-specific completed forms or evidence of submission.
- Permit management: user-confirmed reviewer text intake with original source, review rounds, responsible person/due date, document revisions, response drafts, resubmission receipts, reviewer acceptance evidence and issued-permit records. Assignment drafts are downloaded, not sent. Uploading revisions does not establish reviewer acceptance.
- Persistence: IndexedDB project metadata and original file blobs, SHA-256 checksums, atomic writes and revision checks against concurrent tab changes. Storage is browser-local, with 25 MB/file and 100 MB/project limits. Older checklist attachments remain in their existing store and are not automatically migrated. JSON history exports contain metadata only; package exports include their selected files. Clearing browser data removes stored work.
- External dependency investigated: the pilot uses City Inspect. Its public site describes reviewer comments/resubmissions, but no authorized third-party permit API/portal session has been established. Automated filing and city monitoring are **blocked by that access dependency**; the UI explicitly disables automatic submission and never fabricates a successful sync.
- Not attempted in this structure increment: server accounts/shared team storage, background jobs/reminders, automatic correction-letter extraction, authenticated city connector, fee payment/signature execution, and multiple concurrent permit applications per property. Outbound messages require a connected sending service and user authorization. Manual feedback intake and receipt recording are working fallbacks, not completed automation.
- Validation: `node scripts/test-permit-workflow.js` exercises missing evidence, immutable snapshots, changed-document invalidation, duplicate clicks/imports, correction preparation, resubmission, acceptance and issuance. Browser verification used a real pilot site report plus a separate synthetic lifecycle through issuance and reload; no synthetic city feedback is embedded in production.

- Homepage and report language: property-first search, report sections, source-backed rule excerpt, explicit data/verification limits and reduced background contrast. Plans are added from the generated report and update the same parcel's checks and permit packet using its retrieved documents. A new property starts without the previous property's plan. Saved reports retain the updated findings. Placeholder cost ranges are disclosed separately and no longer summed into a headline budget.
- Public preview uses an actual published pilot-city rule, not a full property example. Publishing a complete example report remains unattempted pending selection of a nonproprietary demonstration property; no private pilot details are embedded in the homepage.
- Validation: browser-tested a real pilot site review followed by manual basement-plan entry, removal of that plan without stale findings, and local PDF extraction followed by a report/permit-packet update. `node scripts/test-plan-evidence.js` checks groundwater provenance and prevents mapped conditions from being presented as a field measurement or slab clearance.

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

Public survey PDFs are also read automatically (up to three candidate documents per report, 25 pages / 15 MB each). Recording references retain page citations, content hashes and unresolved lot applicability. Reading a filed PDF does not establish that it is an executed recorded instrument or provide registered survey geometry. Run `node scripts/test-survey-document.js` for reference extraction checks; optionally pass a public index record number for a live source check.

## Research workspace

The project workspace includes an evidence register, page-cited public survey originals, candidate CAD-layer alignment, mineral source screens, residual land-budget scenarios, and pool/deck/equipment layout scenarios. Refresh retains history and marks prior reviews/calculations stale. Project backups include file bytes and validate SHA-256 on restore.

These tools do not establish a complete easement inventory, private mineral title, a validated local market value, or precise construction placement. See [the execution ledger](docs/substantive-dossier-plan.md) and [tested source access](docs/research/source-access-matrix.md) for actual coverage and unresolved dependencies.

Optional owner-only cloud sync is implemented but requires provisioning and live authorization testing described in [storage setup](docs/research/storage-setup.md). Browser storage remains the default. Automatic city filing and review monitoring are not connected.

Run the deterministic checks with `for f in scripts/test-*.js; do node "$f" || exit; done`, then `python3 build.py --api https://lot-dossier-assistant.vercel.app`. Live source tests are opt-in; synthetic tests validate arithmetic and failure behavior, not market accuracy or title completeness.

### Daily AI spend guard

Cornerpin's two paid analysis paths use `lib/ai-budget.js` and the atomic ledger in
`db/ai-budget.sql`. The global cap is $5 per calendar day in America/New_York,
shared across users and deployments using this database. Cached analyses bypass
paid requests. The existing per-account request-count limit also remains active.
This guard covers Cornerpin's Anthropic Messages calls, not hosting, storage,
other applications using the same API key, taxes, or unrelated provider charges.

Each call reserves the full supported context/output cost before contacting the
provider, then settles returned token usage even when the generated answer later
fails validation. Currently a 16,000-output-token Sonnet 5.5 call reserves $2.257152;
this deliberately stops new calls early when less than that remains. Timeouts,
unknown usage and settlement failures retain the reservation through that day.
Unknown models/configurations and database failures block paid calls. Update the
pricing allowlist before changing models; do not replace it with estimated token
counts if a strict spend ceiling is required.

Provision `db/ai-budget.sql` in Cornerpin's Supabase project. Store a single
`secret_hash` in `cornerpin_private.ai_budget_auth`: SHA-256 of the hex SHA-256 of
`cornerpin-budget-v1:` followed by the server's Anthropic API key. Provision this
out of band; never put the key or derived credential in frontend code or logs.
Rotating the API key requires updating that hash. The RPC validates this
Cornerpin-specific derived credential before accessing the private ledger;
ordinary signed-in users cannot alter it. No extra serverless function is used.

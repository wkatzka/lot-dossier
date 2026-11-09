# Cornerpin: evidence, ownership, valuation and placement implementation plan

## Objective and retained capabilities

Deliver a pilot-property dossier that supports a traceable assessment of recorded restrictions, mineral interests, market value and proposed pool placement. Preserve the address-to-project overview, category report, uploaded plans, source citations, versioned documents, permit preparation and correction workflow. Do not embed private property details in the public repository.

Completion is evidence-specific and dated. A successful GIS lookup, uploaded document, inferred line or checked task cannot establish legal ownership, clear title, surveyed geometry, approval or a reliable valuation. Automate retrieval, extraction, calculations and consistency checks; expose unresolved professional decisions.

## Public-source requirement

The user requires public-source retrieval and established calculation methods as the default. No title commitment, private survey or licensed sales subscription supplied by the user may be a prerequisite for the core product. Discover and retrieve public recorded instruments, filed surveys, mineral records and available transaction evidence ourselves. User uploads are optional enhancements. Publicly viewable data still needs permitted acquisition/reuse; no unauthorized subscriptions or scraping. Calculation methods cannot establish an unrecorded ownership fact or recover unavailable boundary precision. Record the precise gap and continue independent work.

## Sequence and dependencies

Access audit → evidence store → title reconciliation → survey geometry → placement.
Mineral research shares the title chain. Public comparable and market-evidence acquisition can run concurrently; valuation uses reconciled development constraints. Final validation requires all four capability tracks, not merely working screens.

### A. Source access and pilot evidence inventory

- A1: Test the official state mineral service schema, spatial queries, browser access, partial results and failures. Preserve source record IDs and retrieval timestamps. **Implemented and tested against a live positive-control source polygon; pilot browser verification passed.**
- A2: Verify county abstract/instrument retrieval, parent-parcel search, image coverage, automated retrieval/caching/display rights and credentials. Subscription existence does not establish API rights. **Investigated; access not established.**
- A3: Build the pilot evidence inventory from public parcel history, recorded references and filed survey sources. Match legal description, parcel and effective dates; do not wait for user-provided documents. **Public survey discovery implemented; title-instrument discovery/reconciliation remains incomplete.**
- A4: Investigate county survey index and public surveys as discovery sources; distinguish indexed coverage from a current boundary/topographic survey. **Public index adapter implemented and live-tested; original links discovered and five-page pilot PDF read successfully with page-cited recording references. Survey applicability and geometry remain unverified.**
- A5: Audit publicly available transaction prices, public market statistics, permitted listing observations and public cost/fee sources. Separate actual closed-sale prices from asking prices and assessed values. **Bounded public coverage audit executed: 17 candidate records, four source-verified county sold reports (one improved), zero strict backtest holdouts. Public-source acquisition remains incomplete; see `research/backtest/README.md`.**
- A6: Confirm federal mineral-status coverage and original-patent discovery paths. State and federal screens must not label the remainder privately owned. **Source identified; connector not implemented.**

Acceptance: a source matrix with a working sample query/document, legal usage basis, coverage, authentication, refresh behavior, failure behavior and named access gap. Do not buy services or send outreach without authorization.

Verified sources:
- State mineral ArcGIS service: https://gis.trustlands.utah.gov/mapping/rest/services/Ownership_Mineral/MapServer/0 . Fields verified: objectid, oilgasown, coalown, otherown, legalown, countylabel. This covers Trust Lands mineral interests, not a private mineral title chain.
- County abstracts: https://www.webercountyutah.gov/Recorder_Surveyor/abstract_title_reg.php . The public page describes quarterly subscription access and a separate document-order path; it does not establish instant API access or permitted redistribution.
- Filed surveys: https://www.webercountyutah.gov/Surveyor/Filed-Record-of-Surveys/ . Index discovery is not proof the applicable current survey is present.
- Federal mineral/land system: https://www.blm.gov/services/land-records/mlrs . Coverage is federal records, not all private transactions.
- MLS terms: https://www.utahrealestate.com/support/public.license.agreement/ . This is not part of the default public-data pipeline; public visibility does not by itself authorize commercial reuse.

### B. Shared evidence foundation

- B1: Define versioned records for property identity, source documents, extracted claims, restrictions, mineral interests, geometry, comparables, valuation runs and layout runs.
- B2: Store original files privately with checksums, original filenames, acquisition source, acquired date, document date, recording number, effective date and supersession links. Preserve originals and every revision.
- B3: Add page-level text extraction/OCR with citations and extraction confidence. Imported document text is data, never executable instructions. Detect conflicting identifiers, missing pages and duplicate documents.
- B4: Create a review queue: proposed extraction → reviewed claim → applicability decision. Each decision needs reviewer, date, scope, basis and evidence references. Do not convert extraction confidence into legal confidence.
- B5: Add dependency links and invalidation: changed title exception, document, geometry, local rule, comparable or plan revision marks dependent outputs stale. Track source availability separately from successful lookup.
- B6: Add authenticated private project/file storage and permissions before team sharing or paid/private source ingestion on the hosted service. Existing browser storage remains explicitly local until migration is complete. Design export/import and retention controls.

Acceptance: retrieve the exact original page behind every material conclusion; revise a source and see every affected output lose its current status. Access-control tests must prevent cross-project reads. Metadata-only exports must not masquerade as complete backups.

### C. Easement reconciliation

- C1: Retrieve the applicable public plat set, recorded instruments, parent-parcel history and linked amendments/releases. Build an instrument inventory with coverage limits. If a title commitment is optionally available, reconcile its exceptions too; do not claim a public inventory equals a title commitment.
- C2: Extract granting language, benefited/burdened property, width/location, uses, access/maintenance rights, dates, duration, termination/release and amendment relationships.
- C3: Reconcile each discovered restriction and optional title exception to the actual instrument and property identity. Maintain explicit statuses: missing instrument, applicability unresolved, applicable, amended, released with evidence, blanket/unplottable, mapped.
- C4: Cross-check survey notes against the title inventory. Missing survey annotations do not remove an exception. Reconcile document dates and material conflicts through a qualified reviewer.
- C5: Present a restriction register with source pages, review basis, effective dates and missing evidence. Mark completeness only against the identified dated inventory and review scope.

Acceptance cases: a lot split across sheets; an easement on a parent parcel; a recorded release; conflicting widths; a blanket right; missing exception image; apparent label relating to a neighboring lot. No automatic all-clear in any unresolved case.

### D. Mineral interests

- D1 (**implemented; live positive-control and failure tests pass**): Query the complete mapped parcel polygon against Trust Lands interests, retain all returned IDs and distinguish oil/gas, coal and other minerals. Report boundary-touch candidates without claiming overlap acreage or ownership fractions.
- D2: Add federal land status/patent/reservation evidence and connect it to the parcel/title chain.
- D3: Extract mineral reservations, conveyances, fractional interests, commodities, depths and surface-use rights from source instruments. Trace subsequent transfers and unresolved gaps.
- D4: Present separate statuses for public interest screening, private chain completeness and reviewed ownership conclusions. Absence from a public layer never means the surface owner owns the minerals.

Acceptance cases: no public-layer match, multiple intersecting state interests, commodity-specific ownership, missing source fields, API failure, transfer-limit truncation, a private mineral severance and inconsistent fractional interests. Full private ownership remains blocked until its chain is obtained and reviewed.

### E. Survey geometry and precise placement

- E1: Discover and retrieve filed public surveys and available public control/monument data; extract dimensions and register geometry for review. Accept survey-quality georeferenced vector data where publicly available; capture coordinate system, datum, units, survey date and source precision. Support a reviewed registration workflow for scanned plans; do not infer surveyed precision from image alignment.
- E2: Validate closed boundaries, topology, holes, coordinate transforms, units, area and control-point residuals. Reject ambiguous or invalid imports. Require review when registration errors exceed the stated tolerance.
- E3: Encode easement geometries with instrument IDs, uncertainty and applicability. Blanket/unlocated restrictions remain constraints even when no polygon can be drawn.
- E4: Version local rules with source pages, effective dates and applicability. Separate pool waterline, shell, deck, equipment, barriers, building/retaining-wall clearances, drainage, utility and septic constraints.
- E5: Build geometry intersection/distance/buffer checks using established libraries. Include placement tolerance rather than declaring a line-touch safe. Add excavation access and terrain constraints where supported.
- E6: Build the placement UI: surveyed layers, draggable/dimensioned pool, deck/equipment footprints, conflict list and source-linked explanations. Save alternatives and exact layout revision. Show engineering/approval items separately from geometric checks.

Acceptance cases: narrow/concave lot, interior hole, boundary touch, mixed units, wrong datum, rotated pool, intersecting utility easement, missing septic field, unknown restriction geometry, shallow groundwater and significant slope. Results identify which constraints were actually tested. Final siting remains conditional on applicable professional design and approvals.

### F. Market value and builder land budget

- F1: Ingest publicly available, permitted closed land sales with sale date/price, property identity, usable area, utilities, entitlement, access and transaction qualifications. Keep listing prices distinct from closed sales.
- F2: Where public closed-sale evidence is insufficient, keep market valuation unresolved rather than treating asking prices as sales. Independently calculate a public-input residual budget with explicit assumptions and sensitivity. Deduplicate, flag non-arm's-length/atypical transactions, match submarket and date, and measure comparable coverage. Refuse a precise market estimate when evidence is insufficient.
- F3: Implement transparent adjustment models for time, size, site readiness and constraints. Preserve original/adjusted prices, adjustment basis, weights and excluded comparables. Estimate uncertainty from validation, not a fabricated confidence score. **Research implementation now present in `research/valuation/`: robust regularized log-price model, nonlinear size/site effects, learned comparable adjustments, evidence/support gates, chronological calibration intervals. Pilot coefficients remain unfitted because qualified public observations are insufficient.**
- F4: Build a separate residual budget: net projected finished-home proceeds less vertical/horizontal construction, fees, finance/carry, selling costs, contingency and target developer profit. Prevent double-counted cost lines and record the basis of every assumption.
- F5: Validate on withheld local transactions using time-separated evaluation and report absolute/relative errors and interval coverage. Compare against a simple baseline. Recalibrate before expanding geography. **Actual multi-attribute pipeline executed on the public evidence set; zero eligible records, metrics null. Ten synthetic engineering tests pass but establish no market accuracy. Empirical pilot validation remains blocked by data coverage.**
- F6: UI: market range, supporting comps, residual land budget, sensitivity controls and explicit missing/estimated inputs. Do not relabel assessor value or generic cost placeholders as market value.

Acceptance: reproducible calculations, no training/evaluation leakage, error report on held-out transactions, sensible abstention with sparse comps, and sensitivity to real entitlement/service/site-cost differences. A synthetic example alone does not validate market accuracy.

### G. Integration, refresh and release

- G1: Add category-level evidence states and source dates to the existing dossier and project overview; propagate current constraints into permit preparation.
- G2: Reconcile old checklist attachments with project documents without losing files or silently marking evidence verified.
- G3: Test the complete pilot flow: address → original documents → reviewed restriction/title record → survey registration → layout alternatives → valuation → permit packet. Include source outages and reopened reviews.
- G4: Trigger review on relevant title/record updates, survey/plan changes, code changes and valuation staleness; require a review at purchase/submission milestones. Annual refresh alone is insufficient.
- G5: Deploy only capabilities whose source and failure cases pass. Keep unavailable modules explicit. Maintain pilot-only scope until acceptance criteria pass.

## Release order and completion ledger

1. Source inventory, public state-mineral screen, and actionable access gaps.
2. Public document ingestion and reviewed restriction register; private uploads remain optional.
3. Survey geometry, mineral-chain review and placement engine.
4. Public-evidence valuation and residual model; prove actual coverage before declaring market accuracy.
5. Integrated pilot validation and production storage/refresh hardening.

Current: existing dossier/navigation/permit preparation retained. Full easement reconciliation is unresolved; private mineral determination, defensible valuation and precise placement are not delivered. Public state-mineral screening is a first source adapter, not a substitute for those objectives. Update this ledger after each verified increment.

### Verified first increment — 2026-11-07

- Workspace palette corrected and visually tested under forced light theme against homepage colors.
- State mineral polygon query tested with an actual positive source geometry; empty source results require a confirmed zero count. Private and federal title determinations remain unresolved.
- Public survey index discovery tested against the pilot: original PDF links accessible. Added bounded original-PDF reading, SHA-256 provenance and page-specific recording-reference extraction, including comma-separated references.
- Easement reconciliation: attempted but unresolved; discovered references still need original instrument retrieval, applicability, amendments/releases and geometry reconciliation.
- Mineral ownership determination: attempted but unresolved; state mapped-interest screening is delivered, private/federal chain reconciliation is outstanding.
- Defensible valuation: implementation unattempted in this increment; public comparable coverage and residual-model validation remain required.
- Precise pool placement: implementation unattempted in this increment; existing preliminary screening retained. Public survey geometry registration, complete constraint geometry and placement checks remain required.
- Automatic city filing/updates remain blocked by an unconfigured city connection; existing preparation and manual management are retained.

## Full-plan execution ledger — second implementation pass

This is an implementation and evidence ledger, **not a claim that the entire requested product is complete**. All original objectives remain in scope. See [source-access-matrix.md](research/source-access-matrix.md) for tested dependencies and [storage-setup.md](research/storage-setup.md) for the prepared cloud activation path.

| Tasks | Implemented / tested | Unmet acceptance and status |
|---|---|---|
| A1, D1 | State polygon queries with ID reconciliation and positive/failure tests | Complete for the stated public-layer screen only. |
| A2–A4, C1 | Recursive public parent-parcel history, original public survey retrieval, SHA-256, page references, CAD-layer extraction, public geometry and monument queries | **Attempted but unresolved:** full original instrument/parent-chain/amendment/release retrieval; current abstract route requires access not established under the public-source requirement. |
| A5, F1 | Public assessor schema, official auction/tax-sale sources and national cost references investigated; inappropriate substitutes excluded | **Blocked for a defensible pilot value:** verified matched public closed-sale observations and independent holdout set not obtained. No private feed assumed. |
| A6, D2 | Federal mineral polygon adapter retains patent/serial/commodity attributes; real positive control and pilot tested | **Attempted but unresolved:** original patent/reservation retrieval and chain linkage. |
| B1–B3 | Versioned source/reference ledger, retained public PDF originals, checksums, page-linked candidate clauses and recording references; partial/error states | **Partial:** general recorded-instrument originals unavailable; existing OCR handles plats/scanned packets, not every possible instrument format. |
| B4–B5, C2–C5 | Original-instrument linking, dated applicability review, release/amendment evidence gates, relationship candidates, review history, refresh invalidation | **Attempted but unresolved:** actual pilot applicability decisions and complete dated restriction inventory. A reviewed reference list is not a complete title search. |
| B6 | Owner-only cloud adapter, SQL RLS/storage policies, explicit sync UI, conflict checks, checksum transfers; mocked authorization tests | **Blocked:** storage/authentication service not provisioned; live cross-account RLS tests cannot run. No team storage claim. |
| D3–D4 | Candidate mineral clauses; scoped fractional-transfer reconciliation engine and severance/unknown tests; separate state/federal/private status | **Blocked for ownership conclusion:** reviewed root and full dated conveyance/reservation chain unavailable. Core arithmetic does not supply missing documents. |
| E1–E2 | Source CAD paths and public control retrieved; similarity registration with independent check point; candidate pilot alignment; CRS/unit/topology checks | **Attempted but unresolved:** verified closed lot/constraint geometry and source absolute accuracy. Polygonization of triangulated drawing strokes did not recover the target lot; rejected. Candidate alignment is not approved registration. |
| E3–E6 | Pool/deck/equipment scenario UI, drag/numeric movement, orientation, versioned runs, real geometry difference/buffer/intersection checks, unknown restrictions, source-rule minimum, candidate easement overlay | **Blocked for precise placement:** current surveyed boundary, interpreted restrictions, full local rule applicability, structures/service/septic/drainage/access/terrain/barrier evidence. Existing pilot code/hazard screens retained; no final clearance. |
| F2–F4, F6 | Transparent residual budget including overhead, separate acquisition costs, per-input basis, nine sensitivity cases; comparable exclusion/adjustment/range engine with validation gate | **Partial:** numeric public-input pilot market/residual estimate remains unsupported where sale/cost inputs are unavailable. Scenario arithmetic is delivered; it is not a validated valuation. |
| F5 | Holdout error metrics and temporal-leakage checks implemented/tested | **Blocked:** actual local held-out transaction set unavailable. Synthetic arithmetic tests do not validate accuracy. |
| G1–G2 | Research workspace categories, report snapshots, automatic legacy attachment copying without approval, original-file retention, full backup/restore | Existing navigation, aesthetic, plan checks, dossier/permit preparation retained. Real pilot browser checks passed for eight recording references, three retained PDFs, candidate alignment, scenario saves, refresh and complete-backup download/checksum recovery. |
| G3–G5 | Real pilot acquisition and scenario flow tested; source failures, unknown coverage, stale versions, missing/corrupt backups, geometry edge cases and access conflicts tested | **Blocked for complete end-to-end acceptance:** final title/value/precise-placement conclusions and live cloud/city connections. Manual preparation/management retained; no automatic filing/monitoring claimed. |

Refresh is available from the project overview and retains the current plan. It bypasses the outer document-response cache where supported; source index caches and upstream publication delays still apply. It invalidates prior applicability reviews and saved calculation currency. No background source monitoring runs.

Release validation: all deterministic `scripts/test-*.js` checks passed, all browser/server JavaScript syntax checks passed, and both hosted/standalone builds passed the proprietary-content guard. Original PDF proxy transfers are capped at 4 MB; larger originals remain linked and retention failure is recorded. Oversized checklist attachments remain intact in their original store and generate an activity entry.

Valuation data follow-up: four explicit 2019 Ogden Valley sold prices recovered from a county-public acquisition exhibit; one excluded as improved property. Historical listing features retained with page provenance, but pre-sale snapshot integrity, transaction qualification and representative holdout coverage remain unresolved. See `docs/research/backtest/historical-sales-seed.json`. No market-accuracy claim enabled.


## Valuation qualification audit and public empirical tests — 2026-11-07

- Corrected research admission: 3 of 17 pilot candidates retained; 13 lack closing amounts; 1 includes buildings. Missing optional attributes and absent original-publication timestamps no longer erase supported retrospective observations. These are conditional agricultural/development sales, not final pilot comparables.
- Added and actually ran a separate public Cook County partial-information hedonic model. 2020: 100/196 within ±$50k. Fresh 2024 dollar-MAE policy: 155/613; tolerance-tuned policy sensitivity: 177/613. Both 2024 policies use earlier tuning outcomes, never test outcomes, for selection. Reports preserve individual predictions, filters, chronological partitions, parcel embargo, source links, dataset hashes and baselines.
- **Completed:** real public-data backtest execution and user's ±$50k metric. **Attempted but unresolved:** reliable tolerance-band performance. **Blocked by local data coverage:** independent Utah validation; only three supported historical research observations recovered. External benchmarks do not validate Utah or authorize a production accuracy claim.
- Full title/easement reconciliation, mineral ownership, precise pool siting and live storage/city integration remain at their existing status in the ledger above; no scope removed or substituted. See `research/valuation/README.md` and `docs/research/backtest/valuation-audit.html`.


## Weber-only valuation follow-through — 2026-11-07

- Recovered seven distinct local residential-use land sale records, retaining rural-tract classification, historical service descriptions and source page/hash evidence. County-hosted MLS reports are price evidence, not independent settlement verification. Deduplicated one repeated sale; excluded bundled/improved transactions from the primary dataset.
- Built and ran a local partial-information, regularized nonlinear hedonic model. Frozen first-five/train, final-two/test: 1/2 within ±$50k, MAE $109,964. Rolling chronological test: 0/4, MAE $199,316. Fixed hyperparameter; no held-out tuning. Source and feature timing limitations explicitly retained.
- **Completed:** local model implementation and actual Weber held-out evaluation. **Attempted but unresolved:** representative local price/attribute coverage and reliable tolerance-band accuracy. **Blocked by insufficient local accuracy evidence:** production promotion. Small-sample complexity is not proof of a defensible market valuation.
- Reproducible inputs/results/report: `docs/research/backtest/weber/`; evaluator/tests: `research/valuation/weber_backtest.py` and `test_weber_backtest.py`. Earlier Cook experiments are not used for Weber training, validation or approval.
- Original easement/mineral/precise-pool/storage/city requirements retain their existing status; no replacement or completion claim.

## Weber data expansion and model repair — 2026-11-07

- [x] Investigate the hardest dependency: more public local closing prices with attributable historical characteristics. Expanded county packet inventory, OCR, public portals, broker exhibits and state reports; `docs/research/backtest/weber/expanded-source-audit.json` preserves coverage and exclusions.
- [x] Diagnose the miss and implement a replacement research model: within-region/segment size effects and local adjusted-comparable anchoring; chronology, parcel-overlap and target-outcome leakage tests; source-linked adjustments and explicit unsupported effects.
- [x] Run actual revised predictions and stability checks. Reused final-two outcomes: 2/2 within $50k, MAE $40,712; rolling 3/4, MAE $39,495. Excluding atypical transactions: 0/2, MAE $88,359. Delete-one instability remains large. These are post-inspection development diagnostics, not fresh validation.
- [ ] **Attempted but unresolved:** expand the primary residential-lot dataset beyond seven. Three new multifamily-development observations retained separately; unverified portal prices and house-containing transactions do not increase the primary count.
- [ ] **Blocked by a specific data dependency:** independent, representative Weber closing-price/dated-feature observations sufficient to establish the requested ±$50k accuracy. No fresh independent test records recovered in this pass; no production promotion.
- Existing dossier navigation, easement completeness, mineral ownership, precise pool placement, cloud storage and city integration retain their earlier ledger statuses. This valuation pass does not complete or remove those requirements.


## Public-source follow-through — 2026-11-09

This dated update supersedes older account/storage and “not implemented” labels above; it does not close missing evidentiary requirements.

- [x] City Inspect registration opened for the user. Applicant setup remains with the user; no permit submitted.
- [x] Shared storage/account foundation: live owner-isolation and cross-device tests previously passed; current My projects regression passes. Older “not provisioned” ledger entries are obsolete.
- [x] Pool calculation: automatic bounded search evaluates complete pool/deck/equipment assemblies at up to 400 positions/orientations, retains source/coverage gaps, saves the selected scenario and lists alternatives. Equipment position now rotates with the assembly. Utility exclusion, interior-hole, narrow-lot, sampling-limit and unknown-coverage tests pass.
- [x] Actual pilot mapped-boundary experiment: 400 samples, 204 passing supplied boundary/tolerance checks, three preliminary candidates. No utility/easement geometry was supplied in that isolated boundary experiment. These counts are not usable-area percentages or approved locations; full constraints remain unresolved.
- [x] Valuation: property-specific delete-one sensitivity calculated from the existing research dataset. It is explicitly neither a confidence interval nor independent accuracy validation. Browser/Python prediction parity preserved.
- [x] Easement checklist corrected to make public-record research the primary path; a private title commitment is optional. Existing candidate survey registration is now described accurately.
- [ ] Easement reconciliation: **attempted but unresolved / blocked by original-instrument access.** A publicly indexed county Frontier title-commitment lead redirects to login; public project list explicitly requires a Frontier account. Its snippet is not used as a retrieved original or proof of applicability. County abstract access remains subscription-based. No current complete instrument/release inventory established.
- [ ] Mineral ownership: **attempted but unresolved / blocked by the root and subsequent instrument chain.** No federal-layer match for the pilot in retained source response; that does not establish private ownership. New public searches did not recover the missing original chain. Fractional-transfer arithmetic remains available but cannot manufacture a root or reservation.
- [ ] Defensible current valuation: **attempted but unresolved / blocked by independent representative local closing-price observations.** New targeted 2024–2025 public appraisal searches did not produce an additional qualified lot closing. Seven historical research observations remain; the original ±$50k target is not validated. No regional home index substituted for land appreciation.
- [ ] Precise pool placement: **attempted but unresolved / blocked by verified boundary/constraint geometry and applicable complete rules.** Search works with public parcel outlines and available utility polygons; unlocated recording references remain unknown. No precise siting or permit-clearance claim.

Public access checks: https://frontier.co.weber.ut.us/p/Public/List redirects to login-required; https://www.webercountyutah.gov/Recorder_Surveyor/abstract_title_reg.php describes abstract access; https://archives.utah.gov/research/series/6098/ identifies historical deed-index holdings, not a complete current digital chain. Source-access limits were investigated before implementing calculation improvements. No proprietary pilot identifiers added to public source code or this ledger.

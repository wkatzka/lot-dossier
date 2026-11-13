# Cornerpin product-correctness checklist

Created November 12, 2026. Basis: [platform audit](../ux-audit/platform-value-2026-11-12/audit.md). This is the working implementation checklist and progress record, not a claim that the audit findings are fixed.

## Working agreement

Complete one numbered task, verify its acceptance criteria, record evidence and deployment status, then report the result and any change in plan. Material changes to scope or behavior will be discussed at that checkpoint. Routine implementation choices do not require renewed permission. Preserve existing branding, raw-document access, GIS comparisons, source disagreements, contacts and the distinction between submission, issuance and construction. Do not send third-party requests or invent missing evidence.

Statuses: `[ ]` not started, `[-]` in progress, `[x]` implementation verified. Production validation is recorded separately; a local check is not a production release.

## Hardest dependency: consistent evidence identity and resolution

The core dependency is identifying the same decision across report findings, public-document claims, rule reviews, application answers and exported snapshots. Today they use different identifiers/state stores. The existing instrument ledger already supports hash-bound reviews and original page citations; extend/reuse that where appropriate rather than introduce another independent truth store. Build an explicit mapping and version-invalidation contract before migrating user decisions.

Initial investigation: `app.js` stores site checklist status separately; `project-overview.js` counts raw finding statuses; `evidence-ledger.js` supports instrument-specific reviews; `permit-workflow.js` has separate requirement/rule decisions. Legacy done states do not record whether a user chose Done or a file upload caused it. They cannot safely be silently treated as verified decisions or indiscriminately reset. Task 05 must retain them as legacy/unverified until explicitly reviewed.

## Ordered tasks and acceptance checks

### Immediate correctness

- [x] **01. Stop attachments from closing findings** (V05). Uploads retain the prior checklist status; explicit Done/N/A still works. Tested upload, multiple files, removal, persistence and summary counts. Existing legacy states are not retroactively certified. **Verified locally; not deployed.** No dependency.
- [x] **02. Correct unsupported utility/service conclusions** (V02, V03). Provider territory and nearby homes are observations; lot-specific service, capacity and costs remain separate unresolved decisions. Covered power, gas, internet and sewer, including old saved-report presentation and exports. Lookup failures remain unknown. **Verified locally; not deployed.**
- [x] **03. Remove unsupported schedule and broad-rule conclusions** (V03, V04, V12). Separate base-zone standards from controlling instruments; treat hydrant/slope observations as screening inputs. Replace authoritative predicted dates with explicit assumptions and dependency gaps; distinguish statutory periods from forecasts. Add conflicting/missing-evidence cases.
- [x] **04. Reconcile known obsolete Cobabe advice** (V01). Replace the active “only sold” claim with verified public-source availability while retaining unresolved applicability. Verify Site Review, Rules & Approvals and export agree. Preserve the old statement in history. Do not resolve the disputed agreement numbers by assumption.

### Complete evidence → decision → project behavior

- [x] **05. Define shared decision identities and migrate safely** (V06, V07, V14). Document stable question IDs, parcel/work scope, evidence references/hashes/pages, reviewer, disposition and history. Preserve legacy checklist choices as unverified; prove migration is repeatable and does not lose attachments. Depends on initial dependency investigation.
- [x] **06. Add explicit evidence review and resolution** (V05–V07). User can accept/reject relevance, record a cited conclusion, or specify the exact missing evidence. Upload/AI extraction never resolves a question by itself. Test unrelated and contradictory documents. Depends on 05.
- [x] **07. Reconcile competing sources and superseded conclusions** (V01, V03, V07). Preserve agreement/disagreement; distinguish source availability, applicability and precedence. A later source does not automatically override a controlling instrument. Show original pages and smallest unresolved dependency. Depends on 06.
- [x] **08. Propagate decisions and invalidate stale dependents** (V01, V06, V07). One reviewed decision updates overview, report, rule view, relevant application fields and new exports. Changed source/plan/scope reopens affected decisions without erasing history. Test a complete evidence-change scenario. Depends on 07.
- [x] **09. Synchronize checklist decisions and evidence across devices** (V14). Project persistence and backup include decisions and attachments; failed saves are visible; revisions prevent stale overwrites. Verify restore and account isolation with synthetic accounts/fixtures. Depends on 05, 08.
- [x] **10. Persist application-answer review** (V06). Suggested, supplied, confirmed, rejected and stale are distinct; confirmation names reviewer and source/version. Editing or replacing a plan invalidates affected confirmations. Depends on 05, 08.
- [x] **11. Unify readiness and preserve approval stages** (V06). Known required answers, applicable approvals and document/version reviews feed one evaluator. Review-snapshot export remains distinct from submission readiness. Reproduce and close the blank Builder Valuation case; never treat issuance/construction prerequisites as submission requirements without authority. Depends on 10.
- [x] **12. Separate independently filed permits** (V13). Dwelling and garage filings can retain independent references, packages, corrections and issuance, or are explicitly designated worksheets until independently filed. Test one filing changing without affecting another. Depends on 11.

### Reduce noise and improve usefulness

- [x] **13. Prioritize decisions on the overview** (V08). Show a small ranked set of actual questions, consequence, next evidence/action and responsible role. Counts remain secondary; zero red flags must not hide a critical unknown. Depends on 08, 11.
- [x] **14. Scope optional research and condense topic tables** (V09, V10). Pool/other optional work does not inflate required work when unselected. Duplicate metrics remain available in source comparison. Unknown scope is explicit. Depends on 13.
- [x] **15. Organize documents and contacts around questions** (V07, V10). Relevant originals first; excluded/nearby records and processing logs secondary. Consolidate organizations and show role, contact source/date and exact reason to contact. Public discovery precedes third-party escalation. Depends on 07, 14.
- [x] **16. Reframe valuation and cost tools** (V11). No current-market conclusion from old, unstable comps; assumptions and sensitivity sit beside outputs. Preserve residual budgeting; distinguish cited fees, bids and unvalidated scenarios. Test absent inputs and stale evidence.
- [x] **17. Correct activity provenance and test entrypoints** (V14, V15). Distinguish user/system/import/AI actors; remove misleading attribution. Update stale pool integration test to the actual built application and ensure build guards remain intact.

### Release and independent validation

- [-] **18. Validate realistic project journeys** (all findings). Cobabe + a second OVC property + Sunridge: who approves what/when, utilities, competing evidence, review closure, plan changes, readiness and exports. Verify authoritative answers where accessible; list unresolved instruments without claiming search exhaustion. Use synthetic projects for destructive/mutating scenarios. Depends on 01–17.
- [x] **19. Deploy verified increments and check production**. Preserve live/rollback deployments, publish a coherent tested release, inspect actual deployed behavior and record URL/version/results. Local task completion is not production completion. Incremental releases may occur earlier when self-contained; do not deploy unfinished schema migrations. Depends on a release-ready set of tasks.
- [-] **20. Validate actual user value**. Observe builder click-through against predetermined questions; measure whether the correct next action is identifiable and whether contradictory/irrelevant information interferes. Customer sessions require participant availability; do not substitute passing code tests. Depends on 18–19.

## Progress log

### Checkpoint 0 — Plan and dependency investigation

- Mapped all 15 audit findings into sequential tasks with testable completion criteria.
- Confirmed the hardest dependency is shared decision identity/versioning, not additional crawling.
- Confirmed legacy auto-closed and manually closed items cannot be distinguished from existing status data. Plan includes explicit migration handling, not silent resets.
- Started Task 01. Product release status: unchanged.

### Checkpoint 1 — Task 01 implemented and verified

- `web/app.js`: removed upload-triggered completion; added a short explanation beside attachment controls. Upload preserves To do, Done or N/A instead of changing the decision.
- `scripts/test-checklist-evidence.js`: exercises the actual delegated upload/click handlers, IndexedDB storage and summary rendering. Unreviewed/contradictory documents leave To do open; multiple attachments, explicit status choices, removal, empty selection and store reopening pass.
- Passed: `node scripts/test-checklist-evidence.js`, `node scripts/test-document-information-flow.js`, `node scripts/test-narrative-flow.js`, `python3 build.py`.
- Generated application rebuilt. No production deployment performed at this checkpoint.
- Remaining limits: existing legacy Done records remain unchanged; manual Done still lacks the stronger cited-resolution workflow scheduled for 05–06. This task prevents new automatic closure, not every unsupported manual decision.
- Plan assessment: no reordering needed. The legacy provenance ambiguity is already covered by Task 05. Next task: 02, utility/service conclusions, including saved reports and exports.

### Checkpoint 2 — Task 02 implemented and verified

- Power, gas and broadband map observations now require lot-specific verification. Nearby homes do not produce a lateral-only cost claim; missing gas coverage does not prescribe propane or electric heat.
- Independent service-area lookups retain successful evidence when another source fails. A failed nearby-building lookup records unknown rather than zero homes.
- Gas-appliance advice no longer treats mapped service territory as clearance. Fuel-only plans now receive that check too.
- Sewer maps and subdivision approval references no longer establish that septic is unnecessary. Wastewater system selection remains unresolved; original provider references and document citations remain available.
- New reports and old saved-report presentation use the same interpretation correction. Prior changed wording is retained as `priorInterpretation`; the stored snapshot is not mutated. Both interactive and downloadable HTML renderers were exercised against old unsafe wording.
- Passed: new `test-utility-evidence.js` (dense neighborhood, fiber, map absence, partial/total outages, gas-plan dependency, sewer plat block, nonmutation, idempotence, live/export rendering), plus checklist-evidence, plan-evidence, city-application, site-permit-suggestions, narrative-flow and document-information-flow. `python3 build.py` passed.
- Release: application rebuilt locally, not deployed. Existing downloaded files/frozen historical packages are not rewritten. This corrects screening interpretations; the durable reviewed-service decision workflow remains Tasks 05–08.
- Plan assessment: included the downstream gas-plan and septic-required flags in Task 02 because changing only the visible utility cards would leave contradictory advice. No change to task order.
- Task 03 investigation started: the dates are calculated in `lotreport.js` and independently asserted in `app.js` packet output; packet rows also predict sprinklers from hydrant distance, and geotechnical optionality is slope-driven. Fix both generation and saved-packet display, not only the Site Review headline.

### Checkpoints 3–4 — Forecast/rule presentation and obsolete document advice

- Removed generated submission/issuance forecasts based on fixed lead ranges. Current packet display suppresses old forecasts and generic turnaround claims; lists the unresolved prerequisites instead. Prior saved timeline remains available as historical data.
- Fire-sprinkler packet rows and hydrant findings no longer infer clearance/requirements from parcel-center distance. Base-zone coverage statements explicitly leave controlling limits unresolved. Geotechnical packet applicability cannot be dismissed solely from slope.
- Corrected the Recorder-only claim when it identifies entry 1882728, linking its verified public original and directing applicability questions to Rules & Approvals. Original interpretation is retained; no governing-instrument conflict was resolved by assumption.
- `test-report-corrections.js` passed: nonmutation/idempotence, packet applicability, both live and saved HTML, and public-original link. Existing utility and narrative checks passed.
- Verified locally, not deployed. Historic downloaded documents remain unchanged. Unified migration of old requirement decisions remains in Tasks 05–08.
- Plan unchanged. Task 05 started: reuse version-bound evidence references and add shared site-decision IDs, retaining legacy states as unverified history.

### Checkpoint 5 — Decision foundation and browser validation

- Added `site-decisions.js` and documented `decision-contract.md`: property-scoped question IDs, cited dispositions, source hashes/locators, applicability, reviewer, competing evidence, missing evidence and immutable prior decisions.
- Legacy marks remain unverified history. Attachments copy into the existing project document store. Changed findings, scope or cited document versions reopen reviews; later dates alone never establish precedence.
- Local browser: imported a synthetic project, recorded a cited resolution, verified Site Review and Overview both changed from one open question to zero, reloaded and verified persistence. Evidence: `site-review-resolution.jpg`. No real project decision was changed.
- Model tests cover repeated migration, other-property rejection, unsupported closure, citation requirements, contradictions, excluded evidence, history and stale documents. Utility and report-correction regressions still pass.
- Tasks 05–09 remain in progress until restore/account and complete dependent-answer behavior are verified. No production release. Task 10 is being implemented within this dependency chain because Task 08 cannot be validated end-to-end without an answer-confirmation state; this is dependency sequencing, not reduced scope.

### Checkpoint 6 — Cited decisions, answer review and readiness verified locally

- Tasks 05–07: explicit cited site review, excluded/contradicting references, conflict reasoning, original-document links, source-version invalidation and prior decisions are implemented and locally verified. This mechanism records a review; it does not resolve Cobabe's missing governing instruments.
- Task 09: complete backup retains decision + original bytes. Two simulated devices exercise the real project store/sync path with a mocked cloud service: offline decision/file save, reconnect, second-device restore and current decision state pass. Account isolation and stale overwrites pass. This is not a production security certification.
- Tasks 10–11: persisted permit-specific answer review with reviewer, reasoning, source locator/document version and optional site-question dependency. Blank confirmation fails; edits, plan changes and changed linked site decisions reopen confirmation. The shared handoff evaluator now blocks blank Builder Valuation and unconfirmed populated answers. Local browser confirmed an address and retained the confirmation after reload (`answer-review-confirmation.jpg`).
- Task 12 uses the explicitly permitted worksheet alternative: designate one worksheet for the tracked filing. Other types have no implied independent receipt/issuance. Opening them does not switch the filing; changing the designation after a receipt/reference is prohibited. Independent multi-filing tracking is not claimed.
- Migration reopens old unsubmitted packages and unsupported geotechnical optionality while retaining submitted snapshots/history. Repeating migration and ordinary navigation are no-ops.
- Task 16: sourced residual budgeting leads; historical 2019–2021 model output is secondary, labelled as unable to establish current market value, with sensitivity adjacent to the output. Absent-input, arithmetic, stale-evidence and sensitivity tests pass.
- Task 17: new events distinguish user/system/import/AI extraction. Legacy actor attribution is explicitly unverified. Corrected date-only rendering and the stale pool test entrypoint. Build passes its existing private-data guards.
- 21 targeted regression scripts passed; full results in `correctness-test-results.json`. Information-priority test also passes. Release status: local, production check pending.
- Tasks 08 and 13–15 have working increments but retain validation work: exact ranked questions, pool scope, relevant-document ordering, secondary other-property analysis, organization/decision contact grouping. Do not read these as completed domain evidence or exhaustive contact research.
- Plan unchanged in scope. Next: inspect the deployed surfaces against realistic questions and finish remaining propagation/priority gaps. Customer observation (20) still requires an actual participant.

### Checkpoint 7 — Production walkthrough and final propagation corrections

- First tested release `c8c39d9` deployed successfully: Vercel deployment `GsR5DALQJqyFkrKEfPoyQu42NMM7`. Inspected the actual signed-in production app, not only a crawler/API response.
- Cobabe, S-1 parcel 201230001 and Sunridge opened and migrated; account save completed. No reviewer decisions, work scope selections, paid analyses or authority communications were entered for these real projects.
- Cobabe still explicitly says the current architectural reviewer and timing are unresolved; both conflicting agreement numbers remain. Its dwelling draft shows missing Builder Valuation, 34 unconfirmed answers and no claimed submission. This is an honest limit, not the substantive answer to the original approval question.
- Sunridge continues to show landslide, wastewater and source-protection concerns. S-1's Site Review/Overview open counts agreed. Pool research is excluded from required-work totals unless explicitly included.
- Production exposed remaining broad saved-report statements about statewide mandates and final snow design loads. Corrected them to project-specific verification with originals retained. Added cited review details to current report exports and related site-review context to Rules & Approvals.
- Prioritization now promotes specific unresolved controlling-instrument questions (including Cobabe's reviewer/timing) ahead of routine service checks. Generic unidentified-rule questions do not replace specific site questions. Added explicit wood-burning appliance scope; optional research no longer enters priority/next-action/cost summaries by default. GIS no-match diagnostics are secondary; identical boundary names are deduplicated for display only.
- Tasks 08, 13–15 are implemented/tested locally and first-increment production observations are recorded above; final release verification remains Task 19. No claim of fresh exhaustive legal/source research is made.
- Remaining Task 18: technical/user-question journeys are exercised, but independently establishing Cobabe's actual reviewer/timing and all representative code interpretations remains attempted but unresolved. Missing originals are not proven access-blocked. See the existing instrument-by-instrument gap audit. Task 20 requires a real builder participant; automated navigation cannot substitute for it.


### Checkpoint 8 — Production version verified; clarity validation remains open

- Vercel deployed `a4d45c8` successfully (`GnEGqQUkKawaWtdtJWsapU8NXnfH`). Reloaded the signed-in production Cobabe Overview: 51 open findings, 34 suggested application answers, no confirmed answers or filing receipt. Architectural reviewer/timing is now first, not hidden below utilities.
- Participant response to the validation prompt: “i have no idea. i'm not really sure what you're asking”. This establishes that the test instructions were unclear; it does not establish that the participant inspected or misunderstood the app. Task 20 remains unresolved, not passed.
- Independent production inspection did expose confusing presentation: the suggested action used internal research language and cut off the governing-document paragraph mid-sentence. Replaced that summary with a complete explanation of the unknown reviewer and three distinct stages, and a named evidence button. No approval requirement was inferred or waived.
- Plan refinement within Task 20: use concrete actions and observe the result, rather than asking the user to interpret audit terminology. No expansion of scope. Tasks 18 and 20 remain open; substantive Cobabe authority/timing and search exhaustion are still attempted but unresolved.
- Focused information-priority and area-rule regressions and build passed after the clarity change. Production verification of that follow-up is pending.


### Checkpoint 9 — Release check complete; evidence and participant limits retained

- Clarity release `d8ff744` is live at https://lot-dossier-assistant.vercel.app/platform.html. Vercel deployment `AgV7bXA6bxyiEd9V7vMxUkUfDzub` succeeded. Browser reload shows the complete plain-language Cobabe explanation; its named button opens Rules & Approvals with the cited originals and exact missing instruments. Existing production/rollback versions were retained.
- Task 19 complete for this tested increment. Task 18 remains attempted but unresolved on actual governing authority/timing and city text conflicts. Task 20 remains attempted but unresolved: participant did not understand the test request, and no successful independent click-through is claimed.
- Additional public-route results are recorded separately in `cobabe-followup-2026-11-12.json`: the complete 32-record county GIS agreement index has no target match; July 22 county packet p. 5 supports staff-reported supersession but does not supply the executed Cobabe text. Neither establishes overall search exhaustion or paid-only custody.
- Next evidence work is still instrument-specific: original index identity for both agreement numbers; complete executed agreement and exhibits; lot-specific declaration coverage and current architectural delegation. Full city use/exception interpretation also remains unfinished as identified in the gap audit; the implementation checklist does not certify that broader capability.

### Checkpoint 10 — Reopened evidence-dependency and discovery gaps

- Task 08/11 follow-up: approval decisions previously bound to the map/app version, not the rule's actual cited evidence. Added a saved rule/evidence fingerprint and supporting-document hash. Changed rule stage, source hash, finding or document bytes now require renewal; earlier decisions remain visible. Legacy decisions without a fingerprint are retained but unverified. Resubmission readiness now catches stale prior approval/applicability decisions instead of bypassing them. Tests reproduce each failure before accepting renewal.
- Task 18 discovery: county packet inventories were filename searches. A new bounded full-text pass acquired 52 published 2025 valley-planning/administrative-review candidates (including filename-filter extras), 3,038 pages. Sparse/scanned pages are being OCR-checked; no exhaustion claim until those results are inspected.
- Found PDF wrapper links to PMN 1357583 and 1354221. The discovery engine ignored hyperlink annotations and numeric attachment URLs with no matching title. Fixed PDF annotation extraction, approved-host attachment following and cache refresh when reacquired; existing finished queues are not retroactively claimed reprocessed. Real PDF fixture test verifies that linked work remains pending until processed and off-profile hosts are not fetched.
- Added July 22 county staff corroboration of separate executed Cobabe/Eagle Crest agreements to the cited evidence chain. It does not authenticate either disputed entry number or supply the executed agreement.
- Focused approval, rule-dependency, permit-lifecycle, discovery, PDF-link, checkpoint and production-orchestration tests passed. These follow-ups refine existing tasks, not broader product scope. Deployment and full-text/OCR result inspection remain in progress.


### Checkpoint 11 — Recovered actual utility evidence; bounded packet search complete

- Completed all 1,464 sparse-page OCR jobs across the 54 acquired packets, with no OCR-job errors remaining. Recorded exact URLs, hashes, pages and hit locations in `cobabe-packet-search-2026-11-12.json`. This closes this bounded pass, not all public search routes.
- Visually verified signed August 15, 2025 water feasibility covering Phase 1 Lots 1–9, including Lot 4; eight conditions remain material. Visually verified October 2 sewer master-plan design acceptance. Added originals and page locators to the production evidence data and actual water/sewer rule answers. Existing evidence is evaluated before asking for replacement letters. Neither becomes automatic connection or permit clearance.
- Architectural keyword matches in other developments were checked against agreement titles/parties and excluded. Repeated staff entry 3372667 is not independent recorder authentication. Executed Cobabe agreement, current delegation and exact prerequisite stage remain attempted but unresolved; paid-only custody is unproven.
- Regression checks cover exact property isolation, conditional water coverage, design-only sewer acceptance and continued readiness blocking. Release `1a1aef3` deployed successfully to Vercel (`EH764c7PLtwirKx9tRfmHMp66HDE`). Production API serves evidence version 2026-11-12.5; signed-in browser shows the recovered water/sewer rows, original page links, named providers and unresolved conditions. No real approvals or scope values were entered. Tasks 18 and 20 remain open.

### Checkpoint 12 — Provider policy deployed; search receipts retained

- Recovered the sewer district's July 2026 policy manual through its normal browser navigation after direct HTML requests returned 403. Visually verified PDF p. 13 / printed p. 6. Added connection application/fees, district line-work authorization and inspection requirements to Cobabe's existing evidence, with the raw page link. Its county permit-issuance wording does not override the independently cited city submission checklist, or transfer district water rules to Ogden Valley Mutual Water Company.
- Release `c0a308c` deployed successfully (`EMUvaBbrUuEf2AfQEV2SpQ3cx1nc`). Signed-in production Cobabe reload shows evidence version 2026-11-12.6 content and the source link. Approval-evidence, area-rule regression checks and build passed. No real approval was entered.
- Added omitted exact archive searches for predecessor 3297522, amendment 2234358, termination 2628422 and Wester Geologic, across both requests and documents. Added the working state predecessor URL. Production run 43325397994 completed with zero pending/unread jobs; its new 110-page document hash matches the already recovered predecessor, not the missing 2025 agreement.
- Found and fixed a checkpoint defect: compaction discarded search receipts, including result totals and pagination IDs. Sanitized query URLs, terms, totals, counts and IDs now survive; response bodies, extracted text and credentials do not. Tests verify both zero-result preservation and redaction. Replayed the eight exact searches; each returned zero results, independently reproduced with matching response hashes. Two historical receipts per distinct query are retained.
- New source routes and their limits are recorded in `cobabe-route-followup-2026-11-12.json`: EMMA inventory (document content not fully reviewed because its viewer failed), MuniOS sign-in boundary, current state withdrawal filings, developer pages and the recorded Phase 2 plat. Phase 2 repeats 3372687 but does not independently authenticate it or establish Lot 4's governing terms.
- Tasks 18 and 20 remain attempted but unresolved. Missing executed agreement, applicable architectural delegation, exact timing, geologic report and city interpretation gaps remain distinct. No verified paid-only custody or exhaustive-public-search claim. Plan unchanged in scope; preserving independently reviewable query results is a necessary evidence-chain correction.

- Replay exposed and corrected a second checkpoint defect: canonical root URLs gained a trailing slash during compaction and were reseeded as duplicate jobs. The engine now canonicalizes job keys; compaction retains the latest observation per key. Regression tests prove a resumed checkpoint does not enqueue the same search again. An initial replay state-label mistake was corrected and is recorded in the route ledger, not counted as evidence.
- Final production run [43328446906](https://github.com/wkatzka/lot-dossier/actions/runs/43328446906) completed. Downloaded artifact has 1,337 distinct job keys for 1,337 jobs, zero pending/unread work, and the eight distinct exact-query receipts. The live `/api/public-research` endpoint serves that run; Vercel deployment `98bHfwsXksRatLUPuz2JxiiwYD8d` succeeded for commit `f0e5406`. Processing completeness is still explicitly separate from instrument-level exhaustion or legal applicability.

### Checkpoint 13 — Concrete directions for missing evidence

- User refinement: unresolved findings must name a useful action and document, website, organization or verified contact; a bare “needs review” is insufficient. Added structured next steps to every missing Cobabe evidence-chain item, and original-source/authority directions to other rule details. Internal status values remain compatible with existing data.
- Live release `9b95925`, deployment `CbDsBD41dc6icJs1ArTfNSMRvZHU`, was verified in the signed-in Cobabe project. Clicking “See next step & evidence” opens the actual guidance, registry 14305604-HOA1, missing Lot 4 declaration/delegation, and separate municipal timing question. Recorder directions preserve both disputed entry numbers; planner email and sewer district phone link correctly. No actual approval or applicability decision was entered.
- Verified official contact routes: Weber Recorder 801-399-8441; Ogden Valley planning / Brian Carver at planning@ogdenvalley.gov; WCWSID 801-745-3435. These routes do not prove the missing originals are held there. The geologic report next step names its exact title/date and the county planning custodian identified by the plat. No outreach performed.
- Manually inspected all 14 pages of EMMA quarterly filing P11995876-P11520838-P11975960. It contains development/financial reporting, not the missing architectural authority/delegation or executed agreement. Original offering statement remains unreviewed because the browser PDF viewer failed. Updated route ledger; no overall exhaustion claim.
- Approval-evidence, area-rule, information-priority, permit-lifecycle tests and production build passed. Follow-up removes raw needs_review display in filing summaries and gives pool safety a concrete code/building-review direction; focused regressions/build passed. Follow-up `bf559f0` deployed successfully (`oHEE3kFBHNaVP2KXuNCfjnmMhZSH`); fetched production HTML confirms both final filing and pool directions are served.
- Task 18 remains attempted but unresolved: executed agreement identity/text, applicable declaration and current ARC delegation, precise approval stage, Wester Geologic report, and city interpretation gaps. Task 20 remains attempted but unresolved: no successful independent participant validation. This increment supplies actionable directions, not proof that the original evidence objective is complete.


### Checkpoint 14 — Original-submission search and partial geologic recovery

- Completed the bounded 2022 OVPC pass: 35 PDFs, 1,428 pages, all 600 sparse-page OCR jobs inspected with no job errors. Actual meeting-page links recovered the August 23 packet (no year in filename) and June 21 packet (spelled-out commission name) missed by the initial filename filter. Exact URLs, hashes, hit pages and limits are retained in `cobabe-original-submissions-2026-11-12.json`. No complete February 28 Cobabe report found in this corpus; Osprey Ranch's January 3 report was excluded.
- Re-examined the December 2025 packet beyond keyword matches. Visually verified the reproduced §7.0 recommendations in the townhome application and the Phase 1 staff interpretation. Production evidence now includes this partial report recovery and explicitly preserves the conflict with the later recorded plat's hazard-area description. Townhome hazard ratings are not assigned to Lot 4; complete study maps and site-specific interpretation remain missing.
- UGS GeoData metadata and the independent public geotechnical WFS were searched by Cobabe, author/year and surrounding geography. Results and exact WFS query URLs are recorded; no target report recovered. This does not prove no public original exists.
- Re-verified association registry 14305604-HOA1: active, president John Lewis, 801-745-3737, accounting@wolfcreekresort.com. Promoted this existing appendix contact to the reviewer next step; explicitly not a confirmed ARC reviewer. County Planning remains the geologic-report custodian identified on the recorded plat.
- City shoreline follow-up located the August draft proposing 35 ft and September 1 adoption minutes, but no complete signed ordinance/effective publication; forest height and sensitive-lands discrepancies remain unresolved. OpenGov public record search is awaiting CAPTCHA permission; not counted as zero results. No email, payment or records request sent.
- Tasks 18 and 20 remain open. Missing current agreement/index authentication, declaration coverage/current ARC appointment, approval stage and complete report are attempted but unresolved, not proven paid-only dependencies. Full city use/exception interpretation is unfinished. This checkpoint closes the bounded search and a misleadingly incomplete geologic presentation; it does not close the original objective.
- Approval-evidence, area-rules and information-priority regressions and build passed. Release `71eabd1` deployed successfully (`DdqfBqY9zQtaHSPyy3VECZaxkWcw`); live API version 2026-11-12.8 and signed-in Cobabe Rules & Approvals both show the reproduced recommendations, unresolved scope and direct association contact. No actual approval entered.


### Checkpoint 15 — Close the current-evidence/report split

- Production inspection exposed a propagation gap: the reviewed evidence chain was visible in Rules & Approvals, while Site Review and downloaded reports retained only snapshot findings. Added the shared reviewed records above the relevant governing-record, HOA, water, sewer and geology sections. Original map observations remain visible and unchanged; nothing creates an approval or closes a finding automatically.
- Live/export regression verifies five topic contexts, original page links, partial-report limits, conditional utility evidence, current association contact and agreement conflict; rejects mismatched parcels and conflicting identity; proves saved-report nonmutation. Existing approval-evidence and narrative-flow regressions and build passed.
- Public OpenGov search completed with user CAPTCHA assistance. Address 5241 E Cobabe Ranch Rd maps to location 146889; Details explicitly shows MBL 224410004, Records shows no records at this location. This is a verified bounded negative result for the new county building portal, not proof of no older/private records or permit exemption. Exact receipt saved in the original-submission ledger.
- Release verified in signed-in production: current originals appear above the geologic topic and link to original pages. Tasks 18 and 20 remain unresolved for the substantive dependencies already listed; this fixes an actual cross-surface evidence gap within Tasks 07–08/15, not a replacement for recovering the missing originals.


### Checkpoint 16 — Published evidence changes invalidate dependent decisions

- Found a second propagation gap: site-review fingerprints included saved findings/documents but not the newly published original-evidence context. Added source findings, missing dependencies and original hashes/locators to affected review fingerprints. Earlier decisions remain recorded but become stale when their relevant originals change; unrelated topic reviews remain current.
- The review workspace now presents the current originals and exact missing evidence alongside the prior decision, so renewal is informed. Source matching is limited to affected finding types; a changed geologic excerpt does not invalidate an unrelated FEMA finding or utility review.
- End-to-end synthetic Cobabe test: resolve a geologic question, confirm a dependent valuation answer, change the published geologic evidence, then verify the site review and answer become stale and handoff reports the stale answer. Prior history is unchanged. Site-decisions, answer-reviews and report-corrections checks passed; build passed. Updated an older test assertion to the already-deployed actionable readiness wording.
- Release `4954ddf` deployed successfully (`EMEGMfvdDyYrVEwAp8oDyajEqm5m`). Reloaded production and opened the Subdivision geologic report decision workspace; current originals, scope conflict, missing report and page links are present. No real project review, answer, approval or filing was changed by the tests.

### Checkpoint 17 — Remove false geologic clearance implications

- Live verification found legacy claims beneath the new original evidence: existence of a geologic report and an empty boring archive were classified as “No issue identified”; the latter claimed a future report would be the first subsurface data. Neither conclusion follows from the source.
- New reports and immutable saved-report presentation now require verification of report applicability and missing archive coverage. Neighboring reports no longer imply they can substitute for project investigation without professional/authority scope assessment. Previous interpretations remain retained.
- Report-correction tests cover legacy nonmutation, idempotence, preserved history and removal of both unsupported claims. Site-decision regressions and build passed. Release `90f91ec` deployed successfully (`GXJ96dQJSFSh2y9XizmkksFVLNe4`). Reloaded the signed-in production Cobabe Site Review: both findings now show Needs verification, the empty-query limit and specific next steps are visible, and the substitution claim is removed. Approval-evidence and information-priority tests also pass. This is a correctness fix within the existing checklist; missing agreement, delegation, full report, city interpretation and participant validation remain unresolved.


### Checkpoint 18 — New-address automation gap and failed usability check

- User could not identify the next action on Cobabe Overview ("I can’t tell"). Task 20 remains failed; a focused approval-task interface is in local changes, not yet deployed or validated by the user.
- Address-path inspection confirms `lib/public-research.js` queries public parcel records and reads `lib/discovery-index.js`, which returns only an existing exact-county/parcel record. It does not enqueue a new property investigation. The browser original-document pass is limited to six pages. The scheduled discovery runner reads preconfigured `config/discovery` profiles. Detailed approved evidence is curated in `lib/approval-evidence-data.js`. These do not constitute general new-address investigation.
- [ ] **21 — Durable new-address research orchestration: unimplemented.** Authenticated project creation must start or reuse a parcel investigation, persist source/job progress, survive browser closure, and update the correct project without overwriting user decisions. Validate on a previously unconfigured address.
- [ ] **22 — General evidence-to-answer pipeline: unimplemented.** Establish parcel/subdivision applicability, executed instruments and amendment chronology, reviewer authority, and separate submission/issuance/construction triggers. Publish original-page citations, explicit conflicts and concrete missing-document actions; do not convert a retrieved candidate or completed queue into a verified requirement. Validate previously uncurated properties against independently checked originals.
- These are gaps in the originally requested scalable capability, not additional geographic scope. Task 18’s missing controlling originals and interpretations remain attempted but unresolved, independently of these implementation gaps. No production completion is claimed.

### Checkpoint 19 — Question-level search outcomes and verified fallback references

- Implemented `lib/research-outcomes.js`: deterministic per-question coverage gates, explicit source scopes/identifiers/dates, pagination receipts, unread/candidate/lead blockers, access barriers, reviewed original-answer gates, and expiring verified references. Empty searches never establish exemption. Source access and proof of custody remain separate. Blocked routes do not stop independent work.
- Crawler now retains bounded-query receipts and preserves them through durable checkpoints. Restricted pages and 404s no longer count as successful route coverage. CAPTCHA responses and a website shell returned at a PDF URL remain unresolved. Nonempty result sets must be reconciled before fallback.
- Added an uncached public investigation-status endpoint and a read-only live panel in Record Review. It shows the missing instrument, next action, verified references and source coverage, with a full search log. New/unconfigured parcels explicitly report that background investigation has not started; no Cobabe contact is copied to another parcel.
- Re-evaluated the retained Cobabe checkpoint without pretending to rerun its searches. Outcome remains investigation incomplete, with 141 candidate documents requiring reconciliation. The association contact is available as a direction, not established reviewer or document custodian. Old jobs without query receipts are not retroactively called exhaustive.
- Implemented the previously pending Overview action: its button opens the parcel-scoped architectural document task directly. Real-user validation remains failed/pending retest.
- Validation: new outcome and API scenarios plus discovery, checkpoint, PDF-link, public-research, information-priority, approval-evidence, revision, narrative and screen-redesign regression scripts pass. Build passes. Production verification pending.
- Remaining original scope: Task 21 dynamic durable investigations for arbitrary new addresses is still unimplemented; Task 22 generalized document applicability/authority interpretation is incomplete. This increment supplies the stopping/fallback policy and production integration, not those missing capabilities. Cobabe controlling originals remain attempted but unresolved.
- Production verification: `00ba0a9` deployed successfully (Vercel `7kyLoTtsYxBanwvd7LbWdkzGMfn2`). Production API returns incomplete/no fallback for Cobabe and not-started/no fallback for a previously unconfigured parcel. Signed-in browser verified direct Overview approval task and live Record Review status, association reference, source table and complete-log link. The browser exposed a legacy snapshot missing the title-research object; fixed and regression-tested without mutating the saved report. Replaced technical status/scope labels with plain language and exposed the blocked-source count. Real-user comprehension has not been revalidated.
- Final release `7722ea1` verified successful on Vercel (`Cs3k8qY7DiEcj8tQ4HJ8Fm9YCrPj`). Reloaded the signed-in production Record Review and confirmed plain-language scopes, the explicit access barrier, incomplete status, verified association reference and full search-log link. All 14 relevant regression scripts and the build passed during this increment. No approval, submission or project answer was changed by verification.

### Checkpoint 20 — Automatic new-address investigations (in progress)

- Hard dependencies investigated first: existing Supabase storage, available pg_cron/pg_net extensions, server-side reader and existing capped AI ledger. Provisioned private durable queue, leased claims, checkpoints and minute scheduler. Automatic approval review rejected using a credential from an unrelated project; that route was abandoned. The queue instead uses Cornerpin’s already-deployed budget authentication verifier and a separate database-generated scheduler token. No unrelated key was read or copied.
- Implementing dynamic profiles from canonical county identity and official municipal geometry, neighborhood-directory leads, reference-following, original-page interpretation, read-only live updates and an unconfigured-property acceptance test. Test candidate selected from county GIS: 3459 N Wind River Ct, parcel 222320023, Trappers Ridge Phase 4 Lot 68. No parcel-specific source configuration has been added.
- Tasks 21/22 remain in progress until deployment and independent end-to-end proof; no completion claim yet.

### Checkpoint 21 — Production acceptance on an unconfigured address (in progress)

- [x] New-address browser search resolves 3459 N Wind River Ct to county parcel 222320023, Trappers Ridge Phase 4 Lot 68. Fixed the discovered address-point/common-area mismatch; exact county situs now corroborates the selected parcel. No per-parcel discovery configuration was introduced.
- [x] Browser search automatically creates durable job `ca12cf9a-c654-479a-a158-94be612b1523`. Supabase minute scheduler independently claims, reads, interprets, and saves checkpoints; observed successful HTTP 200 worker responses while the browser was elsewhere. Browser reload retains the project and reads current results without altering approvals.
- [x] Production exercised native PDF reading, TIFF OCR, and the existing budgeted interpretation API. Original city checklist and recorded plat were retrieved and interpreted. New-address results now appear directly in Rules & Approvals and Record Review.
- [x] Fixed JSONB key-order checkpoint mismatch, CommonJS parser compatibility, original-page timing/headings, project-type conditions, separation of construction inspections from permit prerequisites, and missing-page OCR recovery. Each source failure remains distinct from an empty search.
- [x] Named code references now generate source-catalog / official-site / released-record / public-notice follow-up work. Shared neighborhood source leads are independent of addresses; directory membership remains a candidate, not proof of covenant coverage.
- [ ] Finish the live run, independently validate the final authority/timing quotations, check surviving failures and concrete next-document directions, and retain a production proof record. No queued/run-in-progress completion claim.
- [ ] Full lot-specific controlling declaration/amendment/delegation chain remains dependent on the originals actually recovered. Trappers Ridge home page and known declaration route deny automated access; that does not prove recorder custody, absence elsewhere, or exemption. Cobabe's separately listed missing instruments remain unresolved.

### Checkpoint 22 — Production recovery, cross-document explanation and shared readings

- The unconfigured-address production test exposed a public-notice date-splitting operation that could exceed a worker lifetime. Date windows now checkpoint between requests; generic referenced instrument names are qualified to the property/jurisdiction. Superseded broad queries retain the refinement reason and replacement ID, not a fabricated negative result. The minute scheduler reclaimed the saved job after the prior worker lease expired, without manually changing its research outcome.
- Added a final cross-document explanation grounded in validated excerpt IDs. It reconciles authority changes and timing clauses, names specific missing evidence, links originals and remains conditional. It cannot record approval, establish exemption or certify parcel applicability. Unsupported citation IDs and truncated responses are rejected.
- Added private public-reading reuse by exact source hash and reader version. Changed source bytes and incomplete page ranges cannot reuse a reading; OCR provenance and original PDF links survive. Parcel-specific conclusions are not reused as other parcels' answers.
- Independently downloaded and checked the city checklist, master guidelines, declaration succession clause and termination instrument. The succession clause on declaration PDF page 10 and termination/savings clauses on termination PDF page 2 support a conditional association/DRB chain; they do not alone prove Lot 68's membership or present appointment.
- Deployment and final acceptance verification are still underway. Tasks 21/22 must not be closed on the basis of these implementation commits alone. The final proof script requires the live new-address job to finish with zero queued checks and a cited cross-document explanation. Cobabe missing originals and the prior real-user comprehension failure remain distinct open items.


### Checkpoint 23 — Archived neighborhood original and truthful budget recovery

- [x] The production worker found the Trappers Ridge 2018 declaration/bylaws through the public archive alternative after the direct website denied access. All 103 pages have machine-readable text. Independent rendered-page checks found the Board approval clause, Phase 4 coverage exhibit and blank signature blocks. This narrows the missing evidence to an executed/recorded version and later changes; it does not prove the archived copy is controlling.
- [x] Long-document interpretation now keeps original definitions, scope exhibits and execution pages available across chunks. No manual interpretation or parcel-specific conclusion was inserted into the production job.
- [x] Fixed duplicate cumulative query storage, retained sanitized complete search receipts, and verified successful production checkpoint writes after the prior storage failures.
- [x] Preserved the $5 daily AI cap and conservative reservation. Added explicit reset-time status, continued non-AI source discovery/retries during the pause, and prevented budget denial from exhausting interpretation/synthesis repair attempts.
- [ ] Final terminal run, automatic interpretation of the recovered neighborhood copy, cross-document synthesis and production acceptance proof remain in progress. The job's paid interpretation is scheduled to resume after midnight Eastern. Tasks 21/22 are not marked complete while that work is pending.


### Checkpoint 24 — Read damaged and scanned archive originals

- [x] Automatically reconciled two truncated archive downloads with larger copies of the same original URL. All 1,048,576 bytes of each damaged copy match the complete copy's prefix; receipts retain both hashes, URLs and sizes. No filename-only equivalence or removal of the failed-source history.
- [x] Detected corrupt embedded OCR in the first amendment and re-read the affected pages with local Tesseract, independently of the paid interpretation budget. The independently rendered original is recorded in 2023 despite its 2022 filename, references Declaration Entry 2957404, and expressly lists Phase 4 Lots 46–68.
- [x] Fixed the bounded one-bit CCITT scan path. All four actual incorporation pages read locally with OCR confidence 93–94; broader oversized encodings remain rejected. Commit 20d2600 deployed successfully. The scheduled production retry completed all four pages by 04:50:50 UTC without any manual requeue or evidence insertion.
- [ ] Final interpretation, cross-document answer and terminal production/browser proof remain open. The daily cap is unchanged; no source text, approval finding or parcel-specific conclusion was manually inserted.


### Checkpoint 25 — Interpretation recovery against actual originals

- [x] Midnight budget reset resumed the existing job automatically; no manual restart or cap increase. The first neighborhood chunk retained its blank execution-date clause and Phase 4 exhibit.
- [x] Same-original bare article references now resolve against a substantive heading with a source-page receipt. Table-of-contents mentions, unread pages, external instrument names and recording numbers do not qualify.
- [x] The real declaration exposed internal PDF word spacing (for example “a ny”). Quote alignment now restores the source span only when the character and punctuation sequence matches; it retains a normalization receipt and rejects omitted words, changed authority names and joined numeric tokens. Targeted failed chunks are re-read once; no per-parcel findings were inserted.
- [ ] Remaining chunks, amendments, final synthesis and browser proof are still running. This is implementation recovery, not completion of Tasks 21/22 or resolution of Cobabe’s separate missing instruments.


### Checkpoint 26 — Verified clause; budget decision required for final acceptance

- [x] Production now retains the source-supported Board written-plan approval on PDF page 31 with construction timing, `documentStatus=not_established`, and zero rejected statements in that chunk. It agrees with independently inspected pages.
- [x] The full 103-page neighborhood declaration has been interpreted. Source reading is complete with zero unread documents and zero queued source checks. Independent inspection also distinguishes the recorded first amendment from the unsigned second-amendment copy.
- [ ] On November 13 Eastern, the existing $5 guard paused further interpretation at $2.801668 charged because another full-context reservation cannot fit. Fifteen recovered documents still need interpretation (including the two neighborhood amendments), followed by reference follow-up, synthesis and final browser proof. No final acceptance artifact was emitted; the production acceptance script correctly fails `retry_wait`.
- [ ] Explicit user approval requested for a one-day $10 total shared cap, automatically reverting to $5 on November 14 Eastern. A dated SQL change is prepared locally but NOT applied. Until approval, production remains at $5 and scheduled to resume at `2026-11-14T05:00:00Z`. No reservation reset or budget bypass.
- Tasks 21/22 remain attempted but incomplete; final paid interpretation is blocked by the existing budget until an approved allowance or reset. Cobabe missing originals and real-user comprehension remain separately unresolved.


### Checkpoint 27 — User-approved bounded budget continuation

- [x] User explicitly approved “Allow up to $10 today, then restore $5/day.” Applied the dated November 13 Eastern exception; the database function uses $5 for every other date. Existing authentication, full-context reservation, settlement and uncertain-call retention remain unchanged.
- [x] Resumed the existing checkpoint with an audited migration recording the previous pause and approval reason. No source findings, page text, search outcomes or approvals were inserted. The scheduler reclaimed the job and resumed interpretation.
- [x] Removed hard-coded $5 wording from transient pause messages so they do not misstate a date-specific approved allowance. The permanent default budget script remains $5.
- [ ] Finish remaining interpretations, references, final synthesis and terminal production/browser acceptance. Tasks 21/22 remain open until those checks pass.


### Checkpoint 28 — Technical acceptance passed; semantic QA caught remaining gaps

- [x] At 06:10:56 UTC, the unconfigured-address job finished `complete_with_gaps`, with zero pending sources and zero unread originals. The strengthened production script passed and emitted `automatic-investigation-production-proof.json`. The bounded second synthesis attempt succeeded.
- [x] (Resolved 2026-11-13, see below.) Human review rejected full completion: the synthesis incorrectly says ACC provisions and the master Exhibit A were not supplied despite recovered documents/sections. It also leads with generic caveats and inspection detail instead of the practical approval sequence. These are unfinished reconciliation/presentation behaviors, not proven missing-source dependencies.
- [x] Fix whole-document evidence reconciliation, regenerate only synthesis, extend semantic checks, and perform final browser verification. Do not repeat the crawl or all paid interpretations.
- [x] Inspected originals directly: Trappers Article 6 (pp. 30–32: ACC drafts guidelines/recommends, Board approves plans and enforces) and master Exhibit A (pp. 53–65: metes-and-bounds parcels with 2002 tax IDs; recovered but does not name Lot 68 or 22-232-0023).
- [x] Added generic whole-document inventories (`lib/document-inventory.js`): recovered articles/sections/defined committees/exhibits, exhibit coverage facts, bundled-instrument separation; stale chunk gaps move to `resolvedReferences`; inventories persist or rebuild from durable readings. Commits `43aef97`, `2a32fda`, `c444529`.
- [x] Publication guard: drafts calling recovered material missing (instrument-scoped) or leading with "nothing shows an approval was obtained" are rewritten once, otherwise not published. Unit tests in `scripts/test-document-inventory.js`; related suites pass.
- [x] Audited one-row regeneration via `db/regenerate-synthesis-2026-11-13.sql` (synthesis state only; prior explanation retained in `synthesisHistory`; no recrawl/OCR/reinterpretation). Accepted explanation produced 07:11 UTC after one By-Laws mis-resolution and one guard false positive were fixed.
- [x] Production proof re-run with semantic assertions: PASS. Five findings and four directions checked against originals; residual: termination entry 2628422 is visible on the retrieved original but direction 4 still asks for it, and finding 3 omits the First Amendment's March 28, 2023 recording date.
- [x] Ledger (settled, none unsettled): Nov 13 Eastern $7.010206 of the approved $10; Nov 12 $2.850108. Default $5/day unchanged.
- [x] Production browser verification of the completed explanation, original links (8 PDFs, 59 page anchors) and document-level citation labels; final screenshot `automatic-investigation-final-production.jpg`.
- [ ] Signed-in account view not separately exercised (anonymous device-saved workspace used; same panel component).
- [ ] Still open and unrelated to this fix: Cobabe's missing executed agreement/current ARC authority and the failed real-user comprehension check.
- [x] Prepared `CLAUDE-HANDOFF-automatic-investigation.md` at the user's usage/handoff checkpoint, with exact remaining steps, artifacts, deployed code and approved budget limits. Tasks 21/22 remain partially verified, not fully accepted.

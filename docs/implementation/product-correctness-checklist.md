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
- [-] **08. Propagate decisions and invalidate stale dependents** (V01, V06, V07). One reviewed decision updates overview, report, rule view, relevant application fields and new exports. Changed source/plan/scope reopens affected decisions without erasing history. Test a complete evidence-change scenario. Depends on 07.
- [x] **09. Synchronize checklist decisions and evidence across devices** (V14). Project persistence and backup include decisions and attachments; failed saves are visible; revisions prevent stale overwrites. Verify restore and account isolation with synthetic accounts/fixtures. Depends on 05, 08.
- [x] **10. Persist application-answer review** (V06). Suggested, supplied, confirmed, rejected and stale are distinct; confirmation names reviewer and source/version. Editing or replacing a plan invalidates affected confirmations. Depends on 05, 08.
- [x] **11. Unify readiness and preserve approval stages** (V06). Known required answers, applicable approvals and document/version reviews feed one evaluator. Review-snapshot export remains distinct from submission readiness. Reproduce and close the blank Builder Valuation case; never treat issuance/construction prerequisites as submission requirements without authority. Depends on 10.
- [x] **12. Separate independently filed permits** (V13). Dwelling and garage filings can retain independent references, packages, corrections and issuance, or are explicitly designated worksheets until independently filed. Test one filing changing without affecting another. Depends on 11.

### Reduce noise and improve usefulness

- [-] **13. Prioritize decisions on the overview** (V08). Show a small ranked set of actual questions, consequence, next evidence/action and responsible role. Counts remain secondary; zero red flags must not hide a critical unknown. Depends on 08, 11.
- [-] **14. Scope optional research and condense topic tables** (V09, V10). Pool/other optional work does not inflate required work when unselected. Duplicate metrics remain available in source comparison. Unknown scope is explicit. Depends on 13.
- [-] **15. Organize documents and contacts around questions** (V07, V10). Relevant originals first; excluded/nearby records and processing logs secondary. Consolidate organizations and show role, contact source/date and exact reason to contact. Public discovery precedes third-party escalation. Depends on 07, 14.
- [x] **16. Reframe valuation and cost tools** (V11). No current-market conclusion from old, unstable comps; assumptions and sensitivity sit beside outputs. Preserve residual budgeting; distinguish cited fees, bids and unvalidated scenarios. Test absent inputs and stale evidence.
- [x] **17. Correct activity provenance and test entrypoints** (V14, V15). Distinguish user/system/import/AI actors; remove misleading attribution. Update stale pool integration test to the actual built application and ensure build guards remain intact.

### Release and independent validation

- [-] **18. Validate realistic project journeys** (all findings). Cobabe + a second OVC property + Sunridge: who approves what/when, utilities, competing evidence, review closure, plan changes, readiness and exports. Verify authoritative answers where accessible; list unresolved instruments without claiming search exhaustion. Use synthetic projects for destructive/mutating scenarios. Depends on 01–17.
- [-] **19. Deploy verified increments and check production**. Preserve live/rollback deployments, publish a coherent tested release, inspect actual deployed behavior and record URL/version/results. Local task completion is not production completion. Incremental releases may occur earlier when self-contained; do not deploy unfinished schema migrations. Depends on a release-ready set of tasks.
- [ ] **20. Validate actual user value**. Observe builder click-through against predetermined questions; measure whether the correct next action is identifiable and whether contradictory/irrelevant information interferes. Customer sessions require participant availability; do not substitute passing code tests. Depends on 18–19.

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

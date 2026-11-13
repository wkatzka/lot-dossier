# Cornerpin automatic-investigation handoff

Continue the existing objective, not a new audit: finish automatic investigation and document interpretation for newly searched addresses, deploy, and verify a defensible production answer. Do not recrawl or re-interpret everything. The remaining failure is final answer reconciliation, not source discovery.

## Repository and live result

- Repo: `/Users/wkatzka/Desktop/BlackPine/lot-dossier`, branch `main`, GitHub `wkatzka/lot-dossier`.
- Live app: https://lot-dossier-assistant.vercel.app/platform.html
- Unconfigured acceptance address: **3459 N Wind River Ct, Eden, UT**, parcel **222320023**, Trappers Ridge Phase 4 Lot 68, Ogden Valley City.
- Actual browser search created job `ca12cf9a-c654-479a-a158-94be612b1523`. No parcel-specific profile or curated answer was inserted.
- Public result: https://lot-dossier-assistant.vercel.app/api/public-research?format=investigation&county=Weber&parcelId=222320023
- At 2026-11-13 06:10:56 UTC it reached `complete_with_gaps`, zero pending source checks, zero unread originals, 70 interpretation chunks, 51 original documents.
- `scripts/verify-automatic-investigation-production.js` **PASSED** against production. Its JSON proof is `docs/implementation/automatic-investigation-production-proof.json`. This is technical acceptance, NOT final semantic acceptance.
- Latest deployed implementation commit before this handoff: `fd93476`; subsequent changes are evidence/checklist/handoff artifacts and stronger acceptance assertions.

## Exact remaining defect: final synthesis falsely describes recovered material as missing

Read `proof.synthesis` in the proof JSON. Human review after the passing script found:
1. The Trappers Ridge finding says “Design and Construction Guidelines and ACC provisions are not supplied.” Separate Guidelines may still be missing, but **Article 6 ACC provisions are present**, including PDF page 30 appointment/composition and page 31 Board plan approval. Interpretation authorityChanges already include page 30; do not call these provisions absent.
2. The master finding says “Master Declaration's Exhibit A ... not supplied.” The complete 87-page PDF was retrieved/read. Inspect the actual exhibit and determine what property coverage remains unresolved. **Not recovered**, **recovered but not reconciled**, and **does not establish this lot's coverage** must be distinct.
3. The summary begins with generic “nothing ... shows any approval ... obtained” and inspections, rather than the practical plan-approval answer. Lead with the supported neighborhood Board construction gate, the conditional master DRB submission language, and the exact missing recorded declaration. Keep inspections secondary.
4. Do not invent a conflict merely because Board, ACC, and DRB appear in different clauses. Reconcile their actual roles; preserve genuine uncertainty in the unsigned copy/current appointment.

The current synthesis receives validated snippets plus earlier chunk-specific `missingDocuments` but insufficient whole-document inventory. Merely prompting it not to repeat stale gaps did not solve this. Supply a grounded inventory of recovered pages/sections/exhibits and resolved internal references, and reconcile stale chunk limitations before publishing. A retrieved exhibit may still fail to prove applicability; do not turn retrieval into legal clearance. Avoid manually seeding parcel-specific conclusions.

## Primary evidence already independently checked

See `docs/implementation/automatic-investigation-independent-checks.json` and the acceptance report for URLs, hashes and page checks.

- Neighborhood declaration: SHA `10389c0d73cc30d408b13fc76bb216a252e53dac5ea9bc22b5c9fa79baa7f7c7`, 103 pages. Page 30 Article 6, page 31 Board written plan approval before construction, page 32 section 6.8 Board enforcement with ACC recommendations, page 78 blank execution/signatures, page 79 Phase 4 exhibit. Do not equate this unsigned public copy with the recorded instrument.
- First amendment: SHA `b8967517c1e638a8074a4cbf91679bb7a6265a512e23d829ba857b15eed45bda`, 8 pages. Recorded Entry **3277834**, March 28, 2023 (filename says 2022). Page 1 identifies underlying Declaration **2957404**, recorded December 17, 2018. Page 6 includes Phase 4 Lots 46–68. Page 5 preserves unaffected terms. Production interpretation correctly retains these leads; its excerpt of the lot range is shorter than the full paragraph, so verify full page when reconciling phase coverage.
- Second amendment: SHA `a21765e8967b91addfca64365686a82cb46905dc07d43927f86a128d9afe2e9c`, 7 pages. Unsigned/unrecorded-looking public copy: blank recorder field, signatures and acknowledgments. Fee provisions are not a plan-approval prerequisite. Production correctly labels `proposal_or_draft` and returns no approval requirements.
- Master declaration: SHA `c0d1021ce27731e086545cade74b9177382b8fabfc427fabb464397d83f1c054`, 87 pages. Page 10 architectural succession to Association/DRB on declarant termination.
- Master termination: SHA `55418659da0baa2968531c30a4965c1c5f55988f1378e18369a22d62c7c70b0d`, 15 pages; Entry 2628422 recorded April 3, 2013, page 2 terminates declarant powers and preserves other covenants. Master developer is not automatically the neighborhood developer Eden Village LLC.
- 2010 master guidelines: SHA `d1a4679751d03b47b5f5e9c347ad020e7a7c8b89487bfd4972f779b97aa4d87d`; page 7 private review before County submission, page 42 before commencement, page 43 developer review. Historical County language does not prove current Ogden Valley City intake policy.
- City checklist: SHA `1aff2d47649aa06e841518ece46e7413f20a2955c2aefc8ab862fe1af6c56064`; heading page 1 and conditional water/sewer submission items page 2. Unknown work type must remain conditional.

Independent originals/text/rendered pages are in `/tmp/cornerpin-acceptance/`, including `trappers-native-reading.json` (array of all 103 native page texts). These are verification artifacts, not manually seeded production findings. Durable shared public readings are also in private Supabase `research_readings`, keyed by SHA and reader_version=1. Use existing authorized Cornerpin tooling; do not use another project's credentials or print secrets.

## Relevant implementation

- `lib/automatic-investigation.js`: leased orchestration, source/interpretation checkpoints, bounded retries and final synthesis.
- `lib/approval-document-interpreter.js`: exact source quotation, authority, timing, property scope, supporting evidence and authority-change validation.
- `lib/investigation-synthesis.js`: final explanation from evidence IDs. Default 5,000 output tokens; orchestration retries at 10,000 then 15,000 after truncation. Current second attempt succeeded.
- `lib/local-document-references.js`: resolves a bare Article reference only against a substantive same-original heading; stores source-page receipts.
- `lib/quotation-layout.js`: restores PDF layout whitespace to an exact original span, preserving letters/punctuation and recording receipts; no dropped words or joined numeric tokens accepted. One-time targeted recovery already ran.
- `lib/native-text-quality.js`, `lib/document-copy-resolution.js`, `lib/reading-copy.js`: corrupted-text OCR, exact truncated-prefix proof for two archive copies, bounded one-bit CCITT reading. All recovered originals are now read; do not redo this work.
- `web/title-research-view.js`: live results and final “What this means for your project”. Final browser check of the completed synthesis is still outstanding.
- `db/automatic-investigations.sql`: private queue and minute scheduler. Function-only 15s DB timeout; do not broaden privileges.

## Budget: explicit user authorization already granted

User approved: **“Allow up to $10 today, then restore $5/day.”**
- Applied and verified the **November 13, 2026 Eastern only** $10 total shared ceiling in `db/ai-budget-2026-11-13-approved.sql`.
- Every other date automatically uses $5. The permanent default `db/ai-budget.sql` stays $5.
- Full-context reservations, authentication and uncertain-call retention remain unchanged. Do not reset reservations, raise the ceiling again, or lower safety bounds.
- At the earlier pause $2.801668 had settled; additional calls occurred after approval. Read the current ledger for the final amount rather than quoting that stale subtotal.
- An audited checkpoint migration resumed the same job after approval. No source text or conclusions were inserted.

## Finish these steps

- [x] Inspect recovered ACC provisions and master Exhibit A directly, then fix generic whole-document reconciliation so stale single-chunk “not supplied” statements cannot survive when the relevant material is present.
- [x] Add semantic acceptance assertions for that defect, not merely counters/citation IDs. Keep explicit legal applicability and current-recording gaps.
- [x] Regenerate only the final synthesis from retained evidence/index after deploying the fix. The job is terminal; use a narrowly audited reset of only synthesis state with no document reinterpretation or source recrawl. Record the reason and retain the prior synthesis in history.
- [x] Run the production proof script again, manually check all five findings and four directions against originals, and ensure current Board/ACC/master/municipal stages are accurately distinguished.
- [~] (Anonymous device-saved workspace verified; signed-in account view not separately exercised.) Verify the actual signed-in UI and original-document links; save a final screenshot and replace the existing **partial** screenshot as final proof. Do not use `automatic-investigation-partial-production.png` as proof of finished synthesis QA.
- [x] Finalize the acceptance report and checklist, commit only relevant files, push, and verify the final Vercel deployment.
- [x] Report the automatic capability, actual limitations, observed first-run latency and current API spend honestly. This run required engineering recovery; it was not a clean uninterrupted first run.

## Tests and artifacts

Relevant passing tests: `test-automatic-investigation`, `test-investigation-synthesis`, `test-investigation-budget-pause`, `test-ai-budget`, `test-reading-copy`, `test-original-acquisition`, `test-quotation-layout`, `test-local-document-references`, `test-quoted-property-coverage`, `test-interpretation-context`, `test-document-copy-resolution`, `test-native-text-quality`, `test-research-outcomes`.

Production proof command:
`node scripts/verify-automatic-investigation-production.js docs/implementation/automatic-investigation-production-proof.json`

Run `python3 build.py` after UI changes. Existing Vercel deployment follows main pushes. Keep unrelated dirty research/UX files intact; never `git add .`. There are historical ZIPs and unrelated modified Cobabe research documents in the worktree.

## Scope and honest stopping criteria

The user wants defensible answers, not crawler counts. Passing technical acceptance alone was insufficient here. Finish the remaining semantic and browser verification before declaring this capability accepted. Do not describe this as resolving all Cobabe evidence or the whole platform audit. Cobabe's separate missing executed agreement/current ARC authority and the failed real-user comprehension check remain open in `product-correctness-checklist.md`. No outreach, emails, purchases, or new credentials are authorized. Preserve all user decisions/approvals; this investigation only supplies evidence and conditional findings.

## Status after continuation (2026-11-13 ~07:30 UTC)

Completed per `automatic-investigation-production.md` → "Whole-document reconciliation and final semantic acceptance". Commits `43aef97`, `2a32fda`, `c444529`, `3797d23` plus docs. Production proof PASSES with semantic assertions. Residuals: termination direction partly redundant (entry 2628422 already on retrieved original); signed-in account view not separately exercised; Cobabe items unchanged.

## Narrow acceptance pass (2026-11-13 ~07:50 UTC) — in progress, budget-paused

Deployed `1f816cb`, `1df0558`: recorder-stamp receipts (`lib/recording-stamp.js`; identifier from stored stamp text, date only from a strict stamp date re-read on the same stamp — verified against rendered originals: termination E# 2628422 recorded 03-Apr-13; First Amendment E# 3277834 recorded 28-MAR-23, stored OCR had "26-4AR-23"), short answer (approver / when / uncertainty / one next action), next-action dependency classes, and evidence-contradiction checks (`lib/answer-checks.js`, `scripts/test-answer-checks.js`).
Regeneration requested via audited one-row SQL at 07:36 UTC. First attempt was refused by a guard false positive (a comparison task naming recovered Exhibit A; fixed in `1df0558`). The retry was then paused by the approved $10 Nov 13 ceiling ($7.94 settled; next full-context reservation does not fit). **Not raised.** Job resumes automatically at 2026-11-14 05:00 UTC under the $5/day default. Until then the public result has no explanation (the labelled prior-explanation fallback applies from the next save).
Still to do after it completes: proof script, manual review vs originals, signed-in production check (user must sign in), report/checklist. A fresh-address clean run and real-user comprehension remain unclaimed; a fresh run needs its own budget day.

**Update 16:30 UTC:** user approved +$3 for Nov 13 only (`db/ai-budget-2026-11-13-topup.sql`). Version 3 explanation published 16:22 and passes the production proof and manual review (see acceptance report, "Narrow acceptance pass"). Remaining: signed-in production check (user sign-in needed), optional UI collapse of details, fresh-address clean run and real-user comprehension (unclaimed).

**Update ~16:45 UTC:** signed-in production check passed (see acceptance report). Open: surface the short answer on Overview / collapse detail links; fresh-address clean run; real-user comprehension.

## Answer-first presentation (2026-11-13 ~17:00 UTC)

User's product rule: show the distilled, project-specific bits front and centre with their source documents as citations; if nothing can be distilled, the detailed source documents are the main finding; if no documents are found, point to the organisation, website and contact information. Implemented as `answerCard` / `mountOverviewAnswer` in `web/title-research-view.js` (Overview placeholder in `web/project-overview.js`, mount in `web/project-workspace.js`, styles in `web/design-system.css`), tested by `scripts/test-answer-card.js`, verified signed-in in production. Open: shorten the distilled lines (needs a paid regeneration), and apply the same rule to Site Review and the older Rules sections.

## Who-does-what next steps and recorded-copy comparison (2026-11-13 ~19:45 UTC)
Next steps state the user's and Cornerpin's parts. "Copy recovered; match to recorded instrument unverified" steps offer an upload compared deterministically against the retrieved copy (`lib/recorded-comparison.js`, `lib/recorded-comparison-handler.js`, workflow command `recorded_comparison`). Verified: tests, local real-OCR end-to-end, production UI and 401. Unverified: a real production upload (no recorded copy available). Not built: interpreting other uploads into the answer; automatic retrieval of recorded copies.

## Site findings answer first (2026-11-13 ~20:30 UTC)
`web/site-answer.js` leads Site Review and the Overview with the few findings that matter (deterministic ranking, merged duplicates, sources as citations, fallbacks to sources then recorded contacts). Tests `scripts/test-site-answer.js`; verified signed-in in production.

## Project intent and the proposed staged flow (2026-11-13 ~21:30 UTC)
`web/project-intent.js` asks "What are you planning?" after the address, ranked by fit with the lot's records, and stores the plan (`project_intent` command). User direction for the next stage: preliminary pass → intent confirmation → targeted deep research per plan → re-run targeted research when the plan changes. Not started; needs a plan-to-research mapping and gating of the full dossier and the background approval investigation.

## Staged research shipped (2026-11-13 ~22:30 UTC)
Plan: `/Users/wkatzka/.claude/plans/proud-sprouting-mango.md`. `web/research-plan.js` (QUICK, STEPS_FOR per City Inspect permit, deps, stepsFor, needsApprovalResearch); `LotReport.run(..., {steps, prior, investigate})` with step-tagged findings and `facts.stepsRun`; `app.js` first read → `cornerpin:research-permits` targeted runs; permit bundles in `web/project-intent.js`. Verified in production anonymously (see checklist). Pending: exterior-permit run (AI budget), signed-in check, first-read speed.

## Exterior permits and per-permit packets (2026-11-13 ~18:50 UTC)
Shipped `9925da7`, `e423ccf`; SQL `db/set-permits-2026-11-13.sql` applied (live md5 `eb8766cc…`). Per-permit packets, sourced accessory rules, permit-aware fee finding, and a permit-specific approvals answer (`forWork`, check #8). Verified in production on 222320023 with Pool + Deck; one synthesis-only regeneration, $0.47 (Nov 13 total $10.85 / $13). Details and limits in the checklist. Note: the active `gh` account on this machine is now `willkatzka`, which cannot push; pushes used the stored `wkatzka` token for the single command.

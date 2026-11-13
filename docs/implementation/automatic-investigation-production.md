# Automatic address investigation: production acceptance

## Capability under test

A user searches an address that has no parcel-specific research configuration. Cornerpin verifies the county parcel, creates or reuses a durable investigation, discovers relevant public sources, reads original documents, follows cited records, and publishes source-checked statements and specific evidence gaps. Closing the browser must not stop the job. Nothing records an approval or changes the user's decisions.

Test address: **3459 N Wind River Ct, Eden, Utah**. County parcel **222320023**, Trappers Ridge at Wolf Creek PRUD Phase 4, Lot 68, Ogden Valley City. The real browser search created job `ca12cf9a-c654-479a-a158-94be612b1523` at `2026-11-13T01:36:40Z`. No per-address discovery profile or curated approval record was added. Shared county, city and HOA-library adapters are used; direct original leads in the shared catalog are not assertions of parcel membership.

## What runs without the browser

1. Official county/GIS identity and municipal polygon matching; corroboration prevents a nearby address point from selecting a common-area parcel.
2. A private Supabase queue with deduplicated county/parcel jobs, leased claims, persistent page progress, and a minute scheduler calling the authenticated Vercel worker.
3. County/parent parcels and plats, recorder information, municipal requirements, neighborhood directory/library discovery, public notices, released records, cited-record searches and public archive alternatives. Public-notice date windows checkpoint between worker requests; generic instrument references are qualified to the property or jurisdiction. Refined queries retain an audit reason and never become fabricated zero-result receipts.
4. Native PDF text and resumable PDF/TIFF OCR. A private shared reading cache is keyed to independently fetched document bytes and reader version; it preserves OCR provenance and source links without reusing parcel-specific conclusions. Failed, restricted, unread and empty sources remain different states. Public hosts discovered through original links are admitted through a connection-time DNS guard; private and metadata destinations are rejected.
5. Budgeted document interpretation with exact original-page quotation validation, separate authority and timing evidence, project-type conditions, amendment/termination effects, and bounded repair of rejected statements. The existing $5/day limit is unchanged.
6. A final cross-document explanation cites validated evidence IDs, reconciles succession/termination clauses and names specific missing evidence. It remains explicitly conditional and cannot create a readiness or approval decision.
7. Live Rules & Approvals and Record Review updates with original links and explicit limits. An interpretation does not create a user decision, approval or exemption.

## Independent original checks

These checks were performed separately from the automatic worker. They did not seed text, findings or decisions into its checkpoint.

- City submission checklist: separately downloaded bytes match SHA-256 `1aff2d47649aa06e841518ece46e7413f20a2955c2aefc8ab862fe1af6c56064`. Poppler text and rendered PDF pages 1–2 confirm the published water and sewer submission items and the heading that establishes submission context. Generic provider roles remain generic; the app does not invent a named provider or claim the letters exist.
- Wolf Creek design guidelines: separately downloaded bytes match SHA-256 `d1a4679751d03b47b5f5e9c347ad020e7a7c8b89487bfd4972f779b97aa4d87d`. Independent text matches all four published quotations; rendered PDF pages 7, 42 and 43 were inspected. Private design review before County submission, before commencement, developer review and variance submission remain separate. The 2010 guidelines do not establish present OVC intake policy or current parcel-specific reviewer authority.
- Termination original: independently retrieved and rendered PDF pages 1–3. Entry 2628422 was recorded April 3, 2013. Page 2 relinquishes declarant rights including architectural powers, while retaining the other declaration terms. This must be considered alongside the older developer-approval provisions. Neither a title nor this instrument alone establishes current neighborhood appointment or Lot 68 coverage.

- Trappers Ridge declaration and bylaws: the production archive alternative recovered a 103-page public copy after the current-site route was restricted. Independently downloaded bytes match `10389c0d73cc30d408b13fc76bb216a252e53dac5ea9bc22b5c9fa79baa7f7c7`. Rendered PDF page 31 assigns written plan approval to the Board before construction; page 79 expressly lists Phase 4, Entry 2099635, Book 61 Page 60. Page 78 has blank execution date and signature blocks. The copy supplies substantive neighborhood terms and a property-scope lead, but does not establish execution, recording or current effect. The archived source is retained as an archived copy, never relabeled a current-site original.

- Trappers Ridge first amendment: the complete archive copy has SHA-256 `b8967517c1e638a8074a4cbf91679bb7a6265a512e23d829ba857b15eed45bda`. Independently rendered pages 1, 5 and 6 show recording Entry 3277834 on March 28, 2023, the reference to the December 17, 2018 declaration Entry 2957404, preservation of unaffected terms and Phase 4 Lots 46–68. This supplies a precise recorded-document target and property-scope evidence; it does not establish that the unsigned online declaration is identical to the recorded instrument.

- Trappers Ridge second amendment: independently downloaded hash `a21765e8967b91addfca64365686a82cb46905dc07d43927f86a128d9afe2e9c` agrees with the automated original. Rendered pages 1, 4 and 5 have no recording stamp, blank signatures and blank acknowledgments. Page 4 makes effectiveness depend on recordation and preserves unaffected terms. This is a public unsigned copy of fee provisions, not proof of a recorded amendment or an additional plan-approval prerequisite.

## Production recovery and budget behavior

The new-address run exposed worker timeouts and a checkpoint that grew through repeated cumulative search snapshots. Resumable date windows, per-source checkpoints, body-read deadlines and lossless snapshot compaction were deployed. The actual 5.3 MB failed checkpoint compressed to approximately 1.8 MB without removing checked ranges or result identifiers. Subsequent production saves succeeded. A later larger save exposed the database API’s default statement timeout; the research RPC now has a bounded 15-second function-only timeout, avoids redundant full-row copies and uses binary JSON size checks. Other database roles retain their existing timeouts and permissions. This follows the documented [function-level timeout configuration](https://supabase.com/docs/guides/database/postgres/timeouts#function-level).

Three deployment recovery actions are retained in the private checkpoint migration history: release of an obsolete pre-fix worker lease, advancing an old generic retry delay so the new budget-aware worker could continue free source discovery, and correcting an accidental OCR pause so local Tesseract reading could proceed independently of the Anthropic budget. None of these actions inserted findings, changed search outcomes or changed the AI budget. This acceptance run therefore demonstrates recovery under deployment changes, not an assertion that development required no operational intervention.

The existing $5/day cap and full-context reservation remain unchanged. At approximately $2.85 charged on November 12 (Eastern), the ledger could not reserve another maximum-sized interpretation request and paused paid processing until midnight Eastern. Public-source discovery, local Tesseract OCR and source retries continue independently; interpretation resumes automatically without consuming its validation-repair allowance merely because the budget is paused. The UI exposes the reset time. This is a shared budget limit, not a source-access failure or an empty search.

The remaining incorporation original used 33.7-million-pixel one-bit CCITT images. A bounded decoder path now admits that specific encoding up to 40 million pixels, with the existing isolated-worker timeout and output-canvas bounds. All four original pages read locally with OCR confidence 93–94 and then completed through the scheduled production retry at 04:50:50 UTC. No manual retry-state change was needed. Native-text quality checks also triggered image OCR for the amendment's corrupt existing text layer. Two damaged archive copies were resolved only after every byte matched the prefix of a larger parsed copy from the same original URL; both hash pairs and comparison receipts remain in the result.

At 05:01 UTC the scheduler resumed paid interpretation without a manual restart. The first neighborhood chunk retained the exact Phase 4 exhibit and blank execution clause. A bare Article 6 reference initially triggered an unnecessary external search; the deployed resolver now records the substantive heading on PDF page 30 in the same original and removes only that internal reference from missing documents. It does not resolve external instrument names, table-of-contents entries or unread text. A subsequent oversized model response was rejected, and the worker reduced its chunk size before retry.

The production neighborhood interpretation subsequently preserved the exact PDF page 31 Board plan-approval clause with `stage=construction`, `documentStatus=not_established`, and no rejected statements in that chunk. The clause agrees with the independently rendered original. It is not promoted to a current city-submission rule or evidence that an approval exists. The private master and neighborhood roles remain separately scoped.

## Acceptance assertions

`scripts/verify-automatic-investigation-production.js` checks the deployed API and HTML, exact new-address identity/job, a terminal bounded investigation with zero queued checks, city submission statements, construction versus variance timing, original citation fields, absence of inferred parcel membership in the guidelines, and rejection of unauthenticated worker execution. It intentionally fails while the run is queued or running. The final JSON proof is generated only by a passing production run.

## Limits that remain distinct from implementation

- Current private reviewer authority requires an applicable declaration, amendments/delegations and parcel coverage. The master directory is only a lead. A website access restriction does not prove paid recorder custody or absence of another public copy.
- Question-level exhaustion is stricter than queue completion. Nonempty candidate sets, missing source coverage and unreconciled instruments prevent an exhaustive-search or exemption claim even after the bounded worker finishes.
- Coverage is Weber County, with OVC municipal adapters. Other counties are explicitly unsupported. Complete statewide zoning interpretation is not claimed.
- PDF and TIFF were exercised in production. Legacy Word formats have not been production-validated here.
- The prior Cobabe missing instruments and failed real-user comprehension check are not resolved by this new-address acceptance test.

## Final run

At the latest November 13 check, the production job is `retry_wait / budget_pause`, with zero queued source checks and zero unread originals. The 103-page neighborhood declaration has been interpreted, and its Board construction gate passes source validation. Fifteen other recovered documents still require interpretation, including the recorded first amendment and unsigned second amendment. Final synthesis is absent. The production acceptance script correctly fails this state; no passing proof JSON has been emitted.

Today’s charged usage is $2.801668. The unchanged $5 guard cannot reserve the next full-context request. Explicit approval has been requested for a $10 total shared allowance for November 13 Eastern only, reverting automatically to $5 thereafter. The dated change is prepared locally and has NOT been applied. Without that approval, the existing job resumes at midnight Eastern on November 14. This is a budget dependency, not missing source evidence or proof of completed implementation acceptance.

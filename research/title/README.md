# Public historical title research

The research result has four independent states: archive discovery, machine reading, visually checked transcription, and original-instrument/legal reconciliation. Only the first three have coverage in the shipped dataset. Mineral ownership and complete easement clearance remain unresolved.

## Address-to-dossier path

1. Existing address resolution supplies the mapped parcel polygon.
2. `lib/parcel-abstracts.js` intersects that polygon with official PLSS quarter-quarter polygons. Boundary-only touches are excluded. Unsupported geography is retained as a gap.
3. The live Weber section inventory supplies the image URLs. `lib/title-research.js` joins those URLs to retained source-hashed readings. It does not select records by customer address, subdivision name or surname.
4. Targeted visual transcriptions are accepted only when their source URL and hash match the retained reading. Historical bearing/distance calls produce screening geometry only. Bad closure, missing anchors and inconsistent endpoint ties remain unresolved.
5. Results enter the site report, evidence workspace, saved project, recording-reference ledger and pool calculation. A geometric nonintersection never releases a recorded interest. The mineral-chain engine rejects non-original evidence even when fractional arithmetic would reconcile.

## Coverage and operation

The package contains 95 public archive readings across two sections. It contains no customer parcel selection or private plans. These are local machine readings, not 95 fully verified legal abstracts. Seven indexed entries have targeted visual transcription and three have reconstructed geometry definitions. The two canal entries refer to the same strip; they are not two independent restrictions.

Run `node research/title/read-abstracts.cjs survey-response.json output-directory` to read another discovered inventory. Processing defaults to one worker, caps explicit concurrency at two, limits Sharp and OpenMP, uses a directory lock, and reuses existing native or Tesseract readings. It is an offline ingestion command, **not an installed background queue**. No OCR runs during a dossier request.

Run `node research/title/export-readings.cjs output-directory data/title/weber-abstract-readings.json` to package retained readings. The output requires the directory manifest, original image bytes and saved readings. Inspect new transcriptions and source hashes before release. The live inventory is refreshed on a new dossier request; image-byte revalidation is not automatic. Dates and this limitation are visible to users.

For an uncached section the dossier returns actual discovered-but-unread counts and no borrowed findings. A second real Weber parcel selected 547 sheets from its own section and correctly returned zero cached readings and zero pilot-section transcriptions. Automatic ingestion of every new section requires a durable job runner/cache deployment; that capability is not claimed by this release.

## Evidence needed to resolve the legal conclusions

- Underlying deeds and easement instruments, including clauses omitted from the index; book/page/entry requests are generated from actual references.
- Root grant/patent and any mineral reservations, followed by the complete scoped conveyance/severance chain.
- Post-1980 instruments, releases and amendments through a dated search cutoff.
- Original bearing basis, complete legal-description calls and applicable survey control before a historical screening shape can be treated as authoritative.

The county public archive exposes index images, while its online abstract access requires a separately configured access path. The BLM public GLO interface and alternate Utah land-record site were investigated; no parcel-matched patent original was obtained. Neither an empty mineral map nor absent OCR keywords closes these gaps. No records request or email has been sent by this implementation.

## Validation

`node scripts/test-title-research.js` covers different geography, changed source hashes, missing readings, failed coverage, boundary touches, closure errors, invalid calls, hostile OCR escaping, evidence-ledger integration and rejection of abstract evidence as a mineral ownership root. Existing research, storage, backup and permit tests remain applicable. Live pilot findings and a second parcel lookup are retained privately outside the repository; no private property selection is embedded in tests or source data.

## Federal root discovery

`lib/federal-title.js` queries four official BLM grant/conveyance layers, then checks case legal descriptions against the parcel's mapped PLSS locations. Quarter/half-section descriptions use positive-area aliquot overlap; unknown subdivisions remain unresolved. Map features alone do not establish applicability. Failed sources are not converted to clear results.

A retained public serial-register transcription is attached only by exact serial and Salesforce case identity. Its reading date remains visible. The inspected report includes a migrated 1884 patent action. The subsequent original-image review below recovered a county-recorded copy of the patent. The `US Rights Reserved` report field is shown only with the distinction between federal case metadata and later private mineral ownership. The browser can retrieve this public report; anonymous scripted retrieval was attempted but did not return its contents, so automatic report-refresh is not claimed.

The four visually transcribed pipeline entries now retain their west-half descriptive scope. Different aliquots are a screening distinction, not a release or a complete interpretation of the missing original instruments.

Live verification found POST timeouts on the BLM NLSDB host; bounded GET queries succeeded for the same geometry. The adapter uses GET for reasonably sized BLM requests. Previously retrieved public case metadata can survive a source outage only when its legal aliquot matches the requested geography; dates and refresh failure remain visible. A successful empty response is never overridden by the cache. All four BLM layers subsequently returned successfully in the live pilot check.

### Original images recovered, 2026-11-09

`data/title/weber-original-evidence.json` retains three source-image readings independently of abstract entries: Book N 383–386, Patent No. 26 in Book 1 168–173, and the Surveyor's canal acquisition contract/drawing (Entry 391705). Each has source links, hashes, reviewed page scope and remaining gaps. Images are linked, not redistributed. FamilySearch sign-in enabled research access; unattended commercial ingestion/reuse permission has not been established.

The patent includes SE Section 27 and a mineral-land exception with an express coal/iron qualification. The railroad deed contains a conditional railroad corridor and fencing obligation. The canal contract preserves existing third-party rights without establishing their owners. None proves current parcel applicability, complete releases, or current mineral ownership. Related contracts never satisfy missing executed-deed requests.

Matching uses section and aliquot, not customer address or surnames. Findings are reusable for other intersecting parcels. Other sections without reviewed originals remain uncovered; this is not a statewide completed title search. Cached readings avoid repeat OCR. Historic county-book copies and selected surveyor packets are complementary sources, not complete modern-record coverage.

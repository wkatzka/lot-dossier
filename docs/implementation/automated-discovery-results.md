# Cobabe automated discovery — completed search pass, unresolved governing rule

November 12, 2026. Exact project parcel: Weber County 224410004, Cobabe Ranch Phase 1 Lot 4. No messages, orders or paid AI requests were sent. No production deployment occurred.

## Result

The configured public-source search pass finished. It collected **146 distinct documents**; **12 unrelated documents** were excluded after reviewing search/request context. The remaining **1,563 pages** were processed using native text, OCR and targeted visual checks. Four pages that produced no OCR text were visually reviewed: a sign illustration, a blank page, and two tax-notice reverse pages with only tiny print codes. No queued jobs or unread pages remain in the retained scope. Machine reading is not a comprehensive visual or legal review.

The final count is not a claim that 146 documents govern this lot. The acquired material includes meeting packets, master-association records and parcel records. The application exposes selected source candidates and their raw public links, with applicability unverified.

## What the deeper search changed

1. **Conflicting agreement numbers.** [Recorded plat 101-020](https://webercountyutah.gov/mounts/ded_plats/Book_101/101-020.tif) cites **3372687**. The [later county single-family report, PDF page 88](https://www.utah.gov/pmn/files/1363053.pdf#page=88), cites **3372667**, recorded June 10, 2025. The same latter reference appears in the townhome reports on PDF pages 107 and 124. Page 88 was visually checked. Both identifiers were searched in public notices, city search/media, the released-record archive, and targeted web search. No complete executed original of either reference was recovered.
2. **Previously released agreement recovered, but wrong vintage.** [Public document 41613911](https://webercountyut.nextrequest.com/documents/41613911), released under request 24-2330, is a 10-page 2018 Wolf Creek amendment, Entry 2917393, concerning Fairways density. It is not the missing 2025 Cobabe agreement. The title “latest” in an older request cannot make the attachment current.
3. **Public response timelines checked.** Requests [26-1425](https://webercountyut.nextrequest.com/requests/26-1425), [26-320](https://webercountyut.nextrequest.com/requests/26-320) and [26-1373](https://webercountyut.nextrequest.com/requests/26-1373) concern Cobabe communications, Cobabe permits and related Eden Crossing agreements. Their public attachment inventories are empty; public timelines show closure referring to information previously provided, without exposing that information. A closed request is not evidence of what the unpublished response said.
4. **Developer archives checked beyond live pages.** The live sitemap/pages, public CMS HTML including embedded URLs, a broker neighborhood page, and archived content versions were examined. The retained archive ledger includes 37 initial HTML captures and 9 additional versions, including later homepages. No governing PDF/Word link was exposed by those captures. An archive index is not guaranteed to have captured every historical site resource.
5. **Incomplete amendment remains incomplete.** The HOA's linked library, public WordPress search/media and the archive index for alternate versions did not produce the missing exhibit to Entry 2624950. The located public copy still has 3 of 15 recorded pages.
6. **Master DRB assignment remains contradicted.** [January 26, 2023 master HOA minutes, page 2](https://wolfcreekresortmasterhoa.com/wp-content/uploads/2023/03/2022-Annual-Meeting-Minutes.pdf#page=2) exclude Cobabe from master DRB review; later proposed county-agreement material references master covenants. Neither a historical exclusion nor an unsigned proposal establishes the current neighborhood reviewer.

No retrieved applicable instrument establishes whether architectural approval is required before city **submission**, **issuance**, or **construction** for Lot 4. The owner's report remains an unresolved lead, not a disproved claim.

## Search-route closure

| Route | Outcome |
| --- | --- |
| Recorder index | Public access/fee information examined; contemporary title-index access is subscription-based and original copies are paid. No purchase made. |
| Parcel and parent records | Current parcel, parent records and linked plats examined. Exact numeric matching rejects near-match parcels. |
| Planning case files | Frontier public index explicitly returns “Login Required”; direct indexed case/file links redirect home. Actual account barrier confirmed after repairing the HTTP client. |
| Adopted agreements and exhibits | County meeting files, adoption minutes, city WordPress search/media and state-hosted leads checked. Drafts remain distinguished from executed originals. |
| Public notice attachments | Date-partitioned agenda search and discovered attachment reading finished; both recording-number searches completed. |
| Association libraries | Linked governing documents, meeting archives and targeted public search/media queries checked; missing exhibit not recovered. |
| Developer libraries | Live site/sitemap, embedded links and broker neighborhood page checked; no current Cobabe declaration/delegation recovered. |
| Released-record archive | Search results, request details, attachment lists, real download links and relevant public timelines examined. Unrelated fuzzy results excluded. |
| Public mirrors and archives | Mirror leads and recorded archived developer content versions checked; no controlling original recovered. |

“Checks finished” means that each configured source was retrieved, classified as irrelevant/not found, or had an observed access restriction. It does **not** mean every possible public database, unindexed upload or future release has been searched. New evidence must reopen discovery. The [coverage ledger](../research/cobabe-discovery/coverage-summary.json) records queries and scope; raw local manifests additionally retain source bytes and hashes.

## Implementation and validation

- Added a resumable, profile-driven discovery worker for public notices, websites/sitemaps, WordPress, released-record inventories/timelines and archive indexes.
- Added native PDF/Word reading and local OCR; errors and scanned pages stay explicit until processed or reviewed.
- Fixed first-25-result public-notice truncation, fuzzy numeric matches, incomplete/repeated pagination, and missing download-path handling.
- Replaced the HTML parser path that suppressed Node redirect headers in this environment. This had generated false `/null` redirects and apparent 404s. All affected source checks were rerun; actual public downloads then succeeded. A redirect without a Location header now fails explicitly.
- Added an exact-county/exact-parcel index to the existing public-research API and a source-coverage table with original links. Retrieved candidates never mark an approval satisfied or exempt.
- Added cooldown-aware retries, retained failure history, seven-day stale-index labeling, and deployment exclusions for the large local acquisition cache.

Passed: discovery, public-record access, original acquisition, public research, title research and title-link tests; application build. Real public download verification passed after parser replacement. Realistic outcomes checked: a near-match parcel cannot inherit the evidence; an empty GIS result cannot clear private approval; an old agreement cannot become the 2025 original; source retrieval does not establish legal applicability; neither “submit now” nor “send plans to the master DRB” is asserted without evidence.

## Capability checklist and remaining scope

| Capability | Status |
| --- | --- |
| Search the identified public routes without email | Completed for this configured Cobabe pass; no unprocessed queue remains |
| Reuse resumable discovery and publish exact-parcel evidence | Implemented and tested locally; not deployed |
| Retrieve original documents and show their raw sources | Completed for located public files; incomplete copies and unavailable originals remain identified |
| Identify the current Cobabe architectural authority | **Attempted but unresolved**; needs applicable current declaration/delegation and reconciliation of the conflicting evidence |
| Establish approval before permit submission for Lot 4 | **Attempted but unresolved**; missing applicable operative timing clause and complete current agreement |
| Retrieve final recorded agreement and missing legal exhibit | **Attempted but unresolved** through the checked public routes; authenticated Frontier access and recorder subscription/paid-copy routes are specific remaining access dependencies |
| Automatically map binding neighborhood rules for every address | **Not completed**; this pass does not establish legal coverage polygons or a universal current-rule service |
| Deploy a continuously refreshed discovery service | **Unattempted in this pass**; local worker/index is not a hosted scheduler or production-wide queue |
| Finish all Ogden Valley City prerequisites | **Not completed by this Cobabe investigation**; broader remaining scope is recorded in [ogden-valley-coverage.md](ogden-valley-coverage.md) |

The public-only search does not justify a definitive automatic approval gate for this lot. It is also not proof that no additional public copy exists. The verified custodian routes and role contacts are retained in [the evidence report](cobabe-architectural-review.md#custodian-access-after-public-source-checks), without sending requests or treating those contacts as confirmed architectural reviewers.

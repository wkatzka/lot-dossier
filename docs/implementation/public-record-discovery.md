# Public-record discovery before contact fallback

**Update:** The subsequent automated Cobabe pass is documented in [automated-discovery-results.md](automated-discovery-results.md). The initial implementation and earlier remaining-work record below are historical; the new worker now covers the named public-source routes, while production orchestration and legal applicability remain unfinished.

User requirement, November 12, 2026: maximize scalable data access. Do not make emailing authorities the normal acquisition process. Comprehensively investigate alternate public routes first. Only after documented exhaustion and an evidenced access restriction should the product offer the custodian's contact information as a fallback. Do not send messages automatically.

## Required behavior

- Identify county, parcel, parent parcels, subdivision phase, recording numbers, agreement names, association aliases and jurisdiction. These identifiers guide discovery; names or nearby boundaries do not prove legal applicability.
- Check recorder indexes, parcel/parent records, planning case files, adopted agreements and exhibits, public-notice attachments, association and developer libraries, already-released public records, and public mirrors/archives. Follow new document references and reconcile all pages/amendments.
- Retain URL, access date, query/identifiers, pagination or coverage, outcome and any access restriction for each route. A timeout, redirect, empty GIS result, truncated search or unexamined lead is unfinished research.
- Reuse source metadata by county and recording number, and readings by content hash. Never copy an applicability decision from one parcel to another. Track incomplete copies independently of successful downloads and machine reading.
- Distinguish “public copy located,” “incomplete public copy,” “public research incomplete,” and “documented restricted access.” An access restriction on one portal does not close alternative routes.
- Contact fallback needs the custodian, verified official contact/source, exact missing document or clause, access barrier, and the completed search record. Providing contact details does not authorize correspondence.

## Initial implementation (superseded by the completed discovery pass)

- Shared exact-record catalogue for Weber entries 1882728, 2234358, 2624950 and 2628422, backed by retrieved originals and hashes.
- Initial acquisition queues public catalogue matches automatically. References found while reading also resolve through the catalogue and queue the next public original.
- Association-hosted originals are accepted only through exact catalogued URLs; existing download/redirect/size/content checks remain.
- The incomplete second amendment remains 3 of 15 recorded pages even after all three available PDF pages are processed.
- Unknown original references remain public-research-incomplete instead of immediately carrying a recorder order link.
- A route assessment requires documented coverage for every named route and an actual access barrier before contact fallback becomes eligible. Errors and unfinished pagination prevent eligibility. This is an assessment of recorded checks, not an autonomous search crawler or proof of exhaustive internet coverage.

## Additional Cobabe research this turn

- Followed the recorder's official service directory to confirm contemporary title subscription access, free parcel/plats, historical abstracts and the public-release archive.
- [Frontier public project index](https://frontier.co.weber.ut.us/p/Public/List) redirects to an explicit Login Required page. This confirms an account requirement for that route only; account creation/access scope was not tested.
- [Weber NextRequest](https://webercountyut.nextrequest.com/requests) permits signed-out searches of prior requests. “Cobabe” returned two: [26-320](https://webercountyut.nextrequest.com/requests/26-320), concerning whether permits had been issued, and [26-1425](https://webercountyut.nextrequest.com/requests/26-1425), concerning communications about several developments. Both showed zero public attachments. Their closure notices do not answer architectural approval timing.
- The archive's separate [document filename search](https://webercountyut.nextrequest.com/documents) showed 326 public records and zero filename matches for “Cobabe.” This is not full-text or alias exhaustion.
- Followed the public Weber County Hive development index's linked data. Its Cobabe entry supplies reporting and planning leads, not the missing covenant/recorded-agreement copy. This is a discovery lead, not governing authority.

## Earlier remaining-work record

- **Attempted but unresolved:** Cobabe's final recorded agreement, current neighborhood declaration/delegation and pre-submission clause. The prior investigation's contact-request proposal is superseded by this public-first policy.
- **Unattempted in the automated product:** full planning/public-notice/released-records connectors, exhaustive alias/full-text searches, archive crawling, automatic catalogue expansion, and persistent cross-instance shared reading storage. The four-document catalogue is a working reusable start, not comprehensive coverage.
- **Specific access restriction observed:** Frontier requires an account; contemporary recorder title indexing requires a subscription. Neither proves that every other copy is locked away.
- **Contact fallback is not yet justified for Cobabe** because public discovery is incomplete. Existing official contacts may remain in the Contacts directory, but must not be presented as proof that outreach is the only next step.

Validation: exact-county matching, live retrieval/hash equality of all four originals, reference-to-original automatic queueing, missing-exhibit retention, redirect/login rejection, and no fallback eligibility for missing, failed or partial route checks. Existing original-acquisition and title-research regression suites also pass. No live project, email, purchase or production deployment was changed.

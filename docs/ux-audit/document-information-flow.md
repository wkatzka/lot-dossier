# Document information-flow audit — November 11, 2026

Scope: source acquisition → saved documents → site evidence → proposed-work extraction → application answers → filing records, with Overview, Site Review, Permit Preparation, Documents, Submissions & Review, and Activity inspected in source. Browser verification uses synthetic projects and PDFs; no customer records, AI calls, or filings are changed.

## Findings and corrections

1. Public-record analysis was duplicated in `web/city-application.js` and `web/project-workspace.js`. Its location under “Fill from your documents” implied public surveys could fill proposed-house fields. The full analysis now lives once in Documents; Permit Preparation links to it. Its description explicitly says findings do not automatically reconcile GIS or update Site Review totals.
2. `web/site-document-ui.js` showed filenames and scan state, but purpose, origin and parcel applicability were missing or hidden. Records now show a readable survey record title, original filename, version, source host where available, retrieval date where available, purpose, analysis state and explicit applicability limits. Analysis summaries and cited claims are visible without triangle disclosures.
3. Raw source links were available only on analyzed claims with a source URL. Every saved record now offers original-file access before analysis. HTTPS source URLs open the raw source; a saved-copy PDF viewer and download remain available independently. Missing files give an actionable error. Non-PDF files are downloadable instead of rendered as active content.
4. Documents mixed public references, proposed designs, supporting approvals and filing history. One inventory now groups public records, proposed plans, supporting reports/approvals, correspondence/filing records, and superseded versions. Current public PDFs appear once, with earlier versions retained in history.
5. Site Review lacked a visible route to this evidence workspace. Its page heading now links directly to public records in Documents. Existing findings retain their citations; no source rows are silently converted into approved facts.
6. Proposed-work extraction accepted any non-public PDF, including filing receipts and reviewer letters. Its selector now includes proposed plans and relevant design/engineering documents. Scope confirmation remains required. Receipts and correspondence keep their place in Submissions & Review.
7. Public source retention may fail, leaving research references without saved PDFs. These references now appear with their original links where known and an explicit saved-copy gap; they are not counted as analyzable saved PDFs.

8. Receipt recording appeared both before and after submission. It now has one home in Submissions & Review; Permit Preparation points there after the handoff.

## Information ownership

| User question | Primary home | Next step |
|---|---|---|
| Where does this project stand? | Overview | Open site work or permit work |
| What is known or unresolved about the lot? | Site Review | Read findings/citations; open public records |
| What is this file, why is it here, and can I read the original? | Documents | Open source/saved PDF; review cited analysis |
| What are we proposing to build? | Permit Preparation / Building plans | Analyze current plans and choose permit draft |
| What supports this application answer? | Permit draft / Supporting evidence | Inspect source and edit/save the answer |
| What did the authority request or receive? | Submissions & Review | Record receipt, corrections, and issuance evidence |
| What changed and which version was used? | Activity; Documents version history | Inspect events, snapshots and original files |

## Limits found by the audit

- Existing survey metadata does not establish an authoritative document title, surveyed property, survey date or legal applicability. The UI uses a record identifier and clearly qualified relevance rather than inventing these facts.
- Public-record AI results remain separate evidence suggestions. Automatic claim-level comparison with GIS, reconciliation into Site Review, and a general review/confirmation model are not implemented by this change. Those are data-model capabilities, not labeling fixes.
- A source URL can change or be unavailable; the retained, hash-linked copy is the version analyzed. Claims are shown only for a matching document ID and hash.
- This audit does not certify factual completeness of GIS, agency requirements, legal records, or existing permit answers.

## Validation

Build, document information-flow regression, site-document reader, native city forms, workspace persistence/navigation, and concern navigation. Browser checks cover Site Review → Documents, scan-independent raw PDF viewing, source links, visible analysis/applicability, and document grouping. Source link URL composition is tested; remote archive availability is not assumed from a stored link.

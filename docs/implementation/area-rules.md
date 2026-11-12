# Address-to-rules implementation — 2026-11-12

## Agreed capabilities
- [x] Reuse address-resolved parcel; query actual GIS polygons rather than mailing city.
- [x] Show municipality, water, health, county zoning/flood/WUI and selected taxing-district intersections with original GIS links and lookup time.
- [x] Map subdivision parcel candidates by exact recorded subdivision name, clearly distinguished from legal HOA membership.
- [x] Retain all overlapping matches and failed/limited responses; do not turn missing data into clearance.
- [x] Source-linked rules for pilot jurisdictions: Ogden Valley, Ogden, Huntsville; preliminary neighborhood candidates for Retreat, Highlands and Wolf Creek.
- [x] Distinguish before submission, during review, before issuance, before work, and unresolved timing.
- [x] Explicit supporting-evidence decisions, contacts destination, original document links, and submission handoff blockers.
- [x] Invalidate decisions after scope, site, plan, map refresh or supporting-document replacement. Frozen package contains the application including rule evidence.
- [ ] Automatic legal HOA membership: attempted but unresolved; GIS subdivision parcels are not covenant boundaries. Recorded declarations/amendments must establish lot inclusion and master/neighborhood delegation.
- [ ] Complete zoning/overlay interpretation and full statewide municipal rule catalog: unimplemented. Local coverage gap is explicit and requires sourced review.
- [ ] Automatic highway-access/stream-impact determination: unimplemented; proposed access and work footprints are needed beyond parcel overlap. Requirements remain visible for review.

## Sources and behavior
Source URLs and source-check date are in web/area-rules.js. Boundary retrieval does not update the legal-source research date. The municipal layer is statewide; county-specific layers are queried only for Weber. Taxing districts are candidate authorities, never proof of entitlement. Exact subdivision name queries intentionally do not claim fuzzy neighborhood identity. Truncated responses become unavailable.

The Rules & Approvals destination queries on its first opening, then retains the snapshot until explicit refresh. Project scope is explicitly recorded; parcel acreage is never used as disturbed acreage. Before-submission unresolved rules block freezing a new filing handoff. Recording a real external filing receipt or issued permit remains possible: historical facts are not suppressed by checklist gaps. Later-stage requirements are linked from Submissions & Review.

## Validation
- Pure workflow tests: applicability, unknown scope, multi-municipal overlap, failed GIS, missing evidence, stale approvals, package lifecycle and retained receipts.
- Live public GIS: synthetic polygon near Eden matched Ogden Valley City, Eden Water Works, Weber Fire District and Weber-Morgan Health. A timed-out district query stayed unavailable, then succeeded in browser verification.
- Existing narrative, document-flow, workspace, screen-layout and design-foundation regressions run.
- Browser test uses only synthetic project data; no customer approvals are entered.

## Remaining limitations
This is a pilot rule atlas, not a complete cadastral/legal restrictions database. Municipal, zoning and service boundaries can lag adopted changes. A matched rule is not authority approval; saved decisions are user-reviewed evidence. Source texts need rechecking as codes change. No messages, applications or approvals are sent to authorities automatically.

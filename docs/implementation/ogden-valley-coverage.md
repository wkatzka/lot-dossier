# Ogden Valley City implementation and remaining coverage — 2026-11-12

## Agreed capabilities

- [x] Address-resolved parcel, authoritative municipal matching, original GIS links and retained overlaps/failures.
- [x] City current zoning in addition to county zoning; do not hide disagreement or choose one of multiple intersected zones.
- [x] City GIS overlays: watercourses, slope classes, agreements, habitat, scenic roads/skylines, water/sewer, landslides, liquefaction, faults; state roads, lakes and wetland inventory.
- [x] Parcel and optional proposed-work/access drawings; buffered spatial lookup, line/polygon display, crossing and approximate distance evidence. GIS centerlines are not high-water or right-of-way boundaries.
- [x] Sources for all 14 base-zone labels represented by the published zone chapters, with residential dimensional baselines and commercial/special-zone summaries. Thirty-eight city code chapters are linked with source hashes in the manifest.
- [x] Submission, review, issuance and construction approval sequence; water/sewer/well/septic, design, environmental, access, subdivision and private-review checks.
- [x] Master/neighborhood candidates, original documents, contacts, evidence-backed decisions, stale-decision handling and submission handoff gates.
- [x] Preserve current project history and submitted packages. Nothing is sent to an authority.

## Not a claim of complete automated legal interpretation

- **Attempted but unresolved:** every use/exception in every zone is not encoded as an automatic decision. Commercial/special zones have sourced dimensional summaries; exact uses, exceptions, mixed uses, vested rights, variances, nonconformities and plan-specific interpretation require a recorded planning review. All residential dimensional checks are baselines, not compliance certificates. HR wastewater-dependent lot area, combined side yards, adjacency, coverage, widening and the documented commercial/special-zone dimension conditions are now numerically evaluated when the required measurements are supplied. Missing measurements remain unresolved.
- **Attempted but unresolved — recorded-instrument research remains unfinished:** legal HOA membership, annexations, delegation, amendments and approval timing cannot be established by subdivision names. Expanded Wolf Creek candidates follow the master association's published neighborhood list, not invented legal polygons. Recorded declarations/title documents remain required; no legal membership layer was verified. Public master declarations and neighborhood governance libraries exist and must be traced before claiming an access blocker.
- **Resolved discovery gap:** public Utah DDW groundwater protection, surface-water protection and transient-system assessment polygons were found and connected. All three queried successfully; the live Eden test returned surface-water protection matches. Coverage and plan currency still need verification; water-service areas are not substituted.
- **Attempted but unresolved — source reconciliation:** adopted forest-zone PDF page 13 prints “3525 feet” with edit formatting. The system flags the height rather than guessing. Its lot-width footnote also references F-10 while the table is F-5/F-40. RE chapter section numbering is inconsistent and is identified explicitly.
- **Blocked by project/survey evidence:** exact high-water marks, jurisdictional wetlands, average natural slope, legal road access/ROW and actual construction impacts require qualified evidence. Automatic proximity/crossing screening is implemented; it does not issue approvals or conclusively determine federal water jurisdiction.

## Sources

Official entry points: https://ogdenvalley.gov/land-use/ and https://ogdenvalley.gov/planning/ . City GIS webmap aa0cb760e8404b73b90fadd3fda52470, linked through the city's GIS Experience. Code source URLs/hashes: `ovc-source-manifest.json` and `web/ovc-code-sources.js`. General plans are not encoded as binding zoning standards. Neighborhood reference: https://wolfcreekresortmasterhoa.com/neighborhood-hoas/ .

## Validation

- `test-ovc-rules.js`: baseline and substandard parcel dimensions, conflicting/absent zoning, forest text ambiguity, slope/highway/stream triggers, crossing/distance geometry, invalid drawings, changed footprint and stale approval evidence.
- `test-ovc-live.js`: synthetic test polygons crossing a year-round stream and a UDOT road from public GIS; both located within Ogden Valley City and matched automatically.
- Existing area-rule, permit lifecycle, workspace, narrative, document-flow, screen-redesign and design-foundation tests pass.
- Browser: synthetic drawing/refresh scenarios plus the real Cobabe project, with AV-3/MPD overlap, source-protection and water-provider candidates. The real project successfully saved its GIS snapshot to the existing private account after the payload fix. No customer approvals or authority submissions.

## Implementation boundaries

The feature is an expanded rule-screening and evidence workflow, not a completed exhaustive city legal engine. No statewide expansion is included in this city-scoped work. Downloaded originals remain in temporary research storage; only public source metadata and derived code are packaged. Rule research date and GIS retrieval timestamp are separate. Updating the rule version invalidates older map coverage for filing readiness.

## Search correction — November 12

The earlier focused search was not exhaustive. It missed the DEQ-hosted ArcGIS services and a later shoreline amendment. These were research gaps, not proof that data was unavailable.

- Public services: `https://services2.arcgis.com/NnxP4LZ3zX8wWmP9/arcgis/rest/services/`. Groundwater protection layer 4, surface-water protection layer 3, transient-system assessment layer 2 are now connected with source links and independent failure states. Regional bounding-box queries returned 224, 8 and 51 records respectively; these are not city-boundary counts.
- Approved September 1 council minutes: https://www.utah.gov/pmn/files/1489525.pdf pp. 3–4 record adoption of Ordinance 2026-53 and a 25-to-35-foot S-1 height change. The older automatic 25-foot test was removed. Full amendment text, effective date and other changed conditions remain to be reconciled; minutes alone are not the complete ordinance.
- Searches included city land-use/code pages, city WordPress media catalogs, Utah Public Notice records, Utah GIS catalogs and DEQ ArcGIS services. A city media query for `2026-53` returned no result; that does not establish unavailability. Shoreline drafts and summaries are available for further comparison.
- Public neighborhood leads: https://wolfcreekresortmasterhoa.com/hoa-documents/ and https://retreatwolfcreek.com/ . Declaration amendments, legal descriptions and delegation still need parcel-specific tracing. No exhaustive neighborhood search is claimed.

Remaining authorized work: complete amendment reconciliation, encode remaining applicable uses/exceptions, trace neighborhood legal coverage and approval delegation, and validate representative real parcel/proposal scenarios. Surveyed boundaries and actual proposed impacts remain project-evidence dependencies; they do not prevent continuing the rule research.

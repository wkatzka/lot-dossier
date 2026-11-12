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

- **Attempted but unresolved:** every use/exception in every zone is not encoded as an automatic decision. Commercial/special zones have sourced dimensional summaries; exact uses, exceptions, mixed uses, vested rights, variances, nonconformities and plan-specific interpretation require a recorded planning review. All residential dimensional checks are baselines, not compliance certificates. HR wastewater-dependent lot area, combined side yards, adjacency, coverage, widening and other exceptions are displayed but not all numerically evaluated.
- **Blocked by parcel-specific recorded instruments:** legal HOA membership, annexations, delegation, amendments and approval timing cannot be established by subdivision names. Expanded Wolf Creek candidates follow the master association's published neighborhood list, not invented legal polygons. Recorded declarations/title documents remain required; no legal membership layer was verified.
- **Attempted but unresolved:** no verified citywide public drinking-water source-protection polygon set was found in the city GIS or focused official-source search. Provider-approved protection maps are required; water-service areas are not substituted.
- **Blocked by a source ambiguity:** adopted forest-zone PDF page 13 prints “3525 feet” with edit formatting. The system flags the height rather than guessing. Its lot-width footnote also references F-10 while the table is F-5/F-40. RE chapter section numbering is inconsistent and is identified explicitly.
- **Blocked by project/survey evidence:** exact high-water marks, jurisdictional wetlands, average natural slope, legal road access/ROW and actual construction impacts require qualified evidence. Automatic proximity/crossing screening is implemented; it does not issue approvals or conclusively determine federal water jurisdiction.

## Sources

Official entry points: https://ogdenvalley.gov/land-use/ and https://ogdenvalley.gov/planning/ . City GIS webmap aa0cb760e8404b73b90fadd3fda52470, linked through the city's GIS Experience. Code source URLs/hashes: `ovc-source-manifest.json` and `web/ovc-code-sources.js`. General plans are not encoded as binding zoning standards. Neighborhood reference: https://wolfcreekresortmasterhoa.com/neighborhood-hoas/ .

## Validation

- `test-ovc-rules.js`: baseline and substandard parcel dimensions, conflicting/absent zoning, forest text ambiguity, slope/highway/stream triggers, crossing/distance geometry, invalid drawings, changed footprint and stale approval evidence.
- `test-ovc-live.js`: synthetic test polygons crossing a year-round stream and a UDOT road from public GIS; both located within Ogden Valley City and matched automatically.
- Existing area-rule, permit lifecycle, workspace, narrative, document-flow, screen-redesign and design-foundation tests pass.
- Browser: synthetic project only; live refresh, dual AV-3/FV-3 matches, drawing/save/reload persistence, slope-trigger update and mapped overlays. No customer approvals or authority submissions.

## Implementation boundaries

The feature is an expanded rule-screening and evidence workflow, not a completed exhaustive city legal engine. No statewide expansion is included in this city-scoped work. Downloaded originals remain in temporary research storage; only public source metadata and derived code are packaged. Rule research date and GIS retrieval timestamp are separate. Updating the rule version invalidates older map coverage for filing readiness.

# Calibrated plan measurements

## Capability checklist and current evidence

- Implemented: arbitrary uploaded PDF pages, original-page overlays, two independent dimension controls, restored page aspect ratio, feet/inches and explicit metric conversion.
- Implemented: nine area destinations, holes and disconnected contours, four actual setback destinations, and two reviewed minimum side-setback rules. Rules and proposed distances are separate facts.
- Implemented: deterministic vector/dimension calibration where usable PDF vectors and labels exist; manual calibration for scanned or unsupported drawings.
- Implemented: reviewer confirmation, source page/document hash/version, calculation method and sensitivity retained with the permit answer. Reviewed current area answers feed the valuation worksheet. Superseding plans require review again.
- Implemented: optional authenticated Claude boundary suggestions, separately cached, never automatically accepted as permit answers. This is experimental.
- Attempted but unresolved: reliable automatic whole-floor boundary tracing. Actual-plan calls returned no usable complete boundary candidates. The functioning path is reviewed tracing/calculation, not autonomous extraction of all fields.
- Blocked by missing source geometry: actual setbacks for the private validation plan set. Its site drawing does not establish the parcel boundary and proposed house placement together.
- Unattempted in this change: automatically placing a building footprint onto county GIS and treating that placement as a measured proposed setback. Public parcel geometry alone does not establish the proposed placement.
- Not established: accuracy across arbitrary architects, scan qualities and floor-area definitions. A single successful area benchmark is not general validation.

## Validation

Private actual-plan validation (drawings and coordinates excluded from public repository):

- Independently traced interior garage area: 1,054.37 sq ft against a printed 1,056.51 sq ft, about 0.20% difference. This is an interior room benchmark, not proof of gross permit area.
- Browser workflow: original PDF overlay → calculated 1,054 sq ft → reviewer confirmation → permit garage answer with provenance; original conflicting printed readings remain in evidence history.
- Browser automatic second-floor calibration recovered 48 ft 9.5 in and 27 ft 3 in using two orthogonal PDF dimension spans.
- Deterministic main-floor/site calibration also recovered orthogonal overall spans.
- Real Claude geometry calls failed to establish reliable whole-floor boundaries. No synthetic result substitutes for that missing capability.

Independent public negative test: [Boise sample site plan](https://www.cityofboise.org/media/18948/sample-siteplan_rev-07032024.pdf). Its diagram does not maintain consistent scale across the checked printed dimensions; calibration is rejected rather than producing distances.

`node scripts/test-plan-measurements.js` covers aspect ratio, rotation, holes, disconnected areas, overlap/self-crossing rejection, inconsistent scale, metric conversion, setback distances, full-edge selection, permit integration and source supersession. All 30 repository test scripts passed during implementation. The actual-plan browser test supplements those technical checks.

## Method and interpretation

Geometry is normalized to the page and converted back to PDF-point proportions before calibration. Two nonparallel dimension spans must agree within 1.5%. Polygon areas use shoelace arithmetic minus reviewed exclusions. Setbacks use shortest segment distance to the full selected parcel edge; the applicable jurisdiction rule, projections and front/side classification still require confirmation.

Sensitivity is a coordinate/scale perturbation estimate, not a statistical confidence interval. The tool supports auditable, reviewed planning takeoffs. It is not a boundary survey, certified gross-area calculation or broadly validated autonomous estimator. Reviewers must choose the correct physical boundary and area definition before accepting an answer.

No additional serverless function was added; geometry uses the existing authenticated projects endpoint. Deterministic measurement/calibration runs locally. Claude is optional and subject to the existing extraction budget.

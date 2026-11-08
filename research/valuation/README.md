# Weber model repair and expanded source audit — November 7, 2026

[Latest development report](../../docs/research/backtest/weber/development-v2.html). This pass repairs the model and expands source research; it **does not establish a larger qualifying single-house-lot dataset or independent accuracy**.

The original ridge fit confounded time, acreage and geography: three older valley tracts versus two newer western lots. Its penalty compressed the size effect; the learned time coefficient was negative. The replacement `weber_comparable_model.py` estimates log-area elasticity from pairs within the same region and segment, then anchors the estimate to size-adjusted local comparables. Pair slopes are not independent observations. The bounded elasticity is a stated modeling assumption. Utility, entitlement and time dollar adjustments remain unidentified rather than invented.

| Reused development outcomes | Previous MAE / within $50k | Revised MAE / within $50k |
|---|---:|---:|
| Final two outcomes, fixed first-five training | $109,964 / 1 of 2 | $40,712 / 2 of 2 |
| Expanding chronological window | $199,316 / 0 of 4 | $39,495 / 3 of 4 |
| Exclude two atypical transaction remarks | $272,492 / 0 of 2 | $88,359 / 0 of 2 |

All outcomes were previously inspected. These are **development diagnostics**, not a fresh holdout. For the large tract, delete-one-training estimates span $196,947–$928,247; this instability range is not a calibrated interval. A separate land-plus-barn allocation scenario audits the rejected eighth candidate without inflating the primary denominator.

Expanded research screened 37 additional candidate files, fully OCRed 71 pages in nine of them, and fully OCRed 59 further pages in five older packets. Candidate filenames include duplicates and irrelevant items; these counts do not mean 37 useful new appraisal reports. A further 65-page USHE section yielded no extra closing-price table. The state Bear River appendix was text-screened, not exhaustively OCRed. Audit URLs, hashes, coverage and dispositions are in `expanded-source-audit.json`.

Three new priced Weber multifamily-development observations are retained in `additional-cohorts.json`. They are broker-reported, not independently settlement-verified, and include a teardown and a two-transaction assemblage. They are not single-house-lot comparables. Public portal candidates with unverified price provenance or house/land misclassification remain quarantined. **Qualifying primary count is still seven; fresh independent evaluation count is zero.**

```sh
python3 -B research/valuation/weber_comparable_model.py
python3 -B research/valuation/render_weber_development.py
python3 -B -m unittest discover -s research/valuation -p 'test_*.py'
```

Remaining public-record acquisition leads: the 2550 South appraisal exhibits, Roy/Riverdale 5600 South appraisal exhibits, and vacant-land Board of Equalization comparable exhibits. A public vendor filing identifies the first two report collections (`https://www.utah.gov/pmn/files/1123245.pdf`), but does not include them. No record request or external message has been sent. Unknown records are not represented as retrieved data.

# Original Weber County experiment — November 7, 2026

The current requested experiment is **Weber County only**. [Open the complete local report](../../docs/research/backtest/weber/report.html). Earlier outside-county experiments below are historical work, not evidence for this product's market accuracy.

Recovered seven distinct residential-use land transactions from county-hosted MLS exhibits (2019 and 2021), including rural tracts. Two additional Hammer sales are excluded for a bundled house transaction and an unallocated historic barn. The Wayman/Hammer duplicate is counted once. Original source URLs, PDF pages, hashes, transaction flags and exclusions are in `docs/research/backtest/weber/sales.json`; the packet search inventory is in `source-search.json`.

The new partial-information model uses regularized log-price regression with nonlinear acreage, local submarket, water, sewer, power and date. Unknown optional inputs remain unknown. It uses a fixed penalty and does not tune on test outcomes. It is a small-sample research model, not a claim that seven sales support independently reliable adjustment coefficients.

**Frozen chronological test:** first five sales train, final two test. One of two within ±$50,000; MAE $109,964. The median-price baseline MAE is $170,000; the acreage-rate baseline MAE is $63,738. The more complex model does not beat the acreage baseline on this tiny holdout. **Expanding chronological diagnostic:** zero of four within ±$50,000; MAE $199,316. Excluding the off-market and reported below-market transactions yields zero of two within the band; MAE $272,492. These overlapping runs are not independent validation.

Listing-era property descriptions are reconstructed from later printed reports. This is not a historical public-as-of replay; closing statements, arm-length conditions and immutable pre-sale snapshots are not independently verified. No calibrated intervals or current-market accuracy claims are made. The successful held-out prediction is the transaction carrying a below-market remark; excluding it does not rescue performance.

```sh
python3 -B research/valuation/weber_backtest.py
python3 -B research/valuation/test_weber_backtest.py
```

Checklist: public Weber price recovery **completed for seven research records**; local model and actual held-out test **completed**; representative dataset and reliable ±$50k performance **attempted but unresolved**; production valuation approval **blocked by insufficient representative local accuracy evidence**. Existing dossier, title, pool and permit scope remains in the project ledger.

---

# Qualification audit and real public-data backtests — November 7, 2026

The original zero-eligible result conflated research admission, full-feature model support, and production readiness. The corrected pilot audit admits **3 of 17** candidates for retrospective research. **13** have no attributable closing price; **1** includes improvements. The three retained sales are agricultural/development tracts with documented caveats, not certified finished-lot comparables. Public-as-of replay still admits zero because publication timing is unknown. That is a different experiment.

Read [the complete audit](../../docs/research/backtest/valuation-audit.html). Every rejection is in `qualification-audit.json`. The original full-profile Huber model remains available; its feature requirements no longer define whether a sale exists. `eligibleRecords` and `modelReadyRecords` are separate.

## Actual outcome tests, not synthetic accuracy

`public_benchmark.py` implements a separate partial-information nonlinear hedonic estimator using histogram gradient boosting. Missing features remain missing, category mappings and feature inclusion are trained without test outcomes. Prior assessments are predictors; **actual county-recorded prices are the outcomes**. No assessment, asking price or synthetic price is used as a target.

| External Cook County experiment | Holdout sales | Within ±$50,000 | Median absolute error | Mean absolute error |
|---|---:|---:|---:|---:|
| 2020, explicit land-sale cohort, tuned on dollar MAE | 196 | 51.0% | $44,981 | $513,837 |
| 2024, corroborated vacant classification, tuned on dollar MAE | 613 | 25.3% | $144,226 | $241,758 |
| Same 2024 holdout, selected on earlier ±$50k tuning hit rate | 613 | 28.9% | $120,479 | $248,188 |

The 2024 tolerance policy selects the highest hit-rate candidate using **2022 outcomes only**, with dollar MAE as tie-breaker. It was added after inspecting the initial MAE result in response to the user's dollar-band criterion. Treat it as a reported policy sensitivity, not another independent test sample or a pristine pre-registered validation. No candidate is selected by 2024 error.

The older explicit-LAND dataset has 2,000 eligible observations, but no usable historical acreage in the characteristics table. Its final evaluated test has 196 sales after chronological splits and parcel embargo. The newer cohort has 3,085 eligible observations; 2020 GIS polygons provide historical area for 2,762. WGS84 geodesic area calculations account for polygon holes. Conflicting polygons or absent geometry do not remove transactions; area remains missing. Stable PIN matching does not prove unchanged boundaries. Features also include location, time, historical assessed land, flood-zone and walkability where source-year evidence permits.

2024 split: 742 training (2021), 846 tuning (2022), 697 calibration (2023), 613 test (2024). Train and tuning are refit together after choosing hyperparameters; calibration only sizes uncertainty intervals. Parcel repeats are embargoed between partitions. The 2024 test was a new holdout after the 2020 experiment; the reports preserve both. None demonstrates Utah accuracy or production readiness. Modern blank transaction-type records require sale-year class 100 (the fetch query), prior-year class 100, and zero prior-year building assessment. This is a classification screen, not individual confirmation of the property's condition at closing. Residential-land class 200 was separately checked: only 52 raw transactions over 2015–2024, many multi-parcel/improved; it did not supply an adequate replacement cohort.

## Reproduce

Install `research/valuation/requirements.txt` in your Python environment, then from the repository root:

```sh
python3 -B research/valuation/prepare_public_input.py
python3 -B research/valuation/fetch_public_benchmark.py /path/to/public-cache
python3 -B research/valuation/fetch_public_benchmark.py /path/to/public-cache --modern
OMP_NUM_THREADS=2 python3 -B research/valuation/public_benchmark.py /path/to/public-cache docs/research/backtest/public-benchmark-result.json
OMP_NUM_THREADS=2 python3 -B research/valuation/public_benchmark.py /path/to/public-cache docs/research/backtest/public-benchmark-modern-result.json --modern
OMP_NUM_THREADS=2 python3 -B research/valuation/public_benchmark.py /path/to/public-cache docs/research/backtest/public-benchmark-tolerance-result.json --modern --objective within50000
OMP_NUM_THREADS=2 python3 -B -m unittest discover -s research/valuation -p 'test*.py'
python3 -B research/valuation/render_audit.py
```

The committed input JSON files preserve the feature/target snapshot and each result fingerprints it. Live API reruns may differ after county corrections. The downloader requests no buyer/seller names. Local source caches are outside the public repo; source queries and public dataset IDs are in the downloader. Individual predictions link back to their document-number query. Strict historical publication availability remains unproven: both benchmarks are **retrospective reconstruction**, not public-as-of replay.

Point prediction evaluation no longer requires 20 calibration observations; only interval estimates do. The ±$50,000 calculation is inclusive and absolute, with price-band breakdowns to expose easier low-dollar cases. Tests verify withholding prices, repeated-parcel embargo, no future feature admission, absent optional attributes, actual pilot admission, tolerance boundaries and point testing without intervals.

## Current capability checklist

- [x] Audit all 17 pilot candidates, including every rejection reason.
- [x] Separate admissible research sales from complete model inputs and public-time availability.
- [x] Fetch public data and run actual temporal outcome tests with learned multivariate models, baseline comparisons and per-sale evidence.
- [x] Evaluate the user's ±$50k band; retain failed outcomes and price-band breakdowns.
- [ ] Reliable ±$50k accuracy: **attempted but unresolved**; current tests do not establish it.
- [ ] Independent Utah pilot validation: **blocked by local dataset coverage**, with only three conditional historical land observations recovered.
- [ ] Defensible production pilot value: **blocked by local calibration and validation**. No accuracy claim or automatic estimate is promoted.

Earlier dossier, easement/mineral/pool and permit/storage scope is retained in [the project ledger](../../docs/substantive-dossier-plan.md).

## Original full-profile v1 model reference


Research implementation of a multi-attribute residential-land valuation model and its actual chronological evaluation pipeline. This is not the earlier gross-acre diagnostic. No pilot coefficients or market-accuracy claim have been manufactured from that diagnostic.

## What is implemented

1. **Evidence checks.** Separate actual closing prices from listings/assessments, qualify transaction type, match the pilot submarket, and preserve feature-level source/effective/publication dates. A valuation must be within 30 days before its sale outcome. Historical reconstruction and public-information replay are distinct modes. Unknown inputs are reported rather than assigned favorable values.
2. **Learned adjustments.** Fit Huber robust regression to log closing price, with regularization chosen using an earlier chronological validation block. Features include log acreage and its square (nonlinear size effects), permitted units, buildable fraction, terrain and its interaction with buildable fraction, location, market date, water, sewer, access, entitlement, zoning, view and hazard categories. Scaling and category vocabularies are fitted on training data only. No fixed utility/view/entitlement premiums are invented.
3. **Comparable reconciliation.** Select up to seven nearby, earlier transactions with matching entitlement and zoning class. Apply the fitted attribute differences to each observed sale; combine adjusted indications using similarity weights and a geometric mean. Retain sources, weights, distances, per-feature log contributions, and a sequential dollar adjustment waterfall. Dollar waterfall effects depend on their displayed order; they are not independent additive dollar premiums.
4. **Unsupported-property handling.** Abstain on unseen categories, numeric features outside observed training ranges, too few matching comparables, distant/stale sales or excessive adjustments. These are engineering controls, not standards-mandated cutoffs. The direct hedonic estimate is returned as a diagnostic, not averaged in to conceal disagreement.
5. **Held-out evaluation.** Train/tune, interval calibration and final test blocks are chronologically separate. Embargo repeated parcels (including overlap in multi-parcel transactions) across blocks. Optional subdivision holdout checks generalization to unseen developments. Frozen calibration errors produce multiplicative intervals. Report prediction coverage, interval coverage, dollar error, percentage error, bias and acreage segments. Compare the actual model against median-price and gross-acre baselines on the same scored targets.
6. **Residual cross-check.** Discount explicitly dated project cash flows, solve the land acquisition budget, and compare specified investment scenarios against the market indication. The unlevered required return includes capital return; separate interest/profit deductions are rejected to prevent double counting. Builder budgets remain distinct from market value, never averaged into it.

## Current public-data run

The run examines the 17 source-audited property candidates in `docs/research/backtest/hedonic-public-input.json`. Both public replay and retrospective modes return `blocked_insufficient_qualified_data`, with null error/coverage metrics. Four county-hosted records have explicit sold prices; one includes buildings. The remaining land records do not form a sufficient, reconciled residential-lot training/calibration/test set. The normalizer retains reported gross acreage and service descriptions with unresolved dates rather than discarding evidence or inventing historical validity.

The new PMN appraisal packet contains six explicit commercial-land comparable prices, including a Roy site. It is outside the target geography/use class and is not training data. Five further county acquisition covers identify the 2550 South road corridor, also outside the pilot. A local broker's historical land-market report supplies aggregate counts and medians, useful as context but not a substitute for property-level outcomes. See `docs/research/backtest/model-source-search.json`.

**The engine is implemented and engineering-tested. It is not calibrated or empirically validated for the pilot.** No production website valuation has been enabled. The one-observation 58.2% gross-acre diagnostic does not measure this model and is not used to tune it.

## Run

Use Python with the versions in `requirements.txt` (a dedicated virtual environment is recommended):

```sh
python3 -m pip install -r research/valuation/requirements.txt
python3 -B research/valuation/test_model.py
python3 -B research/valuation/prepare_public_input.py
python3 -B research/valuation/backtest.py docs/research/backtest/hedonic-public-input.json docs/research/backtest/hedonic-public-result.json
python3 -B research/valuation/backtest.py docs/research/backtest/hedonic-public-input.json docs/research/backtest/hedonic-retrospective-result.json --mode retrospective
```

For subdivision robustness, add `--holdout-subdivisions` to a dataset with subdivision identities. The normal run and this run must be reported separately. Synthetic test fixtures exercise estimation, explanations, intervals, chronology, leakage, support checks and DCF arithmetic. Their accuracy is not market evidence and is not mixed into public-data reports.

## Full-profile v1 data contract (not the research-admission gate)

Top-level fields: `submarket`, `trainEnd`, `calibrationEnd`, `asOf`, `records`.

Each transaction: unique `id`, stable `propertyKey`, optional `parcelIds` and `subdivision`, `submarket`, `propertyType: vacant_residential_land`, `valuationDate`, `saleDate`, `availableAt`, actual numeric `price`, `priceType: closed_price`, `priceVerified: true`, source URL, `transactionConditions: ordinary_market`, and `features`.

Each feature stores `{value, source, effectiveAt, availableAt}`. Dates are ISO calendar dates. `effectiveAt` means evidence establishes the feature applied at that historical date; it is not simply today's retrieval date. Estimated GIS-derived features can be supplied when their method, source and historical applicability are documented; the program does not claim they are survey measurements. A missing effective date stays unresolved. Public replay additionally requires that the feature evidence was available by the valuation date; retrospective reconstruction does not make that claim.

Required numeric features: `grossAcres > 0`, `permittedUnits > 0`, `0 < buildableFraction <= 1`, `slopePercent >= 0`, latitude and longitude. Required categories: `water`, `sewer`, `access`, `entitlement`, `zoningClass`, `viewClass`, `hazardClass`. A planned unit count is not an approved entitlement. Agricultural acreage and speculative development tracts must not silently become finished residential lots. Current attributes must not describe a historical vacant lot after a house was built.

The initial implementation deliberately abstains for missing material attributes. Assess the resulting coverage as part of validation; this may require a separately trained partial-information model later. Do not merely drop feature checks to publish a number. Commercial data reuse permissions must be established before operating a feed; this local factual evidence audit does not establish those rights.

## Modeling and validation limits

- Huber regression is a candidate estimator, not evidence that its coefficients are valid for this market. It can still fail with omitted variables, selection bias, collinearity or regime changes.
- Minimum 60 observations per fitted model, at least 80 in the outer training block, at least 10 scored tuning cases with 80% tuning coverage, and 20 scored calibration observations for interval estimation are initial engineering floors. Parameter-count checks can require more. These are not a guarantee of sufficient statistical power or a declaration of industry compliance.
- Initial comparable limits: 25 km, 1,095 days, at most a factor-of-two model adjustment. These policy values must be examined against actual coverage/error; they are not learned premiums. Market extrapolation over time is bounded by the age window but can still fail in a changing market.
- Calibration is a finite-sample absolute log-error order statistic at nominal 90% coverage. Temporal market drift violates exchangeability, so measured test coverage must accompany any reported interval; no unconditional 90% guarantee is claimed.
- No automated production promotion is implemented. The output retains `marketAccuracyEstablished: false` even when research evaluation succeeds; independent review, representative pilot results and declared acceptance tolerances remain required.
- DCF scenarios require sourced project cash flows and return assumptions. The implementation does not invent construction costs or completed-home proceeds and has not been validated against realized project profits.

## Method references

- [IAAO, Standard on Automated Valuation Models, Appendix E](https://www.iaao.org/media/standards/Standard_on_Automated_Valuation_Models.pdf): direct-market adjustment models and comparable selection. The implementation is informed by this framework, not certified against the standard.
- [scikit-learn HuberRegressor](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.HuberRegressor.html): robust regularized regression.
- [Federal Reserve interagency evaluation guidance, Appendix B](https://www.federalreserve.gov/frrs/guidance/interagency-appraisal-and-evaluation-guidelines.htm): validation against actual sale outcomes and appropriate trade areas. This is methodological context, not a statement that Cornerpin is a compliant lending appraisal.

## Capability checklist

- [x] Implement multi-attribute estimation, sourced adjustment explanations and support checks.
- [x] Implement and test chronological tuning/calibration/test and subdivision robustness paths.
- [x] Implement timed residual-development cross-check with double-counting guards.
- [x] Run the actual model's input qualification against recovered public candidates and preserve results.
- [ ] Assemble sufficient qualified pilot transactions: attempted; unresolved public closing-price and historical-feature coverage.
- [ ] Calibrate and demonstrate pilot accuracy/interval coverage: blocked by that dataset dependency.
- [ ] Deploy a validated automatic market estimate: blocked by calibration/validation, not replaced by a scenario.

Existing dossier, evidence, permit and UI work is retained. This increment changes research/model code and reports only.

# Cornerpin land valuation model v1

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

## Data contract

Top-level fields: `submarket`, `trainEnd`, `calibrationEnd`, `asOf`, `records`.

Each transaction: unique `id`, stable `propertyKey`, optional `parcelIds` and `subdivision`, `submarket`, `propertyType: vacant_residential_land`, `valuationDate`, `saleDate`, `availableAt`, actual numeric `price`, `priceType: closed_price`, `priceVerified: true`, source URL, `transactionConditions: ordinary_market`, and `features`.

Each feature stores `{value, source, effectiveAt, availableAt}`. Dates are ISO calendar dates. `effectiveAt` means evidence establishes the feature applied at that historical date; it is not simply today's retrieval date. Estimated GIS-derived features can be supplied when their method, source and historical applicability are documented; the program does not claim they are survey measurements. A missing effective date stays unresolved. Public replay additionally requires that the feature evidence was available by the valuation date; retrospective reconstruction does not make that claim.

Required numeric features: `grossAcres > 0`, `permittedUnits > 0`, `0 < buildableFraction <= 1`, `slopePercent >= 0`, latitude and longitude. Required categories: `water`, `sewer`, `access`, `entitlement`, `zoningClass`, `viewClass`, `hazardClass`. A planned unit count is not an approved entitlement. Agricultural acreage and speculative development tracts must not silently become finished residential lots. Current attributes must not describe a historical vacant lot after a house was built.

The initial implementation deliberately abstains for missing material attributes. Assess the resulting coverage as part of validation; this may require a separately trained partial-information model later. Do not merely drop feature checks to publish a number. Commercial data reuse permissions must be established before operating a feed; this local factual evidence audit does not establish those rights.

## Modeling and validation limits

- Huber regression is a candidate estimator, not evidence that its coefficients are valid for this market. It can still fail with omitted variables, selection bias, collinearity or regime changes.
- Minimum 60 observations per fitted model, at least 80 in the outer training block, at least 10 scored tuning cases with 80% tuning coverage, and 20 scored calibration observations are initial engineering floors. Parameter-count checks can require more. These are not a guarantee of sufficient statistical power or a declaration of industry compliance.
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

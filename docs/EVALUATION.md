# Evaluation and known limits

Updated October 1, 2026. Current product rules: housing-fit-v3, inbound-priority-v2 and deterministic writer v20. [Behavior and assumptions](SCORING_AND_OUTREACH.md).

## Latest portfolio-extraction release

The deployed source imported into this repository was checked with:

- **53/53 focused checks:** portfolio extraction, saved-evidence refresh and company-page research.
- **105/105 Worker integration checks:** after updating the cache-version fixture.
- **30/30 frozen golden lead cases:** no changed fit, priority or email snapshots.
- A successful production build.

The initial broad run had 673 passes out of 676 checks. One failure was the stale cache-version fixture, corrected and covered by the 105-check integration rerun. Two property-display assertions also fail on the prior source revision: “compact property uses the pulled address and does not substitute a nearby panorama” and “market context requires the same matched tract and current usable data.” The full suite is not represented as green. The focused count predates later documentation-only changes.

## Reproduce

```sh
pnpm eval:golden
pnpm build
pnpm test
```

Build before integration tests: they require `dist/server/index.js`. Golden reports are generated under `.quality-reports/`. Review differences before intentionally accepting a new baseline with `pnpm eval:approve`.

## What these checks establish

Fixtures test deterministic behavior, source grounding, regressions and request boundaries. They do not establish current live retrieval coverage, sales effectiveness or independently reviewed email quality. Public sources can be incomplete, blocked or outdated; missing evidence remains possible.

The [October 1 research-recovery report](RESEARCH_RECOVERY.md) contains dated live observations. [Historical evaluations](archive/EVALUATION.md) and [benchmark records](archive/HOLDOUT_30.md) preserve their original versions and denominators. Development rechecks are not untouched holdouts. No new paid or live research was run for this repository cleanup.

Independent SDR review, a measured time-saving/conversion study and the narrated interview video remain human deliverables.

// GreenPipe-style carbon accounting (concept + methodology ported from GreenPipe,
// Green Agent Prize — see ACKNOWLEDGMENTS.md). Uses the same pieces GreenPipe uses:
// a curated grid carbon-intensity dataset (ENTSO-E / EIA eGRID / IEA figures),
// Cloud Carbon Footprint energy estimation, and the ISO/IEC 21031 SCI formula
// SCI = (E × I) per unit of work.

// Grid carbon intensity, gCO2eq/kWh (annual averages, GreenPipe's sources)
const REGIONS = {
  "eu-north-1 (Stockholm)": 13,
  "eu-west-1 (Ireland)": 278,
  "eu-central-1 (Frankfurt)": 311,
  "us-west-2 (Oregon)": 118,
  "us-east-1 (Virginia)": 367,
  "ca-central-1 (Canada)": 120,
  "ap-south-1 (Mumbai)": 708,
  "ap-southeast-2 (Sydney)": 512,
  "ap-northeast-1 (Tokyo)": 465,
  "sa-east-1 (São Paulo)": 76,
};
const DEFAULT_REGION = "us-east-1 (Virginia)"; // GreenPipe's documented default
const GREENEST = "eu-north-1 (Stockholm)";

// Cloud Carbon Footprint energy model constants
const CPU_WATTS = 12; // avg wattage of a shared vCPU at 50% utilization
const PUE = 1.2; // GitLab shared-runner power usage effectiveness
const KB_PER_CPU_SECOND = 40; // rough work→CPU-time proxy for a commit's bytes

// Estimate energy (kWh) for a unit of "work" — we proxy work by bytes changed,
// the way GreenPipe proxies it by job seconds.
function energyKwh(bytes) {
  const cpuSeconds = Math.max(1, bytes / 1024 / KB_PER_CPU_SECOND);
  const wattHours = (CPU_WATTS * PUE * cpuSeconds) / 3600;
  return wattHours / 1000;
}

// SCI carbon for a byte count at a given region's intensity
function carbonForBytes(bytes, region = DEFAULT_REGION) {
  const kwh = energyKwh(bytes);
  const intensity = REGIONS[region] ?? REGIONS[DEFAULT_REGION];
  return kwh * intensity; // gCO2eq
}

// Per-commit report: grams here vs the greenest region + % saving
function commitCarbon(commit, region = DEFAULT_REGION) {
  const bytes = (commit.changes || []).reduce(
    (a, c) => a + ((c.additions || 0) + (c.deletions || 0)) * 60, // ~60 bytes/line
    0
  );
  const here = carbonForBytes(bytes, region);
  const greenest = carbonForBytes(bytes, GREENEST);
  const savingPct = here > 0 ? Math.round(((here - greenest) / here) * 100) : 0;
  return {
    grams: Math.round(here * 1000) / 1000,
    region,
    greenestRegion: GREENEST,
    greenestGrams: Math.round(greenest * 1000) / 1000,
    savingPct,
  };
}

// Repo-level rollup across many commits
function repoCarbon(commits, region = DEFAULT_REGION) {
  let totalGrams = 0;
  let greenestGrams = 0;
  for (const c of commits) {
    const r = commitCarbon(c, region);
    totalGrams += r.grams;
    greenestGrams += r.greenestGrams;
  }
  const savingPct = totalGrams > 0 ? Math.round(((totalGrams - greenestGrams) / totalGrams) * 100) : 0;
  return {
    totalGrams: Math.round(totalGrams * 1000) / 1000,
    region,
    greenestRegion: GREENEST,
    greenestGrams: Math.round(greenestGrams * 1000) / 1000,
    savingPct,
    // whole ranked table, so the UI can show the 88x spread GreenPipe found
    regions: Object.entries(REGIONS)
      .map(([name, intensity]) => ({ name, intensity }))
      .sort((a, b) => a.intensity - b.intensity),
  };
}

module.exports = { REGIONS, DEFAULT_REGION, GREENEST, commitCarbon, repoCarbon };

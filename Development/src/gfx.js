// Presentation quality tiers and feature gates for the graphics overhaul.
// One config object controls every new effect (see docs/graphics-audit.md).
//
//   ?gfx=off     original presentation, all overhaul effects disabled (A/B)
//   ?gfx=low     lightmap only, no bloom, sparse ambience, no new effects
//   ?gfx=medium  bloom + chromatic hit pulse + foreground parallax
//   ?gfx=high    everything, including film grain (default)
//
// The chosen tier persists in localStorage; the FX autoscaler still drops
// work under sustained load but never climbs above the tier's cap.

const TIERS = { off: 0, low: 1, medium: 2, high: 3 };

export const gfx = {
  tier: TIERS.high,

  init() {
    let pick = null;
    try {
      const q = new URLSearchParams(location.search).get('gfx');
      const saved = localStorage.getItem('crow-gfx');
      pick = q ?? saved;
      if (q && q in TIERS) localStorage.setItem('crow-gfx', q);
    } catch { /* storage unavailable: default tier */ }
    if (pick && pick in TIERS) this.tier = TIERS[pick];
  },

  // new-effect gates
  get grain() { return this.tier >= 3; },
  get chroma() { return this.tier >= 2; },
  get foreground() { return this.tier >= 2; },

  // density multiplier for drifting biome ambience particles
  get ambientScale() {
    return this.tier >= 3 ? 1 : this.tier === 2 ? 0.6 : this.tier === 1 ? 0.3 : 1;
  },

  // ceiling for the FX autoscaler (2 full stack, 1 lightmap only, 0 bare)
  get fxCap() { return this.tier === 1 ? 1 : 2; },
};

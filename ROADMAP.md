# 🍈 Fruit — roadmap

North star: **the space of possible fruit**, explorable in real time. Accurate and
educational, but a game-like toy — not a museum diorama. If a slider doesn't teach
you something about botany while you drag it, it's the wrong slider.

Live at [fruit.exe.xyz](https://fruit.exe.xyz); pushing to `main` deploys.

## Phase 1 — the morphospace *(done)*

- [x] ✅ **Body of revolution** with superellipse end-caps: sphere → pear → cucumber
      → chilli, plus neck and bend, in five numbers.
- [x] ✅ **Ribs / lobes.** Angular modulation with a sharpening exponent (carambola's
      star) and a distal ramp that splits the body into fingers (Buddha's hand).
- [x] ✅ **One unified surface feature** — `sharp`/`sides`/`elong`/`tilt`/`curve`/
      `latGrad` carries durian spine ↔ cherimoya areole ↔ pineapple fruitlet ↔ salak
      scale ↔ rambutan hair.
- [x] ✅ **Three arrangements**, because they are genuinely different generators:
      golden-angle spiral (organ primordia), blue-noise scatter (rind outgrowths),
      longitudinal rows (following ribs). Equal-**area** spacing in all three.
- [x] ✅ **Rind noise** — warts and netting, independent of the discrete features.
- [x] ✅ **Seven seed archetypes**, including `follow` (one seed under each areole —
      surface and interior sharing one point set, as an aggregate fruit does).
- [x] ✅ **Translucent flesh + cutaway plane**, so the interior is actually visible.
- [x] ✅ **16 presets** spanning the space; blend slider between any two.
- [x] ✅ **Shareable URL** (<100 chars), smoke tests, gallery renders, CI/CD.

## Phase 2 — make it feel alive

- [ ] **Ripeness slider.** One knob driving colour, translucency, and a little
      softening of the silhouette — green→ripe→overripe. Fruit *change*, and right
      now every one is frozen at picking. Probably the single highest-value slider
      left.
- [ ] **Real Voronoi plates.** Lychee tubercles and jackfruit's hexagons sit on
      polygonal plates with visible sutures between them, and a pineapple's fruitlet
      is a hexagon *because* it's a Voronoi cell of the phyllotactic point set. We
      approximate with instanced hexagons; computing the actual spherical Voronoi of
      the scatter would make the tiling exact and give the sutures for free.
- [ ] **Crack networks** for cantaloupe netting and osage orange's brain-folds — a
      hierarchical/recursive craquelure rather than ridged noise. Reaction-diffusion
      would nail the osage orange (and the fish rig already has an RD sim to steal).
- [ ] **True fingering** for Buddha's hand: N tapered tubes radiating from a common
      base with a splay parameter, instead of ribs that nearly pinch through. Real
      cultivars run from "closed hand" to "open hand" — that's a slider.
- [ ] **Soft-body wobble** on a gentle drop/settle. A rambutan's hairs should move.

## Phase 3 — the fun part

- [ ] **Breeding.** `breed(a, b, rng)` — per-gene pick-from-either-parent plus a
      bounded mutation. The tree walker already exists (`lerpTree`). "Cross a durian
      with a dragon fruit" is the demo that sells the whole project.
- [ ] **Gene schema.** Per-leaf `{min, max, mutable, label}` metadata so bred and
      mutated fruit stay viable (clamp to plausible ranges) and the GUI bounds stop
      being hand-typed in `main.js`.
- [ ] **Mutation slider + "spawn a variant"** — a small crate of offspring around
      the current fruit, click one to make it the new parent. Evolution by taste.
- [ ] **A gallery of shared fruit.** Links already round-trip; collect the good ones.
- [ ] **Impossible fruit.** The presets are the anchors, not the point. Turn every
      knob past its botanical range and see what's out there.

## Known approximations

Honest list, so nobody mistakes a fake for a fact:

- **Buddha's hand** is really carpels that failed to fuse; we fake it with deep,
  distally-ramped ribs.
- **Cantaloupe netting** is really a suberised crack network (the rind cracks under
  the expanding flesh and the cracks fill with cork); we fake it with ridged noise.
- **Salak's scales** overlap correctly but are a single instanced plate, not true
  imbricate lamellae that tuck under one another.
- **`scatter`** is a heavily jittered golden angle, not a real blue-noise / Poisson-
  disc relaxation. It decorrelates the rows and resists clumping, but a durian's
  spines are not *quite* this evenly packed.
- **Feature count** is capped at 800 in the GUI. A real soursop has 300–800 carpel
  tips and a lychee 200–400 tubercles, so that's enough — but a fig's syconium has
  up to 7000 florets, and that would need a different approach entirely.

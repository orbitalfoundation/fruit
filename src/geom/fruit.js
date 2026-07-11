import * as THREE from 'three';
import { makeSurface, buildBodyGeometry } from './surface.js';
import { featurePoints, buildFeatures } from './features.js';
import { buildSeeds, buildCore } from './seeds.js';
import { buildCrown, buildStem, buildCalyx } from './parts.js';

/**
 * Assemble one fruit from its parameter tree.
 *
 * The scatter point set is computed ONCE here and handed to both the features and
 * the seeds, because in an aggregate fruit they are the same set — a cherimoya's
 * seed sits under its areole because they're the same carpel. Building them
 * separately would have quietly broken that.
 */
export class Fruit extends THREE.Group {
  constructor(params, materials) {
    super();
    this.params = params;
    this.materials = materials;

    const surface = makeSurface(params);
    this.surface = surface;

    const pts = featurePoints(params, surface);
    this.featurePoints = pts;

    this.body = new THREE.Mesh(buildBodyGeometry(params, surface), materials.skin);
    this.add(this.body);

    this.features = buildFeatures(params, surface, materials.feature, pts);
    if (this.features) this.add(this.features);

    this.seeds = buildSeeds(params, surface, materials.seed, pts);
    if (this.seeds) this.add(this.seeds);

    this.core = buildCore(params, surface, materials.core);
    if (this.core) this.add(this.core);

    this.crown = buildCrown(params, surface, materials.leaf);
    if (this.crown) this.add(this.crown);

    this.stem = buildStem(params, surface, materials.stem);
    if (this.stem) this.add(this.stem);

    this.calyx = buildCalyx(params, surface, materials.leaf);
    if (this.calyx) this.add(this.calyx);
  }

  /** The radius that frames the whole thing, features and crown included. */
  get span() {
    const f = this.params.features;
    const featureReach = f.count > 0 ? f.height * this.surface.maxR : 0;
    const crownReach = this.params.crown.leaves > 0
      ? this.params.crown.height * this.surface.height : 0;
    return Math.max(
      this.surface.maxR + featureReach,
      this.surface.height * 0.5 + Math.max(crownReach, featureReach)
    ) * 2;
  }

  /**
   * Half the fruit's depth along Z — what the cutaway plane has to travel to reach
   * the flesh. NOT the same as half its height: a snake gourd is 90 cm long and
   * 3 cm thick, so a cut calibrated to its length would never touch it.
   */
  get zHalf() {
    const bb = this.body.geometry.boundingBox
      || (this.body.geometry.computeBoundingBox(), this.body.geometry.boundingBox);
    const f = this.params.features;
    const reach = f.count > 0 ? f.height * this.surface.maxR : 0;
    return Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z)) + reach;
  }

  /** Counts for the HUD — the numbers a curious person actually wants. */
  get stats() {
    return {
      tris: this.body.geometry.index.count / 3,
      features: this.features ? this.features.count : 0,
      seeds: this.seeds ? this.seeds.count : 0,
    };
  }

  dispose() {
    this.body.geometry.dispose();
    for (const m of [this.features, this.seeds, this.core, this.crown, this.stem, this.calyx]) {
      if (m) m.geometry.dispose();
    }
  }
}

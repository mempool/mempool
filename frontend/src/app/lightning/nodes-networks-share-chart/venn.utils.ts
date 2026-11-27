export interface VennLabel {
  x: number;
  y: number;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

export interface VennLayout {
  r1: number;
  r2: number;
  x1: number;
  x2: number;
  cy: number;
  onlyAPath: string | null;
  onlyBPath: string | null;
  bothPath: string | null;
  labels: { onlyA: VennLabel; onlyB: VennLabel; both: VennLabel };
}

/**
 * Area of the intersection of two circles of radius r1 and r2 whose centers are d apart
 */
export function lensArea(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) {
    return 0;
  }
  if (d <= Math.abs(r1 - r2)) {
    return Math.PI * Math.min(r1, r2) ** 2;
  }
  const a1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const a2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const k =
    0.5 *
    Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  return a1 + a2 - k;
}

/**
 * Distance between the centers for which the circles overlap by `overlap`.
 * The overlap shrinks as the centers move apart, so bisect on the distance.
 */
export function solveDistance(r1: number, r2: number, overlap: number): number {
  if (overlap <= 0) {
    return r1 + r2;
  }
  if (overlap >= Math.PI * Math.min(r1, r2) ** 2) {
    // The smaller set is fully inside the larger one
    return Math.abs(r1 - r2);
  }
  let lo = Math.abs(r1 - r2);
  let hi = r1 + r2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (lensArea(r1, r2, mid) > overlap) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Area-proportional two-set Venn diagram fitted in a box. `a` and `b` are the full
 * set sizes (each including the intersection), `ab` the intersection.
 * Returns svg paths for the three disjoint regions and where to put their labels.
 */
export function computeVennLayout(
  box: { x: number; y: number; width: number; height: number },
  a: number,
  b: number,
  ab: number,
  options: { sideSpace: number; minLabelWidth: number }
): VennLayout {
  let r1 = Math.sqrt(Math.max(a, 0) / Math.PI);
  let r2 = Math.sqrt(Math.max(b, 0) / Math.PI);
  const d0 = solveDistance(r1, r2, Math.min(ab, a, b));
  // Decided before scaling: solveDistance() returns |r1 - r2| and r1 + r2 exactly for these
  // cases, and comparing the scaled values could flip them through rounding
  const nested = r1 > 0 && r2 > 0 && d0 <= Math.abs(r1 - r2);
  const apart = d0 >= r1 + r2;

  // Scale the pair of circles to the box, keeping room on both sides for
  // the labels of regions too narrow to hold them
  const innerW = Math.max(box.width - 2 * options.sideSpace, 0);
  const left = Math.min(-r1, d0 - r2);
  const right = Math.max(r1, d0 + r2);
  const top = Math.max(r1, r2);
  const scale = Math.max(
    Math.min(
      innerW / Math.max(right - left, 1e-9),
      box.height / Math.max(2 * top, 1e-9)
    ),
    0
  );
  r1 *= scale;
  r2 *= scale;
  const d = d0 * scale;
  const cy = box.y + box.height / 2;
  const x1 =
    box.x +
    options.sideSpace +
    (innerW - (right - left) * scale) / 2 -
    left * scale;
  const x2 = x1 + d;

  const circle = (x: number, r: number): string =>
    `M ${x - r} ${cy} A ${r} ${r} 0 1 1 ${x + r} ${cy} A ${r} ${r} 0 1 1 ${
      x - r
    } ${cy} Z`;

  let onlyAPath = r1 > 0 ? circle(x1, r1) : null;
  let onlyBPath = r2 > 0 ? circle(x2, r2) : null;
  let bothPath = null;
  let bothTop = cy;

  if (r1 > 0 && r2 > 0 && !nested && !apart) {
    // Circles intersect at (x1 + p, cy ± h)
    const p = (d * d + r1 * r1 - r2 * r2) / (2 * d);
    const h = Math.sqrt(Math.max(r1 * r1 - p * p, 0));
    bothTop = cy - h;
    const upper = `${x1 + p} ${cy - h}`;
    const lower = `${x1 + p} ${cy + h}`;
    const bigInner1 = p < 0 ? 1 : 0; // circle 1 arc inside circle 2 spans more than half
    const bigInner2 = d - p < 0 ? 1 : 0; // circle 2 arc inside circle 1 spans more than half
    bothPath = `M ${upper} A ${r1} ${r1} 0 ${bigInner1} 1 ${lower} A ${r2} ${r2} 0 ${bigInner2} 1 ${upper} Z`;
    onlyAPath = `M ${upper} A ${r1} ${r1} 0 ${
      1 - bigInner1
    } 0 ${lower} A ${r2} ${r2} 0 ${bigInner2} 1 ${upper} Z`;
    onlyBPath = `M ${upper} A ${r2} ${r2} 0 ${
      1 - bigInner2
    } 1 ${lower} A ${r1} ${r1} 0 ${bigInner1} 0 ${upper} Z`;
  } else if (nested) {
    // One set contains the other: the smaller circle is the intersection, and the larger
    // one keeps only the ring around it (a hole wound the other way, so nonzero fill skips it)
    const hole = (x: number, r: number): string =>
      `M ${x - r} ${cy} A ${r} ${r} 0 1 0 ${x + r} ${cy} A ${r} ${r} 0 1 0 ${
        x - r
      } ${cy} Z`;
    bothPath = r1 < r2 ? onlyAPath : onlyBPath;
    bothTop = cy - Math.min(r1, r2);
    onlyAPath = r1 > r2 ? `${onlyAPath} ${hole(x2, r2)}` : null;
    onlyBPath = r2 > r1 ? `${onlyBPath} ${hole(x1, r1)}` : null;
  }

  const bothLeft = Math.max(x2 - r2, x1 - r1);
  const bothRight = Math.min(x1 + r1, x2 + r2);
  const onlyAWidth = bothPath ? bothLeft - (x1 - r1) : 2 * r1;
  const onlyBWidth = bothPath ? x2 + r2 - bothRight : 2 * r2;
  const gap = 8;

  return {
    r1,
    r2,
    x1,
    x2,
    cy,
    onlyAPath,
    onlyBPath,
    bothPath,
    labels: {
      onlyA:
        onlyAWidth < options.minLabelWidth
          ? { x: x1 - r1 - gap, y: cy, align: 'right' }
          : { x: bothPath ? (x1 - r1 + bothLeft) / 2 : x1, y: cy },
      onlyB:
        onlyBWidth < options.minLabelWidth
          ? { x: x2 + r2 + gap, y: cy, align: 'left' }
          : { x: bothPath ? (bothRight + x2 + r2) / 2 : x2, y: cy },
      both:
        bothRight - bothLeft < options.minLabelWidth
          ? {
              x: (bothLeft + bothRight) / 2,
              y: bothTop - gap,
              verticalAlign: 'bottom',
            }
          : { x: (bothLeft + bothRight) / 2, y: cy },
    },
  };
}

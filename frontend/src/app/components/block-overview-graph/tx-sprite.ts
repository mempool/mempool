import { FastVertexArray } from '@components/block-overview-graph/fast-vertex-array';
import { InterpolatedAttribute, Attributes, OptionalAttributes, SpriteUpdateParams, Update } from '@components/block-overview-graph/sprite-types';

const attribKeys = ['a', 'b', 't', 'v'];
const updateKeys = ['x', 'y', 's', 'r', 'g', 'b', 'a'];

export default class TxSprite {
  static vertexSize = 30;
  static vertexCount = 6;
  static dataSize: number = (30 * 6);

  vertexArray: FastVertexArray;
  vertexPointer: number;
  vertexData: number[];
  updateMap: Update;
  attributes: Attributes;
  tempAttributes: OptionalAttributes;


  constructor(params: SpriteUpdateParams, vertexArray: FastVertexArray) {
    const offsetTime = params.start;
    this.vertexArray = vertexArray;
    this.vertexData = Array(VI.length).fill(0);
    this.updateMap = {
      x: 0, y: 0, s: 0, r: 0, g: 0, b: 0, a: 0
    };

    this.attributes = {
      x: { a: params.x, b: params.x, t: offsetTime, v: 0, d: 0 },
      y: { a: params.y, b: params.y, t: offsetTime, v: 0, d: 0 },
      s: { a: params.s, b: params.s, t: offsetTime, v: 0, d: 0 },
      r: { a: params.r, b: params.r, t: offsetTime, v: 0, d: 0 },
      g: { a: params.g, b: params.g, t: offsetTime, v: 0, d: 0 },
      b: { a: params.b, b: params.b, t: offsetTime, v: 0, d: 0 },
      a: { a: params.a, b: params.a, t: offsetTime, v: 0, d: 0 },
    };

    // Used to temporarily modify the sprite, so that the base view can be resumed later
    this.tempAttributes = null;

    this.vertexPointer = this.vertexArray.insert(this);

    this.compile();
  }

  private interpolateAttributes(updateMap: Update, attributes: OptionalAttributes, offsetTime: DOMHighResTimeStamp, v: number,
                                duration: number, minDuration: number, adjust: boolean): void {
    for (const key of Object.keys(updateMap)) {
      // for each non-null attribute:
      if (updateMap[key] != null) {
        // calculate current interpolated value, and set as 'from'
        interpolateAttributeStart(attributes[key], offsetTime);
        // update start time
        attributes[key].t = offsetTime;

        if (!adjust || (duration && attributes[key].d === 0)) {
          attributes[key].v = v;
          attributes[key].d = duration;
        } else if (minDuration > attributes[key].d) {
          // enforce minimum transition duration
          attributes[key].v = 1 / minDuration;
          attributes[key].d = minDuration;
        }
        // set 'to' to target value
        attributes[key].b = updateMap[key];
      }
    }
  }

  /*
    params:
      x, y, s: position & size of the sprite
      r, g, b, a: color & opacity
      start: performance.now() timestamp, when to start the transition
      duration: of the tweening animation
      adjust: if true, alter the target value of any conflicting transitions without changing the duration
      minDuration: minimum remaining transition duration when adjust = true
      temp: if true, this update is only temporary (can be reversed with 'resume')
  */
  update(params: SpriteUpdateParams): void {
    const offsetTime = params.start || performance.now();
    const v = params.duration > 0 ? (1 / params.duration) : 0;

    updateKeys.forEach(key => {
      this.updateMap[key] = params[key];
    });

    const isModified = !!this.tempAttributes;
    if (!params.temp) {
      this.interpolateAttributes(this.updateMap, this.attributes, offsetTime, v, params.duration, params.minDuration, params.adjust);
    } else {
      if (!isModified) { // set up tempAttributes
        this.tempAttributes = {};
        for (const key of Object.keys(this.updateMap)) {
          if (this.updateMap[key] != null) {
            this.tempAttributes[key] = { ...this.attributes[key] };
          }
        }
      }
      this.interpolateAttributes(this.updateMap, this.tempAttributes, offsetTime, v, params.duration, params.minDuration, params.adjust);
    }

    this.compile();
  }

  // Transition back from modified state back to base attributes
  resume(duration: number, start: DOMHighResTimeStamp = performance.now()): void {
    // If not in modified state, there's nothing to do
    if (!this.tempAttributes) {
      return;
    }

    const offsetTime = start;
    const v = duration > 0 ? (1 / duration) : 0;

    for (const key of Object.keys(this.tempAttributes)) {
      // If this base attribute is static (fixed or post-transition), transition smoothly back
      if (this.attributes[key].v === 0 || (this.attributes[key].t + this.attributes[key].d) <= start) {
        // calculate current interpolated value, and set as 'from'
        interpolateAttributeStart(this.tempAttributes[key], offsetTime);
        this.attributes[key].a = this.tempAttributes[key].a;
        this.attributes[key].t = offsetTime;
        this.attributes[key].v = v;
        this.attributes[key].d = duration;
      }
    }

    this.tempAttributes = null;

    this.compile();
  }

  // Write current state into the graphics vertex array for rendering
  compile(): void {
    let attributes = this.attributes;
    if (this.tempAttributes) {
      attributes = {
        ...this.attributes,
        ...this.tempAttributes
      };
    }
    const size = attributes.s;

    // update vertex data in place
    // ugly, but avoids overhead of allocating large temporary arrays
    const vertexStride = VI.length + 2;
    for (let vertex = 0; vertex < 6; vertex++) {
      this.vertexData[vertex * vertexStride] = vertexOffsetFactors[vertex][0];
      this.vertexData[(vertex * vertexStride) + 1] = vertexOffsetFactors[vertex][1];
      for (let step = 0; step < VI.length; step++) {
        // components of each field in the vertex array are defined by an entry in VI:
        // VI[i].a is the attribute, VI[i].f is the inner field, VI[i].offA and VI[i].offB are offset factors
        this.vertexData[(vertex * vertexStride) + step + 2] = attributes[VI[step].a][VI[step].f];
      }
    }

    this.vertexArray.setData(this.vertexPointer, this.vertexData);
  }

  moveVertexPointer(index: number): void {
    this.vertexPointer = index;
  }

  destroy(): void {
    this.vertexArray.remove(this.vertexPointer);
    this.vertexPointer = null;
  }
}

// expects 0 <= x <= 1
function smootherstep(x: number): number {
  const ix = 1 - x;
  x = x * x;
  return x / (x + ix * ix);
}

function interpolateAttributeStart(attribute: InterpolatedAttribute, start: DOMHighResTimeStamp): void {
  if (attribute.v === 0 || (attribute.t + attribute.d) <= start) {
    // transition finished, next transition starts from current end state
    // (clamp to 1)
    attribute.a = attribute.b;
    attribute.v = 0;
    attribute.d = 0;
  } else if (attribute.t > start) {
    // transition not started
    // (clamp to 0)
  } else {
    // transition in progress
    // (interpolate)
    const progress = (start - attribute.t);
    const delta = smootherstep(progress / attribute.d);
    attribute.a = attribute.a + (delta * (attribute.b - attribute.a));
    attribute.d = attribute.d - progress;
    attribute.v = 1 / attribute.d;
  }
}

const vertexOffsetFactors = [
  [0, 0],
  [1, 1],
  [1, 0],
  [0, 0],
  [1, 1],
  [0, 1]
];

const VI = [];
updateKeys.forEach((attribute, aIndex) => {
  attribKeys.forEach(field => {
    VI.push({
      a: attribute,
      f: field
    });
  });
});

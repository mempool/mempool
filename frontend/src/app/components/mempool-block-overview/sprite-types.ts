export type Position = {
  x: number,
  y: number,
};

export type Square = Position & {
  s?: number
};

export type Color = {
  r: number,
  g: number,
  b: number,
  a: number,
};

export type InterpolatedAttribute = {
  a: number,
  b: number,
  t: number,
  v: number,
  d: number
};

export type Update = Position & { s: number } & Color;

export type Attributes = {
  x: InterpolatedAttribute,
  y: InterpolatedAttribute,
  s: InterpolatedAttribute,
  r: InterpolatedAttribute,
  g: InterpolatedAttribute,
  b: InterpolatedAttribute,
  a: InterpolatedAttribute
};

export type OptionalAttributes = {
  x?: InterpolatedAttribute,
  y?: InterpolatedAttribute,
  s?: InterpolatedAttribute,
  r?: InterpolatedAttribute,
  g?: InterpolatedAttribute,
  b?: InterpolatedAttribute,
  a?: InterpolatedAttribute
};

export type SpriteUpdateParams = {
  x?: number,
  y?: number,
  s?: number,
  r?: number,
  g?: number,
  b?: number,
  a?: number
  start?: DOMHighResTimeStamp,
  duration?: number,
  minDuration?: number,
  adjust?: boolean,
  temp?: boolean
};

export type ViewUpdateParams = {
  display: {
    position?: Square,
    color?: Color,
  },
  start?: number,
  duration?: number,
  minDuration?: number,
  delay?: number,
  jitter?: number,
  state?: string,
  adjust?: boolean
};

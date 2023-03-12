class GameObject {
  constructor(id, options) {
    this.id = id;
    this.w = options.w || 6;
    this.h = options.h || 6;
    this.x = options.x;
    this.y = options.y;
    this.vx = options.vx || 0;
    this.vy = options.vy || 0;
  }

  update = () => {};

  getBoundingBox = () => ({
    id: this.id,
    x: this.x,
    y: this.y,
    w: this.w,
    h: this.h
  });

  getAnchor = () => ({
    x: this.getBoundingBox().x,
    y: this.getBoundingBox().y + this.getBoundingBox().h - 1,
    w: this.getBoundingBox().w,
    h: 1
  });

  getCenter = () => ({
    x: Math.round(this.x + this.w / 2),
    y: Math.round(this.y + this.h / 2)
  });

  getClass = () => this.constructor.name;

  select = () => {
    if (window.DEBUG) console.log(this);
  };
  unselect = () => {};

  _toJSON = () => {
    const json = Object.keys(this)
    .filter(key => /string|number|boolean/.test(typeof this[key]))
    .reduce((obj, key) => {
      obj[key] = this[key];
      return obj;
    }, {});
    json.class = this.constructor.name;
    return json;
  };
}

export default GameObject;
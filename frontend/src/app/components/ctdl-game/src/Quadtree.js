import { flatten, unique } from './arrayUtils';
import { intersects } from './geometryUtils';

export const Boundary = function ({ id, x, y, w, h }) {
  this.id = id;
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
};

export const QuadTree = function (boundary, capacity, level) {
  this.boundary = boundary,
  this.capacity =  capacity || 20,
  this.subs = [],
  this.objects = [];
  this.level = level || 0;

  this.insert = obj => {
    if (!intersects(this.boundary, obj.getBoundingBox ? obj.getBoundingBox() : obj)) {
      return false;
    }

    if (this.subs.length === 0 && this.objects.length < this.capacity) {
      this.objects.push(obj);
      return true;
    }

    if (this.subs.length === 0 && this.level < 10) {
      this.subdivide();

      // redistribute objects in newly created subs
      this.objects.forEach(o => {
        this.subs.forEach(sub => {
          return sub.insert(o, true);
        });
      });
      this.objects = [];
    }

    return this.subs.forEach(sub => {
      return sub.insert(obj, true);
    });
  };
  this.subdivide = () => {
    // hint: make boundaries fuzzy to catch potential objects right on the border
    const subBoundary = {
      w: this.boundary.w / 2 + (Math.random() - .5),
      h: this.boundary.h / 2 + (Math.random() - .5)
    };
    this.subs = [
      new QuadTree(
        new Boundary({
          x: this.boundary.x,
          y: this.boundary.y,
          w: subBoundary.w,
          h: subBoundary.h
        }),
        this.capacity,
        this.level + 1
      ),
      new QuadTree(
        new Boundary({
          x: this.boundary.x + subBoundary.w,
          y: this.boundary.y,
          w: subBoundary.w,
          h: subBoundary.h
        }),
        this.capacity,
        this.level + 1
      ),
      new QuadTree(
        new Boundary({
          x: this.boundary.x + subBoundary.w,
          y: this.boundary.y + subBoundary.h,
          w: subBoundary.w,
          h: subBoundary.h
        }),
        this.capacity,
        this.level + 1
      ),
      new QuadTree(
        new Boundary({
          x: this.boundary.x,
          y: this.boundary.y + subBoundary.h,
          w: subBoundary.w,
          h: subBoundary.h
        }),
        this.capacity,
        this.level + 1
      ),
    ];
  };
  this.query = range => {
    let result = [];

    range = new Boundary(range);
    if (!intersects(this.boundary, range)) {
      return result;
    }

    result = this.objects;

    if (this.subs.length > 0) {
      result = result
        .concat(this.subs.map(sub => sub.query(range)))
        .reduce(flatten, []);
    }

    if (range.id) {
      return result
        .filter(obj => obj.id !== range.id)
        .filter(unique('id'));
    }
    return result
      .filter(unique('id'));

  };
  this.show = context => {
    context.fillStyle = 'transparent';
    context.strokeStyle = `hsl(${Math.floor(Math.random() * 360)}, 100%, 70%)`;
    context.lineWidth = 1;
    context.strokeRect(this.boundary.x - .5, this.boundary.y - .5, this.boundary.w, this.boundary.h);
    this.subs.forEach(sub => sub.show(context));
    this.objects
      .map(obj => obj.getBoundingBox ? obj.getBoundingBox() : obj)
      .forEach(box => {
        context.strokeRect(box.x - .5, box.y - .5, box.w, box.h);
      });
  };
  this.clear = () => {
    this.objects = [];
    this.subs = [];
  };
};

export default QuadTree;
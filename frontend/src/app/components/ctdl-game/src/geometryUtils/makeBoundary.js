import GameObject from '../GameObject';

export class Boundary extends GameObject {
  constructor(boundingBox) {
    super(JSON.stringify(boundingBox), boundingBox);
  }
  isSolid = true;
}

/**
 * @description Method to create simple boundary
 * @param {Object} boundingBox 
 * @returns {Object} boundary
 */
export const makeBoundary = boundingBox => new Boundary(boundingBox);
export default makeBoundary;
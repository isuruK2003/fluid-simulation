export class Grid {
  constructor(width, height, boundary = 1) {
    this.width = width;
    this.height = height;
    this.boundary = boundary;

    this.totalWidth = this.width + 2 * this.boundary;
    this.totalHeight = this.height + 2 * this.boundary;
    this.size = this.totalWidth * this.totalHeight;

    this.vy = new Float32Array(this.size);
    this.vx = new Float32Array(this.size);
    this.vyPrev = new Float32Array(this.size);
    this.vxPrev = new Float32Array(this.size);
    this.densPrev = new Float32Array(this.size);
    this.dens = new Float32Array(this.size);
    this.divergence = new Float32Array(this.size);
    this.pressure = new Float32Array(this.size);
  }

  getIndex = (x, y) => x + this.totalWidth * y;

  swapFields(fieldA, fieldB) {
    [this[fieldA], this[fieldB]] = [this[fieldB], this[fieldA]];
  }
}

export class Solver {
  constructor(grid, options = {}) {
    this.grid = grid;
    this.options = {
      timestep: options.timestep ?? 0.1,
      diffusion: {
        maxIter: options.diffusion?.maxIter ?? 20,
        rate: options.diffusion?.rate ?? 0.00001,
      },
    };
  }

  #addSource(field, source) {
    for (let i = 0; i < this.grid.size; i++) {
      field[i] += this.options.timestep * source[i];
    }
  }

  #setBoundary(field, direction = "scalar") {
    const IX = this.grid.getIndex;
    const w = this.grid.width;
    const h = this.grid.height;

    const evalX = direction === "x" ? -1 : 1;
    const evalY = direction === "y" ? -1 : 1;

    for (let y = 1; y <= h; y++) {
      field[IX(0, y)] = evalX * field[IX(1, y)];
      field[IX(w + 1, y)] = evalX * field[IX(w, y)];
    }

    for (let x = 1; x <= w; x++) {
      field[IX(x, 0)] = evalY * field[IX(x, 1)];
      field[IX(x, h + 1)] = evalY * field[IX(x, h)];
    }

    field[IX(0, 0)] = 0.5 * (field[IX(1, 0)] + field[IX(0, 1)]);
    field[IX(0, h + 1)] = 0.5 * (field[IX(1, h + 1)] + field[IX(0, h)]);
    field[IX(w + 1, 0)] = 0.5 * (field[IX(w, 0)] + field[IX(w + 1, 1)]);
    field[IX(w + 1, h + 1)] = 0.5 * (field[IX(w, h + 1)] + field[IX(w + 1, h)]);
  }

  #diffuse(field, fieldPrev, direction = "scalar") {
    const IX = this.grid.getIndex;
    const w = this.grid.width;
    const h = this.grid.height;
    const a = this.options.timestep * this.options.diffusion.rate * w * h;

    const maxIter = this.options.diffusion.maxIter;

    for (let i = 0; i < maxIter; i++) {
      for (let y = 1; y <= h; y++) {
        for (let x = 1; x <= w; x++) {
          const neighbours =
            field[IX(x - 1, y)] +
            field[IX(x + 1, y)] +
            field[IX(x, y - 1)] +
            field[IX(x, y + 1)];

          const result = fieldPrev[IX(x, y)] + a * neighbours;

          field[IX(x, y)] = result / (1 + 4 * a);
        }
      }

      this.#setBoundary(field, direction);
    }
  }

  #advect(field, fieldPrev, direction = "scalar") {
    const IX = this.grid.getIndex;
    const w = this.grid.width;
    const h = this.grid.height;
    const vx = this.grid.vx;
    const vy = this.grid.vy;

    const stepX = this.options.timestep * w;
    const stepY = this.options.timestep * h;

    for (let y = 1; y <= h; y++) {
      for (let x = 1; x <= w; x++) {
        let prevX = x - stepX * vx[IX(x, y)];
        let prevY = y - stepY * vy[IX(x, y)];

        if (prevX < 0.5) prevX = 0.5;
        if (prevX > w + 0.5) prevX = w + 0.5;

        if (prevY < 0.5) prevY = 0.5;
        if (prevY > h + 0.5) prevY = h + 0.5;

        const x0 = Math.floor(prevX);
        const x1 = x0 + 1;
        const y0 = Math.floor(prevY);
        const y1 = y0 + 1;

        const sx = prevX - x0;
        const sy = prevY - y0;

        const topLeft = fieldPrev[IX(x0, y0)];
        const topRight = fieldPrev[IX(x1, y0)];
        const bottomLeft = fieldPrev[IX(x0, y1)];
        const bottomRight = fieldPrev[IX(x1, y1)];

        field[IX(x, y)] =
          (1 - sx) * ((1 - sy) * topLeft + sy * bottomLeft) +
          sx * ((1 - sy) * topRight + sy * bottomRight);
      }
    }

    this.#setBoundary(field, direction);
  }

  stepDensity() {
    this.#addSource(this.grid.dens, this.grid.densPrev);

    this.grid.swapFields("dens", "densPrev");
    this.#diffuse(this.grid.dens, this.grid.densPrev, "scalar");

    this.grid.swapFields("dens", "densPrev");
    this.#advect(this.grid.dens, this.grid.densPrev, "scalar");
  }

  stepVelocity() {
    this.#addSource(this.grid.vx, this.grid.vxPrev);
    this.#addSource(this.grid.vy, this.grid.vyPrev);

    this.grid.swapFields("vx", "vxPrev");
    this.#diffuse(this.grid.vx, this.grid.vxPrev, "x");

    this.grid.swapFields("vy", "vyPrev");
    this.#diffuse(this.grid.vy, this.grid.vyPrev, "y");

    this.project();

    this.grid.swapFields("vx", "vxPrev");
    this.grid.swapFields("vy", "vyPrev");

    this.#advect(this.grid.vx, this.grid.vxPrev, "x");
    this.#advect(this.grid.vy, this.grid.vyPrev, "y");

    this.project();
  }

  project() {
    const IX = this.grid.getIndex;
    const w = this.grid.width;
    const h = this.grid.height;
    const vx = this.grid.vx;
    const vy = this.grid.vy;
    const p = this.grid.pressure;
    const div = this.grid.divergence;

    const cellSizeX = 1 / w;
    const cellSizeY = 1 / h;

    for (let y = 1; y <= h; y++) {
      for (let x = 1; x <= w; x++) {
        const vxDiff = vx[IX(x + 1, y)] - vx[IX(x - 1, y)];
        const vyDiff = vy[IX(x, y + 1)] - vy[IX(x, y - 1)];

        div[IX(x, y)] = -0.5 * (vxDiff * cellSizeX + vyDiff * cellSizeY);
        p[IX(x, y)] = 0;
      }
    }

    this.#setBoundary(div, "scalar");
    this.#setBoundary(p, "scalar");

    for (let i = 0; i < this.options.diffusion.maxIter; i++) {
      for (let y = 1; y <= h; y++) {
        for (let x = 1; x <= w; x++) {
          p[IX(x, y)] =
            (div[IX(x, y)] +
              p[IX(x - 1, y)] +
              p[IX(x + 1, y)] +
              p[IX(x, y - 1)] +
              p[IX(x, y + 1)]) /
            4;
        }
      }

      this.#setBoundary(p, "scalar");
    }

    for (let y = 1; y <= h; y++) {
      for (let x = 1; x <= w; x++) {
        vx[IX(x, y)] -= (0.5 * (p[IX(x + 1, y)] - p[IX(x - 1, y)])) / cellSizeX;
        vy[IX(x, y)] -= (0.5 * (p[IX(x, y + 1)] - p[IX(x, y - 1)])) / cellSizeY;
      }
    }

    this.#setBoundary(vx, "x");
    this.#setBoundary(vy, "y");
  }
}

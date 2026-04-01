export class Renderer {
  constructor(canvas, grid, solver, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.grid = grid;
    this.solver = solver;
    this.options = {
      densDecay: options.densDecay ?? 0.99,
      minDensity: 0.001,
      nozzle: {
        cx: options.nozzle?.cx ?? Math.floor(grid.width / 2),
        cy: options.nozzle?.cy ?? Math.floor(grid.height / 2),
        angle: options.nozzle?.angle ?? 0.0, // rads
        radius: options.nozzle?.radius ?? 1,
        velocity: options.nozzle?.velocity ?? 4,
        enabled: options.nozzle?.enabled ?? true,
        amount: options.nozzle.amount ?? 120,
      },
    };
  }

  #decayDensity() {
    for (let i = 0; i < this.grid.dens.length; i++) {
      this.grid.dens[i] *= this.options.densDecay;
    }
  }

  #clearSources() {
    this.grid.densPrev.fill(0);
    this.grid.vxPrev.fill(0);
    this.grid.vyPrev.fill(0);
  }

  #applyNozzle() {
    const { cx, cy, angle, radius, velocity, amount, enabled } =
      this.options.nozzle;
    if (!enabled) return;

    this.addVelocity({ cx, cy, angle, velocity, radius });
    this.addDensity({ cx, cy, radius, amount });
  }

  addDensity({ cx, cy, radius = 1, amount = 120 }) {
    const IX = this.grid.getIndex;
    const w = this.grid.width;
    const h = this.grid.height;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || x > w || y < 1 || y > h) continue;
        const falloff = Math.exp(-(dx * dx + dy * dy) / (radius * radius));
        this.grid.densPrev[IX(x, y)] += amount * falloff;
      }
    }
  }

  addVelocity({ cx, cy, angle, velocity, radius = 1 }) {
    const IX = this.grid.getIndex;
    const w = this.grid.width;
    const h = this.grid.height;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || x > w || y < 1 || y > h) continue;
        const falloff = Math.exp(-(dx * dx + dy * dy) / (radius * radius));
        this.grid.vxPrev[IX(x, y)] += vx * falloff;
        this.grid.vyPrev[IX(x, y)] += vy * falloff;
      }
    }
  }

  renderFrame() {
    const ctx = this.ctx;
    const grid = this.grid;
    const IX = grid.getIndex;
    const w = grid.width;
    const h = grid.height;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const cellW = cw / w;
    const cellH = ch / h;

    this.#decayDensity();
    this.#applyNozzle();
    this.solver.stepVelocity();
    this.solver.stepDensity();

    const img = ctx.createImageData(cw, ch);

    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;

    for (let y = 1; y <= h; y++) {
      for (let x = 1; x <= w; x++) {
        const density = Math.min(1, grid.dens[IX(x, y)]);
        if (density < this.options.minDensity) continue;

        const px0 = Math.round((x - 1) * cellW);
        const py0 = Math.round((y - 1) * cellH);
        const px1 = Math.round(x * cellW);
        const py1 = Math.round(y * cellH);

        const v = Math.round(density * 255);

        for (let py = py0; py < py1; py++) {
          for (let px = px0; px < px1; px++) {
            const idx = (py * cw + px) * 4;
            img.data[idx] = v;
            img.data[idx + 1] = v;
            img.data[idx + 2] = v;
            img.data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);
    this.#clearSources();
  }

  render(callback) {
    const loop = () => {
      this.renderFrame();
      callback(this);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

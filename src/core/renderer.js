export class Renderer {
  #smoothedMaxVelocity = 0;
  #smoothedMaxPressure = 0;
  #smoothingUp = 0.15;
  #smoothingDown = 0.02;

  constructor(canvas, grid, solver, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.grid = grid;
    this.solver = solver;
    this.options = {
      mode: options.mode ?? "density",
      densDecay: options.densDecay ?? 0.99,
      minDensity: 0.001,
      nozzle: {
        cx: options.nozzle?.cx ?? Math.floor(grid.width / 2),
        cy: options.nozzle?.cy ?? Math.floor(grid.height / 2),
        angle: options.nozzle?.angle ?? 0.0,
        radius: options.nozzle?.radius ?? 1,
        velocity: options.nozzle?.velocity ?? 4,
        enabled: options.nozzle?.enabled ?? true,
        amount: options.nozzle?.amount ?? 120,
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

  static velocityColorMap(t) {
    let r, g, b;

    if (t < 0.125) {
      const s = t / 0.125;
      r = 0;
      g = 0;
      b = s;
    } else if (t < 0.375) {
      const s = (t - 0.125) / 0.25;
      r = 0;
      g = s;
      b = 1;
    } else if (t < 0.625) {
      const s = (t - 0.375) / 0.25;
      r = s;
      g = 1;
      b = 1 - s;
    } else if (t < 0.875) {
      const s = (t - 0.625) / 0.25;
      r = 1;
      g = 1 - s;
      b = 0;
    } else {
      const s = (t - 0.875) / 0.125;
      r = 1 - 0.5 * s;
      g = 0;
      b = 0;
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  #renderDensity(img, w, h, cw, ch, cellW, cellH) {
    const IX = this.grid.getIndex;
    const dens = this.grid.dens;
    const minDensity = this.options.minDensity;
    const data = img.data;

    for (let y = 1; y <= h; y++) {
      for (let x = 1; x <= w; x++) {
        const density = Math.min(1, dens[IX(x, y)]);
        if (density < minDensity) continue;

        const px0 = Math.round((x - 1) * cellW);
        const py0 = Math.round((y - 1) * cellH);
        const px1 = Math.round(x * cellW);
        const py1 = Math.round(y * cellH);

        const v = Math.round(density * 255);

        for (let py = py0; py < py1; py++) {
          for (let px = px0; px < px1; px++) {
            const idx = (py * cw + px) * 4;
            data[idx] = v;
            data[idx + 1] = v;
            data[idx + 2] = v;
          }
        }
      }
    }
  }

  #renderVelocity(img, w, h, cw, ch, cellW, cellH) {
    const IX = this.grid.getIndex;
    const { vx, vy } = this.grid;
    const data = img.data;

    let frameMag = 0;
    for (let y = 1; y <= h; y++) {
      for (let x = 1; x <= w; x++) {
        const i = IX(x, y);
        const mag = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
        if (mag > frameMag) frameMag = mag;
      }
    }

    const alpha =
      frameMag > this.#smoothedMaxVelocity
        ? this.#smoothingUp
        : this.#smoothingDown;
    this.#smoothedMaxVelocity += alpha * (frameMag - this.#smoothedMaxVelocity);

    const maxMag = Math.max(this.#smoothedMaxVelocity, 1e-6);

    for (let y = 1; y <= h; y++) {
      for (let x = 1; x <= w; x++) {
        const i = IX(x, y);
        const u = vx[i];
        const v = vy[i];
        const mag = Math.sqrt(u * u + v * v);
        const norm = Math.min(1, mag / maxMag);

        if (norm < 0.005) continue;

        const [r, g, b] = Renderer.velocityColorMap(norm);

        const px0 = Math.round((x - 1) * cellW);
        const py0 = Math.round((y - 1) * cellH);
        const px1 = Math.round(x * cellW);
        const py1 = Math.round(y * cellH);

        for (let py = py0; py < py1; py++) {
          for (let px = px0; px < px1; px++) {
            const idx = (py * cw + px) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
          }
        }
      }
    }
  }

  #renderPressure(img, w, h, cw, ch, cellW, cellH) {
    const IX = this.grid.getIndex;
    const pressure = this.grid.pressure;
    const data = img.data;

    let frameAbs = 0;
    for (let y = 1; y <= h; y++) {
      for (let x = 1; x <= w; x++) {
        const absP = Math.abs(pressure[IX(x, y)]);
        if (absP > frameAbs) frameAbs = absP;
      }
    }

    const alpha =
      frameAbs > this.#smoothedMaxPressure
        ? this.#smoothingUp
        : this.#smoothingDown;
    this.#smoothedMaxPressure += alpha * (frameAbs - this.#smoothedMaxPressure);

    const maxAbs = Math.max(this.#smoothedMaxPressure, 1e-10);

    for (let y = 1; y <= h; y++) {
      for (let x = 1; x <= w; x++) {
        const p = pressure[IX(x, y)];
        const norm = Math.max(-1, Math.min(1, p / maxAbs));

        if (Math.abs(norm) < 0.005) continue;

        let r, g, b;

        if (norm > 0) {
          const t = norm;
          if (t < 0.5) {
            const s = t * 2;
            r = Math.round(s * 255);
            g = 0;
            b = 0;
          } else {
            const s = (t - 0.5) * 2;
            r = 255;
            g = Math.round(s * 255);
            b = Math.round(s * 255);
          }
        } else {
          const t = -norm;
          if (t < 0.5) {
            const s = t * 2;
            r = 0;
            g = 0;
            b = Math.round(s * 255);
          } else {
            const s = (t - 0.5) * 2;
            r = Math.round(s * 255);
            g = Math.round(s * 255);
            b = 255;
          }
        }

        const px0 = Math.round((x - 1) * cellW);
        const py0 = Math.round((y - 1) * cellH);
        const px1 = Math.round(x * cellW);
        const py1 = Math.round(y * cellH);

        for (let py = py0; py < py1; py++) {
          for (let px = px0; px < px1; px++) {
            const idx = (py * cw + px) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
          }
        }
      }
    }
  }

  renderFrame() {
    const ctx = this.ctx;
    const grid = this.grid;
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

    switch (this.options.mode) {
      case "velocity":
        this.#renderVelocity(img, w, h, cw, ch, cellW, cellH);
        break;
      case "pressure":
        this.#renderPressure(img, w, h, cw, ch, cellW, cellH);
        break;
      case "density":
      default:
        this.#renderDensity(img, w, h, cw, ch, cellW, cellH);
        break;
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

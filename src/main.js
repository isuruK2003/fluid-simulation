import { Grid } from "./core/grid.js";
import { Renderer } from "./core/renderer.js";
import { Solver } from "./core/solver.js";

const WIDTH = Math.min(window.innerWidth, 640);
const HEIGHT = Math.min(window.innerHeight, 480);

const CELL_SIZE = 4;
const COLS = Math.floor(WIDTH / CELL_SIZE);
const ROWS = Math.floor(HEIGHT / CELL_SIZE);

const TIMESTEP = 0.1;
const DIFFUSION_RATE = 0.000005;
const DIFFUSION_MAX_ITER = 10;

const NOZZLE_ANGLE = 1.5 * Math.PI;
const NOZZLE_RADIUS = 1;
const NOZZLE_VELOCITY = 5;
const NOZZLE_ENABLED = true;

const MOUSE_ENABLED = true;

function main() {
  const canvas = document.getElementById("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const grid = new Grid(COLS, ROWS);

  const solver = new Solver(grid, {
    timestep: TIMESTEP,
    diffusion: {
      maxIter: DIFFUSION_MAX_ITER,
      rate: DIFFUSION_RATE,
    },
  });

  const renderer = new Renderer(canvas, grid, solver, {
    nozzle: {
      radius: NOZZLE_RADIUS,
      angle: NOZZLE_ANGLE,
      velocity: NOZZLE_VELOCITY,
      enabled: NOZZLE_ENABLED,
    },
  });

  const mouse = { x: 0, y: 0, xPrev: 0, yPrev: 0, down: false, enabled: true };

  const panel = document.querySelector("config-panel");

  panel.fields = [
    {
      id: "diffusion_rate",
      key: "diffusionRate",
      label: "Diffusion Rate",
      min: 0.00000001,
      max: 0.0001,
      type: "range",
      step: 0.0000000001,
      default: DIFFUSION_RATE,
    },
    {
      id: "diffusion_iters",
      key: "diffusionIters",
      label: "Diffusion Iters",
      type: "range",
      min: 1,
      max: 30,
      step: 1,
      default: DIFFUSION_MAX_ITER,
    },
    {
      id: "nozzle_radius",
      key: "nozzleRadius",
      label: "Nozzle Radius",
      type: "range",
      min: 1,
      max: 10,
      step: 1,
      default: NOZZLE_RADIUS,
    },
    {
      id: "nozzle_x",
      key: "nozzleX",
      label: "Nozzle X (%)",
      type: "range",
      min: 0,
      max: 100,
      step: 1,
      default: 50,
    },
    {
      id: "nozzle_y",
      key: "nozzleY",
      label: "Nozzle Y (%)",
      type: "range",
      min: 0,
      max: 100,
      step: 1,
      default: 50,
    },
    {
      id: "nozzle_velocity",
      key: "nozzleVelocity",
      label: "Nozzle Velocity",
      type: "range",
      min: 1,
      max: 50,
      step: 1,
      default: NOZZLE_VELOCITY,
    },
    {
      id: "nozzle_angle",
      key: "nozzleAngle",
      label: "Nozzle Angle (rads)",
      type: "range",
      min: 0,
      max: Math.PI * 2,
      step: 0.01,
      default: NOZZLE_ANGLE,
    },
    {
      id: "nozzle_enabled",
      key: "nozzleEnabled",
      label: "Nozzle Enabled",
      type: "checkbox",
      default: NOZZLE_ENABLED,
    },
    {
      id: "mouse_enabled",
      key: "mouseEnabled",
      label: "Mouse Enabled",
      type: "checkbox",
      default: MOUSE_ENABLED,
    },
  ];

  panel.addEventListener("config-change", ({ detail }) => {
    switch (detail.key) {
      case "diffusionRate":
        solver.options.diffusion.rate = detail.value;
        break;
      case "diffusionIters":
        solver.options.diffusion.maxIter = detail.value;
        break;
      case "nozzleRadius":
        renderer.options.nozzle.radius = detail.value;
        break;
      case "nozzleVelocity":
        renderer.options.nozzle.velocity = detail.value;
        break;
      case "nozzleX":
        renderer.options.nozzle.cx =
          Math.floor((detail.value / 100) * COLS) + 1;
        break;
      case "nozzleY":
        renderer.options.nozzle.cy =
          Math.floor((detail.value / 100) * ROWS) + 1;
        break;
      case "nozzleEnabled":
        renderer.options.nozzle.enabled = detail.value;
        break;
      case "nozzleAngle":
        renderer.options.nozzle.angle = detail.value;
        break;
      case "mouseEnabled":
        mouse.enabled = detail.value;
        break;
    }
  });

  window.addEventListener("mouseup", () => (mouse.down = false));
  canvas.addEventListener("mousedown", () => (mouse.down = true));

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.xPrev = mouse.x;
    mouse.yPrev = mouse.y;
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });

  const handleMouse = () => {
    if (!mouse.enabled) return;
    const dx = mouse.x - mouse.xPrev;
    const dy = mouse.y - mouse.yPrev;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const steps = Math.ceil(len / CELL_SIZE);

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ix = Math.floor((mouse.xPrev + dx * t) / CELL_SIZE) + 1;
        const iy = Math.floor((mouse.yPrev + dy * t) / CELL_SIZE) + 1;

        renderer.addVelocity({
          cx: ix,
          cy: iy,
          angle,
          velocity: Math.min(len * 2, renderer.options.nozzle.velocity),
          radius: renderer.options.nozzle.radius,
        });

        if (mouse.down) {
          renderer.addDensity({
            cx: ix,
            cy: iy,
            radius: renderer.options.nozzle.radius,
          });
        }
      }

      mouse.xPrev = mouse.x;
      mouse.yPrev = mouse.y;
    }
  };
  renderer.render(() => handleMouse());
}

document.addEventListener("DOMContentLoaded", main);

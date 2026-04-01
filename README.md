# Eulerian Grid-Based Fluid Simulation

![Fluid simulation preview](screenshot.png)

This project is an interactive real-time 2D fluid simulation that brings fluid dynamics to your browser. Built on Jos Stam's landmark **"Stable Fluids"** paper, it visualizes incompressible flow using a grid-based Eulerian approach—no particle systems, just pure mathematics rendered on canvas.

The simulation models smoke or dye moving through air, driven by velocity fields and pressure gradients. Move your mouse, click and drag, or watch the built-in nozzle emitter create swirling, turbulent patterns that emerge naturally from the underlying physics.

## Controls

- **Move mouse** — add velocity to the fluid
- **Click and drag** — add density and velocity
- **Config panel** — adjust simulation parameters

---

## The Physics

This simulation solves the **Navier-Stokes equations** for incompressible fluid flow:

### Continuity Equation (Conservation of Mass)

$$\frac{\partial \rho}{\partial t} + \nabla \cdot (\rho \mathbf{u}) = 0$$

For incompressible flow (constant density), this simplifies to:

$$\nabla \cdot \mathbf{u} = 0$$

This is the **divergence-free constraint** — the velocity field must have zero divergence everywhere. This is enforced by the **projection step**.

### Momentum Equation

$$\frac{\partial \mathbf{u}}{\partial t} + (\mathbf{u} \cdot \nabla)\mathbf{u} = -\frac{1}{\rho}\nabla p + \nu\nabla^2\mathbf{u}$$

- First term: acceleration
- Second term: **advection** (self-advection of the velocity field)
- Third term: pressure gradient force
- Fourth term: viscosity/diffusion

---

## The Algorithm

Jos Stam's **"Stable Fluids" (1999)** solves these equations on a grid using operator splitting:

### Step 1: Add Sources

Inject velocity and density from the nozzle or mouse input:

$$\mathbf{u} += \Delta t \cdot \mathbf{u}_{source}$$

### Step 2: Diffusion (Viscosity)

Solve the diffusion equation using **Gauss-Seidel relaxation**:

$$\mathbf{u}_{new} = \frac{\mathbf{u}_{old} + a \sum \mathbf{u}_{neighbors}}{1 + 4a}$$

where $a = \Delta t \cdot \nu \cdot dx \cdot dy$

This implicitly handles viscosity, making the simulation stable for any timestep.

### Step 3: Projection (Pressure Solve)

This is the heart of incompressible flow. Two substeps:

**1. Compute divergence:**

$$\nabla \cdot \mathbf{u} = \frac{u_{i+1,j} - u_{i-1,j}}{2\Delta x} + \frac{v_{i,j+1} - v_{i,j-1}}{2\Delta y}$$

**2. Solve Poisson equation for pressure:**

$$\nabla^2 p = \nabla \cdot \mathbf{u}$$

Using Gauss-Seidel again:

$$p_{i,j} = \frac{p_{i-1,j} + p_{i+1,j} + p_{i,j-1} + p_{i,j+1} - div_{i,j}}{4}$$

**3. Subtract pressure gradient to make velocity divergence-free:**

$$u -= \frac{\partial p}{\partial x}, \quad v -= \frac{\partial p}{\partial y}$$

### Step 4: Advection

Move quantities along the velocity field using **semi-Lagrangian advection**:

1. For each grid cell, trace backwards along the velocity: $\mathbf{x}_{prev} = \mathbf{x} - \Delta t \cdot \mathbf{u}$
2. Interpolate the old value at $\mathbf{x}_{prev}$ using bilinear interpolation

This is unconditionally stable (no CFL constraint) because we trace _backwards_.

---

## Boundary Conditions

**No-slip boundaries** are implemented by reflecting velocity at edges:

- Left/right walls: $u(0,y) = -u(1,y)$
- Top/bottom walls: $v(x,0) = -v(x,1)$

Corners average their neighbors for stability.

---

## Key Theorems

| Theorem                     | Relevance                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Helmholtz Decomposition** | Any vector field can be decomposed into curl-free and divergence-free components. Projection exploits this. |
| **Poisson Equation**        | $\nabla^2 p = \nabla \cdot \mathbf{u}$ arises from applying divergence to the momentum equation             |
| **Lax Equivalence Theorem** | For linear systems, consistency + stability = convergence (justifies implicit methods)                      |

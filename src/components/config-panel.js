class ConfigPanel extends HTMLElement {
  #values = {};
  #fields = [];
  #panel = null;
  #panelToggle = null;

  set fields(fields) {
    this.#fields = fields;
    for (const f of fields) this.#values[f.key] = f.default;
    if (this.shadowRoot) this.#render();
  }

  set open(value) {
    const isOpen = Boolean(value);
    if (!this.#panel) return;
    this.#panel.classList.toggle("collapsed", !isOpen);
    this.#panelToggle.textContent = isOpen ? "▼" : "▲";
  }

  get open() {
    return this.#panel ? !this.#panel.classList.contains("collapsed") : false;
  }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.#render();
    this.open = true;
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; }

        :host {
          position: fixed;
          bottom: 0;
          right: 16px;
          width: 300px;
          z-index: 10;
          font-family: monospace;
          font-size: 12px;
          color: #ccc;
        }

        #panel {
          background: #1a1a1a;
          border: 1px solid #444;
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          transition: transform 0.25s ease;
        }

        #panel.collapsed {
          transform: translateY(calc(100% - 28px));
        }

        #header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: #222;
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          cursor: pointer;
          user-select: none;
          border-bottom: 1px solid #444;
        }

        #header span { letter-spacing: 0.05em; color: #aaa; }

        #panel-toggle {
          background: none;
          border: none;
          color: #aaa;
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        #body {
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field { display: flex; flex-direction: column; gap: 3px; justify-content: space-between; }
        .field-checkbox { flex-direction: row; }

        .field label {
          color: #888;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          justify-content: space-between;
        }

        .field label span { color: #eee; }

        .field input[type="number"],
        .field select {
          background: #111;
          border: 1px solid #444;
          border-radius: 3px;
          color: #eee;
          font-family: monospace;
          font-size: 12px;
          padding: 4px 6px;
          width: 100%;
          outline: none;
        }

        .field input[type="range"] {
          width: 100%;
          accent-color: #888;
        }

        .field input:focus,
        .field select:focus { border-color: #888; }
      </style>

      <div id="panel">
        <div id="header">
          <span>Configuration</span>
          <button id="panel-toggle">▼</button>
        </div>
        <div id="body">
          ${this.#fields.map((f) => this.#renderField(f)).join("")}
        </div>
      </div>
    `;

    this.#panel = this.shadowRoot.getElementById("panel");
    this.#panelToggle = this.shadowRoot.getElementById("panel-toggle");

    this.shadowRoot.getElementById("header").addEventListener("click", () => {
      this.open = !this.open;
    });

    for (const f of this.#fields) this.#bindField(f);
  }

  #renderField(f) {
    switch (f.type) {
      case "range":
        return `
          <div class="field">
            <label>${f.label} <span id="${f.id}_display">${f.default}</span></label>
            <input id="${f.id}" type="range" min="${f.min}" max="${f.max}" step="${f.step ?? 1}" value="${f.default}" />
          </div>`;
      case "checkbox":
        return `
          <div class="field field-checkbox">
            <label for="${f.id}">${f.label}</label>
            <input id="${f.id}" type="checkbox" ${f.default ? "checked" : ""} />
          </div>`;
      case "select":
        return `
          <div class="field">
            <label>${f.label}</label>
            <select id="${f.id}">
              ${f.options.map((o) => `<option value="${o.value}" ${o.value === f.default ? "selected" : ""}>${o.label}</option>`).join("")}
            </select>
          </div>`;
      case "number":
      default:
        return `
          <div class="field">
            <label>${f.label}</label>
            <input id="${f.id}" type="number" step="${f.step ?? 1}" value="${f.default}" />
          </div>`;
    }
  }

  #bindField(f) {
    const el = this.shadowRoot.getElementById(f.id);
    if (!el) return;

    const emit = (value) => {
      this.#values[f.key] = value;
      this.dispatchEvent(
        new CustomEvent("config-change", {
          bubbles: true,
          detail: { key: f.key, value, values: { ...this.#values } },
        }),
      );
    };

    const resolvers = {
      number: (el, _f, emit) =>
        el.addEventListener("change", () => emit(Number(el.value))),
      select: (el, _f, emit) =>
        el.addEventListener("change", () => emit(el.value)),
      checkbox: (el, _f, emit) =>
        el.addEventListener("change", () => emit(el.checked)),
      range: (el, f, emit, root) => {
        const display = root.getElementById(`${f.id}_display`);
        el.addEventListener("input", () => {
          if (display) display.textContent = el.value;
          emit(Number(el.value));
        });
      },
    };

    const resolver = resolvers[f.type];
    if (!resolver) throw new Error(`Unsupported field type: ${f.type}`);
    resolver(el, f, emit, this.shadowRoot);
  }

  get values() {
    return { ...this.#values };
  }
}

customElements.define("config-panel", ConfigPanel);

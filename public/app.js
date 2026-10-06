(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORE_KEY = "balance-practice:v1";
  const LEVELS = ["easy", "medium", "hard", "mixed"];
  const PRAISE = ["Correct!", "Nice work!", "Balanced!", "Exactly right!", "Well done!"];

  const problemCard = document.querySelector(".problem");
  const equationEl = $("equation");
  const feedbackEl = $("feedback");
  const hintsEl = $("hints");
  const counterTable = $("counter");
  const counterBody = counterTable.querySelector("tbody");
  const counterToggle = $("counter-toggle");
  const levelButtons = document.querySelectorAll("[data-level]");
  const checkBtn = $("check");
  const hintBtn = $("hint");
  const revealBtn = $("reveal");
  const nextBtn = $("next");

  // Browser storage can be unavailable (private mode, blocked site data).
  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch {
      return {};
    }
  }

  const saved = loadSaved();
  const state = {
    level: LEVELS.includes(saved.level) ? saved.level : "easy",
    showCounter: saved.showCounter !== false,
    stats: { solved: saved.solved | 0, streak: saved.streak | 0, best: saved.best | 0 },
    recent: [],
    eq: null,
    inputs: [],
    hintStep: 0,
    done: false,
  };

  function save() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ level: state.level, showCounter: state.showCounter, ...state.stats })
      );
    } catch {
      // Progress just won't be remembered.
    }
  }

  function renderStats() {
    $("stat-solved").textContent = state.stats.solved;
    $("stat-streak").textContent = state.stats.streak;
    $("stat-best").textContent = state.stats.best;
  }

  function say(kind, text) {
    feedbackEl.className = "feedback " + kind;
    feedbackEl.textContent = text;
  }

  function clearFeedback() {
    feedbackEl.className = "feedback";
    feedbackEl.textContent = "";
  }

  // Empty box = 1; anything that isn't a whole number >= 1 is NaN.
  function readCoefficients() {
    return state.inputs.map((input) => {
      const v = input.value.trim();
      if (v === "") return 1;
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 ? n : NaN;
    });
  }

  function renderEquation() {
    const eq = state.eq;
    equationEl.textContent = "";
    state.inputs = [];
    eq.species.forEach((formula, i) => {
      const term = document.createElement("span");
      term.className = "term";
      // The operator rides with the next term so a line never ends on "+".
      if (i === eq.reactants.length) term.append(op("→"));
      else if (i > 0) term.append(op("+"));

      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.autocomplete = "off";
      input.maxLength = 2;
      input.placeholder = "1";
      input.setAttribute("aria-label", "Coefficient for " + Chem.formulaText(formula));
      input.addEventListener("input", onInput);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          check();
        }
      });

      const f = document.createElement("span");
      f.className = "formula";
      f.innerHTML = Chem.formulaHTML(formula);

      term.append(input, f);
      equationEl.append(term);
      state.inputs.push(input);
    });
  }

  function op(symbol) {
    const span = document.createElement("span");
    span.className = "op";
    span.textContent = symbol;
    return span;
  }

  function onInput(e) {
    const input = e.target;
    input.value = input.value.replace(/\D/g, "");
    input.classList.remove("invalid");
    if (feedbackEl.classList.contains("bad")) clearFeedback();
    renderCounter();
  }

  function renderCounter() {
    const rows = Chem.countAtoms(state.eq, readCoefficients());
    counterBody.innerHTML = rows
      .map(({ element, left, right }) => {
        const ok = left === right;
        const show = (n) => (Number.isNaN(n) ? "?" : n);
        return (
          "<tr><td>" + element + "</td><td>" + show(left) + "</td><td>" + show(right) + "</td>" +
          '<td class="' + (ok ? "ok" : "off") + '"><span aria-hidden="true">' + (ok ? "✓" : "✗") + "</span>" +
          '<span class="visually-hidden">' + (ok ? "balanced" : "not balanced") + "</span></td></tr>"
        );
      })
      .join("");
  }

  function setActionsEnabled(enabled) {
    checkBtn.disabled = !enabled;
    hintBtn.disabled = !enabled;
    revealBtn.disabled = !enabled;
  }

  function lockInputs() {
    state.inputs.forEach((input) => {
      input.readOnly = true;
      input.classList.remove("invalid");
    });
  }

  function newEquation(focus = true) {
    state.eq = Chem.randomEquation(state.level, state.recent);
    state.recent.push(state.eq.key);
    if (state.recent.length > 25) state.recent.shift();
    state.hintStep = 0;
    state.done = false;

    problemCard.classList.remove("solved");
    $("type").textContent = state.eq.type;
    clearFeedback();
    hintsEl.textContent = "";
    setActionsEnabled(true);
    renderEquation();
    renderCounter();
    if (focus) state.inputs[0].focus({ preventScroll: true });
  }

  function check() {
    if (state.done) return;
    const coeffs = readCoefficients();

    let invalid = false;
    coeffs.forEach((c, i) => {
      const bad = Number.isNaN(c);
      state.inputs[i].classList.toggle("invalid", bad);
      invalid = invalid || bad;
    });
    if (invalid) {
      say("bad", "Coefficients must be whole numbers, 1 or more.");
      return;
    }

    const off = Chem.countAtoms(state.eq, coeffs).filter((r) => r.left !== r.right);
    if (off.length) {
      const r = off[0];
      const others = off.length - 1;
      const more = others ? " (and " + others + " more element" + (others > 1 ? "s" : "") + ")" : "";
      say("bad", "Not balanced yet: " + r.element + " is " + r.left + " on the left but " + r.right + " on the right" + more + ".");
      return;
    }

    const g = coeffs.reduce(Chem.gcd);
    if (g > 1) {
      say("info", "Balanced! Now simplify: every coefficient can be divided by " + g + ".");
      return;
    }

    state.done = true;
    state.stats.solved++;
    state.stats.streak++;
    state.stats.best = Math.max(state.stats.best, state.stats.streak);
    save();
    renderStats();
    lockInputs();
    problemCard.classList.add("solved");
    setActionsEnabled(false);
    const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    say("good", praise + "  " + Chem.equationText(state.eq, coeffs));
    nextBtn.focus();
  }

  function hint() {
    if (state.done) return;
    const eq = state.eq;
    state.hintStep++;
    let text;
    if (state.hintStep === 1) {
      text = Chem.TYPE_TIPS[eq.type] || "Balance one element at a time, leaving O and H for last.";
    } else if (state.hintStep === 2) {
      text = Chem.startHint(eq);
    } else {
      const i = Chem.biggestSpecies(eq);
      const input = state.inputs[i];
      input.value = eq.coefficients[i];
      input.readOnly = true;
      input.classList.remove("invalid");
      input.classList.add("given");
      text =
        "The coefficient for " + Chem.formulaText(eq.species[i]) + " is " + eq.coefficients[i] +
        ". It's filled in for you; work out the rest from there.";
      hintBtn.disabled = true;
      renderCounter();
    }
    const li = document.createElement("li");
    li.textContent = text;
    hintsEl.append(li);
  }

  function reveal() {
    if (state.done) return;
    const eq = state.eq;
    state.done = true;
    state.inputs.forEach((input, i) => {
      input.value = eq.coefficients[i];
    });
    lockInputs();
    state.stats.streak = 0;
    save();
    renderStats();
    renderCounter();
    setActionsEnabled(false);
    say("info", "Answer: " + Chem.equationText(eq, eq.coefficients) + ". Give the next one a try!");
    nextBtn.focus();
  }

  function setLevel(level) {
    state.level = level;
    levelButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.level === level)));
    save();
  }

  levelButtons.forEach((b) =>
    b.addEventListener("click", () => {
      setLevel(b.dataset.level);
      newEquation();
    })
  );

  counterToggle.addEventListener("change", () => {
    state.showCounter = counterToggle.checked;
    counterTable.hidden = !state.showCounter;
    save();
  });

  checkBtn.addEventListener("click", check);
  hintBtn.addEventListener("click", hint);
  revealBtn.addEventListener("click", reveal);
  nextBtn.addEventListener("click", () => newEquation());

  counterToggle.checked = state.showCounter;
  counterTable.hidden = !state.showCounter;
  setLevel(state.level);
  renderStats();
  newEquation(false);
})();

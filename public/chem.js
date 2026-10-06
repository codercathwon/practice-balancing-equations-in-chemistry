/*
 * Chemistry engine: parses formulas, solves equations exactly, and builds
 * random (but chemically sensible) equations to balance.
 */
(function (root) {
  "use strict";

  // ---------- Small math helpers ----------

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  }

  function lcm(a, b) {
    return (a / gcd(a, b)) * b;
  }

  // Fractions are [numerator, denominator] pairs kept in lowest terms.
  function frac(n, d = 1) {
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1;
    return [n / g, d / g];
  }
  const fsub = (a, b) => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
  const fmul = (a, b) => frac(a[0] * b[0], a[1] * b[1]);
  const fdiv = (a, b) => frac(a[0] * b[1], a[1] * b[0]);

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // ---------- Formulas ----------

  // "Al2(SO4)3" -> { Al: 2, S: 3, O: 12 }
  function parseFormula(formula) {
    let i = 0;

    function parseGroup() {
      const counts = {};
      while (i < formula.length && formula[i] !== ")") {
        let part;
        if (formula[i] === "(") {
          i++;
          part = parseGroup();
          if (formula[i] !== ")") throw new Error("Unclosed ( in " + formula);
          i++;
        } else {
          const el = /^[A-Z][a-z]?/.exec(formula.slice(i));
          if (!el) throw new Error("Bad formula: " + formula);
          i += el[0].length;
          part = { [el[0]]: 1 };
        }
        const num = /^\d+/.exec(formula.slice(i));
        const mult = num ? parseInt(num[0], 10) : 1;
        if (num) i += num[0].length;
        for (const el in part) counts[el] = (counts[el] || 0) + part[el] * mult;
      }
      return counts;
    }

    const counts = parseGroup();
    if (i !== formula.length) throw new Error("Unexpected ) in " + formula);
    return counts;
  }

  const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

  // "H2O" -> "H₂O" (for plain-text places such as feedback messages).
  function formulaText(formula) {
    return formula.replace(/\d/g, (d) => SUBSCRIPTS[d]);
  }

  // "H2O" -> "H<sub>2</sub>O"
  function formulaHTML(formula) {
    return formula.replace(/(\d+)/g, "<sub>$1</sub>");
  }

  function equationText(eq, coefficients) {
    const side = (list, offset) =>
      list
        .map((f, i) => {
          const c = coefficients[offset + i];
          return (c === 1 ? "" : c + " ") + formulaText(f);
        })
        .join(" + ");
    return side(eq.reactants, 0) + " → " + side(eq.products, eq.reactants.length);
  }

  // ---------- Solving ----------

  // Returns the smallest whole-number coefficients that balance the equation,
  // or null when there is no unique positive answer.
  function solve(reactants, products) {
    const species = reactants.concat(products);
    const parsed = species.map(parseFormula);
    const elements = [];
    parsed.forEach((p) =>
      Object.keys(p).forEach((el) => {
        if (!elements.includes(el)) elements.push(el);
      })
    );

    // One row per element; reactants count positive, products negative.
    const m = elements.map((el) =>
      parsed.map((p, j) => frac((p[el] || 0) * (j < reactants.length ? 1 : -1)))
    );
    const n = species.length;
    const pivots = [];
    let r = 0;
    for (let c = 0; c < n && r < m.length; c++) {
      let p = r;
      while (p < m.length && m[p][c][0] === 0) p++;
      if (p === m.length) continue;
      [m[r], m[p]] = [m[p], m[r]];
      const pv = m[r][c];
      m[r] = m[r].map((x) => fdiv(x, pv));
      for (let k = 0; k < m.length; k++) {
        if (k !== r && m[k][c][0] !== 0) {
          const f = m[k][c];
          m[k] = m[k].map((x, j) => fsub(x, fmul(f, m[r][j])));
        }
      }
      pivots.push(c);
      r++;
    }

    const free = [];
    for (let c = 0; c < n; c++) if (!pivots.includes(c)) free.push(c);
    if (free.length !== 1) return null;

    const f = free[0];
    const x = species.map(() => frac(0));
    x[f] = frac(1);
    pivots.forEach((pc, row) => {
      x[pc] = frac(-m[row][f][0], m[row][f][1]);
    });

    const denom = x.reduce((acc, v) => lcm(acc, v[1]), 1);
    let ints = x.map((v) => v[0] * (denom / v[1]));
    const g = ints.reduce((acc, v) => gcd(acc, v), 0);
    ints = ints.map((v) => v / g);
    if (ints[0] < 0) ints = ints.map((v) => -v);
    if (ints.some((v) => v <= 0)) return null;
    return ints;
  }

  // ---------- Building blocks for random equations ----------

  const CAT = {
    H: { s: "H", c: 1 },
    Li: { s: "Li", c: 1 },
    Na: { s: "Na", c: 1 },
    K: { s: "K", c: 1 },
    Ag: { s: "Ag", c: 1 },
    NH4: { s: "NH4", c: 1, poly: true },
    Mg: { s: "Mg", c: 2 },
    Ca: { s: "Ca", c: 2 },
    Ba: { s: "Ba", c: 2 },
    Zn: { s: "Zn", c: 2 },
    Cu: { s: "Cu", c: 2 },
    Pb: { s: "Pb", c: 2 },
    Hg: { s: "Hg", c: 2 },
    Fe2: { s: "Fe", c: 2 },
    Al: { s: "Al", c: 3 },
    Fe3: { s: "Fe", c: 3 },
    Au: { s: "Au", c: 3 },
  };

  const AN = {
    F: { s: "F", c: 1 },
    Cl: { s: "Cl", c: 1 },
    Br: { s: "Br", c: 1 },
    I: { s: "I", c: 1 },
    OH: { s: "OH", c: 1, poly: true },
    NO3: { s: "NO3", c: 1, poly: true },
    ClO3: { s: "ClO3", c: 1, poly: true },
    O: { s: "O", c: 2 },
    S: { s: "S", c: 2 },
    SO4: { s: "SO4", c: 2, poly: true },
    CO3: { s: "CO3", c: 2, poly: true },
    N: { s: "N", c: 3 },
    PO4: { s: "PO4", c: 3, poly: true },
  };

  // How each nonmetal appears as a free element.
  const ELEMENT_FORM = { H: "H2", O: "O2", N: "N2", F: "F2", Cl: "Cl2", Br: "Br2", I: "I2", S: "S" };

  // Neutral ionic compound from a cation key and an anion key: ("Al", "SO4") -> "Al2(SO4)3"
  function compound(catKey, anKey) {
    const cat = CAT[catKey];
    const an = AN[anKey];
    const total = lcm(cat.c, an.c);
    const part = (ion, k) => (k === 1 ? ion.s : ion.poly ? "(" + ion.s + ")" + k : ion.s + k);
    return part(cat, total / cat.c) + part(an, total / an.c);
  }

  // Pairs that don't form a stable, ordinary compound.
  const NO_COMPOUND = new Set(["NH4:OH", "Ag:OH", "Al:CO3", "Fe3:CO3", "Cu:I", "Fe3:I", "Fe3:S", "Al:S"]);
  const exists = (cat, an) => !NO_COMPOUND.has(cat + ":" + an);

  // Simplified solubility rules, used to pick realistic precipitation reactions.
  function soluble(cat, an) {
    if (["Li", "Na", "K", "NH4"].includes(cat)) return true;
    if (an === "NO3" || an === "ClO3") return true;
    if (["Cl", "Br", "I"].includes(an)) return !["Ag", "Pb", "Hg"].includes(cat);
    if (an === "SO4") return !["Ba", "Pb", "Ca", "Ag"].includes(cat);
    if (an === "OH") return cat === "Ba";
    return false; // carbonates, phosphates, oxides, sulfides
  }

  function hydrocarbon(c, h) {
    return "C" + (c > 1 ? c : "") + "H" + h;
  }

  // Parses "A + B -> C + D" into reactants and products.
  function fromText(text, type) {
    const [left, right] = text.split("->");
    const side = (s) => s.split("+").map((f) => f.trim());
    return { type, reactants: side(left), products: side(right) };
  }

  // ---------- Generators (one per reaction type) ----------

  function genCombustion() {
    const kind = pick(["alkane", "alkane", "alkene", "alkyne", "alcohol", "other"]);
    let fuel;
    if (kind === "alkane") {
      const n = randInt(1, 8);
      fuel = hydrocarbon(n, 2 * n + 2);
    } else if (kind === "alkene") {
      const n = randInt(2, 6);
      fuel = hydrocarbon(n, 2 * n);
    } else if (kind === "alkyne") {
      const n = randInt(2, 6);
      fuel = hydrocarbon(n, 2 * n - 2);
    } else if (kind === "alcohol") {
      const n = randInt(1, 5);
      fuel = "C" + (n > 1 ? n : "") + "H" + (2 * n + 1) + "OH";
    } else {
      fuel = pick(["C6H12O6", "C12H22O11", "C6H6", "C7H8", "C3H6O", "C2H4O2", "C10H8"]);
    }
    return { type: "Combustion", reactants: [fuel, "O2"], products: ["CO2", "H2O"] };
  }

  const NONMETAL_SYNTHESIS = [
    "H2 + O2 -> H2O",
    "H2 + N2 -> NH3",
    "H2 + Cl2 -> HCl",
    "P4 + O2 -> P4O10",
    "P4 + O2 -> P4O6",
    "P4 + Cl2 -> PCl3",
    "P4 + Cl2 -> PCl5",
    "S + O2 -> SO3",
    "SO2 + O2 -> SO3",
    "N2 + O2 -> NO2",
    "N2 + O2 -> N2O5",
    "CO + O2 -> CO2",
    "C + H2 -> CH4",
    "Na2O + H2O -> NaOH",
    "P4O10 + H2O -> H3PO4",
    "N2O5 + H2O -> HNO3",
    "Fe + O2 -> Fe3O4",
    "Cu + O2 -> Cu2O",
  ];

  function genSynthesis() {
    if (Math.random() < 0.3) return fromText(pick(NONMETAL_SYNTHESIS), "Synthesis");
    const metal = pick(["Li", "Na", "K", "Mg", "Ca", "Ba", "Al", "Zn", "Fe3", "Cu"]);
    const nonmetal = pick(["O", "O", "Cl", "Cl", "Br", "F", "I", "S", "N"]);
    if (nonmetal === "N" && !["Li", "Mg", "Ca", "Al"].includes(metal)) return null;
    if (!exists(metal, nonmetal)) return null;
    return {
      type: "Synthesis",
      reactants: [CAT[metal].s, ELEMENT_FORM[nonmetal]],
      products: [compound(metal, nonmetal)],
    };
  }

  const SIMPLE_DECOMPOSITION = [
    "H2O -> H2 + O2",
    "H2O2 -> H2O + O2",
    "NH3 -> N2 + H2",
    "NaN3 -> Na + N2",
    "NaHCO3 -> Na2CO3 + H2O + CO2",
    "NH4NO3 -> N2O + H2O",
    "(NH4)2Cr2O7 -> Cr2O3 + N2 + H2O",
    "KNO3 -> KNO2 + O2",
    "N2O5 -> NO2 + O2",
    "NI3 -> N2 + I2",
    "Ag2CO3 -> Ag + CO2 + O2",
    "KClO4 -> KCl + O2",
    "HI -> H2 + I2",
    "SO3 -> SO2 + O2",
  ];

  function genDecomposition() {
    const kind = randInt(0, 6);
    if (kind === 0) {
      const c = pick(["Li", "Na", "K", "Mg", "Ca", "Ba"]);
      return { type: "Decomposition", reactants: [compound(c, "ClO3")], products: [compound(c, "Cl"), "O2"] };
    }
    if (kind === 1) {
      const c = pick(["Hg", "Ag", "Au", "Cu", "Pb", "Al", "Fe3", "Mg", "Zn", "Na"]);
      return { type: "Decomposition", reactants: [compound(c, "O")], products: [CAT[c].s, "O2"] };
    }
    if (kind === 2) {
      const c = pick(["Na", "K", "Li", "Mg", "Ca", "Al", "Fe3", "Zn", "Ag", "Cu"]);
      const x = pick(["F", "Cl", "Br", "I"]);
      if (!exists(c, x)) return null;
      return { type: "Decomposition", reactants: [compound(c, x)], products: [CAT[c].s, ELEMENT_FORM[x]] };
    }
    if (kind === 3) {
      const c = pick(["Ca", "Mg", "Ba", "Zn", "Cu", "Pb", "Li"]);
      return { type: "Decomposition", reactants: [compound(c, "CO3")], products: [compound(c, "O"), "CO2"] };
    }
    if (kind === 4) {
      const c = pick(["Al", "Fe3", "Cu", "Mg", "Zn"]);
      return { type: "Decomposition", reactants: [compound(c, "OH")], products: [compound(c, "O"), "H2O"] };
    }
    if (kind === 5) {
      const c = pick(["Pb", "Cu", "Zn", "Mg", "Ca", "Al", "Fe3"]);
      return { type: "Decomposition", reactants: [compound(c, "NO3")], products: [compound(c, "O"), "NO2", "O2"] };
    }
    return fromText(pick(SIMPLE_DECOMPOSITION), "Decomposition");
  }

  // Metals that can push less active metals out of their salts, most active first.
  const DISPLACEMENT_ORDER = ["Mg", "Al", "Zn", "Fe2", "Pb", "Cu", "Ag"];

  function genSingleReplacement() {
    const r = Math.random();
    if (r < 0.15) {
      const m = pick(["Li", "Na", "K", "Ca", "Ba"]);
      return { type: "Single replacement", reactants: [CAT[m].s, "H2O"], products: [compound(m, "OH"), "H2"] };
    }
    if (r < 0.35) {
      const m = pick(["Mg", "Al", "Zn", "Fe2"]);
      const an = pick(["Cl", "Br", "SO4"]);
      return {
        type: "Single replacement",
        reactants: [CAT[m].s, compound("H", an)],
        products: [compound(m, an), "H2"],
      };
    }
    if (r < 0.5) {
      const halogens = ["F", "Cl", "Br", "I"];
      const i = randInt(0, 2);
      const j = randInt(i + 1, 3);
      const c = pick(["Na", "K", "Li", "Mg", "Ca", "Al"]);
      return {
        type: "Single replacement",
        reactants: [ELEMENT_FORM[halogens[i]], compound(c, halogens[j])],
        products: [compound(c, halogens[i]), ELEMENT_FORM[halogens[j]]],
      };
    }
    const i = randInt(0, DISPLACEMENT_ORDER.length - 2);
    const j = randInt(i + 1, DISPLACEMENT_ORDER.length - 1);
    const a = DISPLACEMENT_ORDER[i];
    const b = DISPLACEMENT_ORDER[j];
    const an = pick(["NO3", "Cl", "SO4"]);
    if (!soluble(b, an)) return null;
    return {
      type: "Single replacement",
      reactants: [CAT[a].s, compound(b, an)],
      products: [compound(a, an), CAT[b].s],
    };
  }

  const DR_CATIONS = ["Na", "K", "Li", "NH4", "Ag", "Mg", "Ca", "Ba", "Zn", "Cu", "Pb", "Al", "Fe3"];
  const DR_ANIONS = ["Cl", "Br", "I", "NO3", "OH", "SO4", "CO3", "PO4"];

  function genDoubleReplacement() {
    for (let tries = 0; tries < 60; tries++) {
      const c1 = pick(DR_CATIONS);
      const c2 = pick(DR_CATIONS);
      const a1 = pick(DR_ANIONS);
      const a2 = pick(DR_ANIONS);
      if (c1 === c2 || a1 === a2) continue;
      if (![[c1, a1], [c2, a2], [c1, a2], [c2, a1]].every(([c, a]) => exists(c, a))) continue;
      // Both starting compounds dissolve, and at least one product precipitates.
      if (!soluble(c1, a1) || !soluble(c2, a2)) continue;
      if (soluble(c1, a2) && soluble(c2, a1)) continue;
      return {
        type: "Double replacement",
        reactants: [compound(c1, a1), compound(c2, a2)],
        products: [compound(c1, a2), compound(c2, a1)],
      };
    }
    return null;
  }

  function genAcidBase() {
    const an = pick(["Cl", "Br", "NO3", "SO4", "PO4"]);
    const acid = compound("H", an);
    const r = Math.random();
    if (r < 0.25) {
      const c = pick(["Na", "K", "Li", "Ca", "Mg", "Ba", "Zn"]);
      return {
        type: "Acid–base",
        reactants: [compound(c, "CO3"), acid],
        products: [compound(c, an), "H2O", "CO2"],
      };
    }
    if (r < 0.45) {
      const c = pick(["Mg", "Ca", "Cu", "Zn", "Al", "Fe3", "Na"]);
      return { type: "Acid–base", reactants: [compound(c, "O"), acid], products: [compound(c, an), "H2O"] };
    }
    const c = pick(["Li", "Na", "K", "Mg", "Ca", "Ba", "Al", "Fe3", "Zn"]);
    return { type: "Acid–base", reactants: [acid, compound(c, "OH")], products: [compound(c, an), "H2O"] };
  }

  const CLASSICS = [
    "Fe2O3 + CO -> Fe + CO2",
    "Fe2O3 + C -> Fe + CO2",
    "Fe2O3 + H2 -> Fe + H2O",
    "Fe3O4 + H2 -> Fe + H2O",
    "Al + Fe2O3 -> Al2O3 + Fe",
    "Fe + H2O -> Fe3O4 + H2",
    "NH3 + O2 -> NO + H2O",
    "NH3 + O2 -> N2 + H2O",
    "NH3 + CuO -> Cu + N2 + H2O",
    "NO2 + H2O -> HNO3 + NO",
    "Cu + HNO3 -> Cu(NO3)2 + NO + H2O",
    "Cu + HNO3 -> Cu(NO3)2 + NO2 + H2O",
    "Cu + H2SO4 -> CuSO4 + SO2 + H2O",
    "Zn + HNO3 -> Zn(NO3)2 + NH4NO3 + H2O",
    "KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O",
    "MnO2 + HCl -> MnCl2 + Cl2 + H2O",
    "K2Cr2O7 + HCl -> KCl + CrCl3 + Cl2 + H2O",
    "Cl2 + NaOH -> NaCl + NaClO3 + H2O",
    "FeS2 + O2 -> Fe2O3 + SO2",
    "ZnS + O2 -> ZnO + SO2",
    "PbS + O2 -> PbO + SO2",
    "H2S + O2 -> SO2 + H2O",
    "CS2 + O2 -> CO2 + SO2",
    "Ca3(PO4)2 + SiO2 + C -> CaSiO3 + P4 + CO",
    "CH4 + Cl2 -> CCl4 + HCl",
    "SiCl4 + H2O -> H4SiO4 + HCl",
    "CaC2 + H2O -> C2H2 + Ca(OH)2",
    "Mg3N2 + H2O -> Mg(OH)2 + NH3",
    "Al4C3 + H2O -> Al(OH)3 + CH4",
    "CaH2 + H2O -> Ca(OH)2 + H2",
    "SiO2 + HF -> SiF4 + H2O",
    "Na2O2 + H2O -> NaOH + O2",
    "KO2 + CO2 -> K2CO3 + O2",
    "NaOH + CO2 -> Na2CO3 + H2O",
    "B2H6 + O2 -> B2O3 + H2O",
    "Na2S2O3 + I2 -> Na2S4O6 + NaI",
    "Ca(OH)2 + NH4Cl -> CaCl2 + NH3 + H2O",
    "PCl5 + H2O -> H3PO4 + HCl",
    "PCl3 + H2O -> H3PO3 + HCl",
    "XeF6 + H2O -> XeO3 + HF",
    "C3H5(NO3)3 -> CO2 + N2 + O2 + H2O",
    "Au + HNO3 + HCl -> HAuCl4 + NO + H2O",
  ];

  function genClassic() {
    return fromText(pick(CLASSICS), "Redox & more");
  }

  const GENERATORS = [
    { weight: 3, make: genCombustion },
    { weight: 2, make: genSynthesis },
    { weight: 2, make: genDecomposition },
    { weight: 3, make: genSingleReplacement },
    { weight: 3, make: genDoubleReplacement },
    { weight: 2, make: genAcidBase },
    { weight: 2, make: genClassic },
  ];
  const TOTAL_WEIGHT = GENERATORS.reduce((s, g) => s + g.weight, 0);

  function randomGenerator() {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const g of GENERATORS) {
      r -= g.weight;
      if (r < 0) return g;
    }
    return GENERATORS[GENERATORS.length - 1];
  }

  // ---------- Equations ----------

  function difficultyOf(coefficients, species) {
    const score =
      Math.max(...coefficients) +
      Math.max(0, species.length - 4) * 2 +
      (species.some((f) => f.includes("(")) ? 1 : 0);
    if (score <= 3) return "easy";
    if (score <= 6) return "medium";
    return "hard";
  }

  function buildEquation(type, reactants, products) {
    const coefficients = solve(reactants, products);
    if (!coefficients) return null;
    const species = reactants.concat(products);
    return {
      type,
      reactants,
      products,
      species,
      parsed: species.map(parseFormula),
      coefficients,
      difficulty: difficultyOf(coefficients, species),
      key: reactants.join("+") + "->" + products.join("+"),
    };
  }

  // level: "easy" | "medium" | "hard" | "mixed"; recent: keys to avoid repeating.
  // The reaction type is chosen first, then an equation of that type at the
  // requested level, so each level gets a fair mix of types.
  function randomEquation(level = "mixed", recent = []) {
    let fallback = null;
    for (let round = 0; round < 60; round++) {
      const gen = randomGenerator();
      for (let tries = 0; tries < 40; tries++) {
        const raw = gen.make();
        if (!raw) continue;
        const eq = buildEquation(raw.type, raw.reactants, raw.products);
        if (!eq) continue;
        if (level !== "mixed" && eq.difficulty !== level) continue;
        fallback = fallback || eq;
        // Equations that are already balanced are fine now and then, not often.
        if (eq.coefficients.every((c) => c === 1) && Math.random() > 0.1) continue;
        if (recent.includes(eq.key)) continue;
        return eq;
      }
    }
    return fallback;
  }

  // Atom totals for each side given the coefficients (NaN for an invalid entry).
  function countAtoms(eq, coefficients) {
    const elements = [];
    eq.parsed.forEach((p) =>
      Object.keys(p).forEach((el) => {
        if (!elements.includes(el)) elements.push(el);
      })
    );
    return elements.map((el) => {
      let left = 0;
      let right = 0;
      eq.parsed.forEach((p, i) => {
        const n = (p[el] || 0) * coefficients[i];
        if (i < eq.reactants.length) left += n;
        else right += n;
      });
      return { element: el, left, right };
    });
  }

  // ---------- Hints ----------

  const TYPE_TIPS = {
    Combustion:
      "Combustion: balance C first, then H, and O last. If O₂ needs a half (like 7/2), double every coefficient.",
    Synthesis:
      "Synthesis: balance the atoms in the product first. Gases like O₂, N₂ and Cl₂ come in pairs, so fix them last.",
    Decomposition:
      "Decomposition: one compound breaks apart. Balance the atoms in the products that are compounds first, free elements (like O₂) last.",
    "Single replacement":
      "Single replacement: one element trades places with another. Keep polyatomic ions (SO₄, NO₃…) together as one unit.",
    "Double replacement":
      "Double replacement: the partners swap. Count polyatomic ions (SO₄, NO₃, PO₄…) as single units — much faster than counting O.",
    "Acid–base":
      "Acid–base: balance the metal and the acid's ion first, then H and O (in the water) last.",
    "Redox & more":
      "Tough one: start with the element in the most complex compound, use a fraction if you need to, and leave O and H for last.",
  };

  const POLYATOMIC = ["SO4", "NO3", "PO4", "CO3", "OH", "NH4", "ClO3"];

  function startHint(eq) {
    const nR = eq.reactants.length;
    const candidates = [];
    countAtoms(eq, eq.coefficients).forEach(({ element }) => {
      const left = eq.parsed.slice(0, nR).filter((p) => p[element]).length;
      const right = eq.parsed.slice(nR).filter((p) => p[element]).length;
      if (left === 1 && right === 1) candidates.push(element);
    });
    const best = candidates.find((el) => el !== "O" && el !== "H") || candidates[0];
    let text = best
      ? "Start with " + best + " — it shows up in only one substance on each side."
      : "Start with the most complicated substance: give it a 1, then balance everything around it.";
    if (best && candidates.includes("O") && best !== "O") text += " Save O and H for last.";

    if (["Single replacement", "Double replacement", "Acid–base"].includes(eq.type)) {
      const ions = POLYATOMIC.filter(
        (ion) => eq.reactants.some((f) => f.includes(ion)) && eq.products.some((f) => f.includes(ion))
      );
      if (ions.length) {
        text += " Treat " + ions.map(formulaText).join(" and ") + " as a single unit on both sides.";
      }
    }
    return text;
  }

  // Index of the substance with the most atoms; revealing it helps the most.
  function biggestSpecies(eq) {
    let best = 0;
    let bestAtoms = -1;
    eq.parsed.forEach((p, i) => {
      const atoms = Object.values(p).reduce((s, n) => s + n, 0);
      if (atoms > bestAtoms) {
        best = i;
        bestAtoms = atoms;
      }
    });
    return best;
  }

  const Chem = {
    gcd,
    parseFormula,
    formulaHTML,
    formulaText,
    equationText,
    solve,
    compound,
    buildEquation,
    randomEquation,
    countAtoms,
    startHint,
    biggestSpecies,
    TYPE_TIPS,
    // Exposed for tests.
    _generators: GENERATORS.map((g) => g.make),
    _classics: CLASSICS,
    _fromText: fromText,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Chem;
  else root.Chem = Chem;
})(typeof window !== "undefined" ? window : globalThis);

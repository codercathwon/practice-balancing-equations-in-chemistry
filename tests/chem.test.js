const test = require("node:test");
const assert = require("node:assert/strict");
const Chem = require("../public/chem.js");

function assertBalanced(eq) {
  for (const { element, left, right } of Chem.countAtoms(eq, eq.coefficients)) {
    assert.equal(left, right, `${eq.key}: ${element} is ${left} vs ${right}`);
  }
  assert.equal(eq.coefficients.reduce(Chem.gcd), 1, `${eq.key}: not in lowest terms`);
}

test("parses formulas with parentheses", () => {
  assert.deepEqual(Chem.parseFormula("Al2(SO4)3"), { Al: 2, S: 3, O: 12 });
  assert.deepEqual(Chem.parseFormula("(NH4)2Cr2O7"), { N: 2, H: 8, Cr: 2, O: 7 });
  assert.deepEqual(Chem.parseFormula("C2H5OH"), { C: 2, H: 6, O: 1 });
  assert.deepEqual(Chem.parseFormula("CO"), { C: 1, O: 1 });
  assert.deepEqual(Chem.parseFormula("Co"), { Co: 1 });
});

test("builds ionic compounds from charges", () => {
  assert.equal(Chem.compound("Al", "SO4"), "Al2(SO4)3");
  assert.equal(Chem.compound("Ca", "PO4"), "Ca3(PO4)2");
  assert.equal(Chem.compound("NH4", "SO4"), "(NH4)2SO4");
  assert.equal(Chem.compound("Na", "Cl"), "NaCl");
  assert.equal(Chem.compound("Fe3", "OH"), "Fe(OH)3");
  assert.equal(Chem.compound("H", "PO4"), "H3PO4");
});

test("solves known equations", () => {
  const cases = [
    ["C3H8 + O2 -> CO2 + H2O", [1, 5, 3, 4]],
    ["C2H6 + O2 -> CO2 + H2O", [2, 7, 4, 6]],
    ["Al + O2 -> Al2O3", [4, 3, 2]],
    ["KClO3 -> KCl + O2", [2, 2, 3]],
    ["Cu + HNO3 -> Cu(NO3)2 + NO + H2O", [3, 8, 3, 2, 4]],
    ["KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O", [2, 16, 2, 2, 5, 8]],
    ["Ca3(PO4)2 + SiO2 + C -> CaSiO3 + P4 + CO", [2, 6, 10, 6, 1, 10]],
    ["Al2(SO4)3 + Ba(NO3)2 -> BaSO4 + Al(NO3)3", [1, 3, 3, 2]],
  ];
  for (const [text, expected] of cases) {
    const { reactants, products } = Chem._fromText(text);
    assert.deepEqual(Chem.solve(reactants, products), expected, text);
  }
});

test("rejects equations without a unique answer", () => {
  assert.equal(Chem.solve(["H2", "O2"], ["H2O", "H2O2"]), null);
  assert.equal(Chem.solve(["Na"], ["Cl2"]), null);
});

test("every classic equation solves", () => {
  for (const text of Chem._classics) {
    const raw = Chem._fromText(text, "Redox & more");
    const eq = Chem.buildEquation(raw.type, raw.reactants, raw.products);
    assert.ok(eq, `${text} has no unique solution`);
    assertBalanced(eq);
  }
});

test("every generator produces balanced equations", () => {
  for (const make of Chem._generators) {
    let built = 0;
    for (let i = 0; i < 400; i++) {
      const raw = make();
      if (!raw) continue;
      const eq = Chem.buildEquation(raw.type, raw.reactants, raw.products);
      assert.ok(eq, `generator ${make.name} made unsolvable ${raw.reactants} -> ${raw.products}`);
      assertBalanced(eq);
      built++;
    }
    assert.ok(built > 100, `${make.name} rarely produces anything (${built})`);
  }
});

test("each difficulty has plenty of variety", () => {
  for (const level of ["easy", "medium", "hard", "mixed"]) {
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      const eq = Chem.randomEquation(level, []);
      assert.ok(eq);
      if (level !== "mixed") assert.equal(eq.difficulty, level);
      seen.add(eq.key);
    }
    assert.ok(seen.size > 40, `${level}: only ${seen.size} distinct equations`);
  }
});

test("avoids recently seen equations", () => {
  const recent = [];
  for (let i = 0; i < 30; i++) {
    const eq = Chem.randomEquation("medium", recent);
    assert.ok(!recent.includes(eq.key));
    recent.push(eq.key);
  }
});

test("hints mention a starting element", () => {
  const eq = Chem.buildEquation("Combustion", ["C3H8", "O2"], ["CO2", "H2O"]);
  assert.match(Chem.startHint(eq), /Start with C/);
  assert.equal(Chem.equationText(eq, eq.coefficients), "C₃H₈ + 5 O₂ → 3 CO₂ + 4 H₂O");
});

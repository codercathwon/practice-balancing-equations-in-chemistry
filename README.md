# Practice Balancing Equations in Chemistry

A simple website for practicing how to balance chemical equations. Every problem is generated randomly, so you can keep practicing for as long as you want.

## Features

- **Endless random equations.** About 800 different equations across seven reaction types: combustion, synthesis, decomposition, single replacement, double replacement, acid–base, and harder redox reactions.
- **Four difficulty levels.** Easy, Medium, Hard, or Mixed.
- **Live atom tally.** Right under the equation, each element gets a row like `3 – C – 1` (reactants – element – products). Rows turn green as they balance.
- **Step-by-step hints.** First a strategy for the reaction type, then which element to start with, then one coefficient filled in for you.
- **Score tracking.** Counts how many you've solved, your current streak, and your best streak. They're saved in your browser.
- Works on phones, and supports light and dark mode.

## How it works

`public/chem.js` builds equations from real ion charges, simplified solubility rules, and the metal activity series, so the reactions make chemical sense. It also has a list of classic textbook reactions. Each equation is solved exactly with fraction-based Gaussian elimination, and only equations with a single whole-number answer are used. Difficulty is based on the size of the coefficients, the number of substances, and whether the equation has parentheses.

## Run locally

It's a static site with no build step. Serve the `public/` folder however you like:

```sh
npx serve public
# or
python3 -m http.server --directory public
```

## Tests

```sh
npm test
```

The tests check the formula parser and the solver against known answers. They also run every generator hundreds of times to confirm each equation balances and is in lowest terms.

## Deploy

On [Vercel](https://vercel.com/new), import this repository and click **Deploy**. `vercel.json` already points Vercel at the `public/` folder, so you don't need to change any settings.

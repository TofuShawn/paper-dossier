/**
 * Lint configuration — correctness only.
 *
 * Division of labour, because two tools that both have opinions about code
 * layout will fight and the loser is whoever reads the diff:
 *
 *   Prettier   how it looks. Never argues, never decides anything.
 *   ESLint     what is wrong. This file. No stylistic rules at all.
 *   check.mjs  the project's own invariants — tokens, colour containment —
 *              which no general-purpose linter knows about.
 *   probe.mjs  geometry, which needs a browser.
 *
 * So there is no `eslint-config-prettier` here and no formatting rule below:
 * with no style rules enabled there is nothing to switch off.
 *
 * The one opinion this file does hold: an unused variable, a floating promise
 * or a missing `await` is a real defect in a script that writes the generated
 * stylesheet and runs in CI, even though nothing here is a web app.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default tseslint.config(
  {
    // Not source. `dist` is build output, `.generated` is written by
    // `scope-skins.mjs` on every build, `.local` is machine-local tooling
    // that is never published, and `docs/shots*` is ~62MB of PNGs.
    ignores: [
      'dist/**',
      'node_modules/**',
      '.astro/**',
      '.npm-cache/**',
      '.local/**',
      'src/skins/.generated/**',
      'docs/shots*/**',
      'docs/ref/**',
      'public/plates/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,

  /* ---------------------------------------------------------- node scripts -- */
  {
    // `scripts/*.mjs` are Node programs run directly. They are the part of
    // this repo that can actually break a build, so they get the strict set.
    files: ['scripts/**/*.mjs', '*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2024 },
      ecmaVersion: 2024,
      sourceType: 'module',
    },
    rules: {
      // A promise nobody awaits in `scope-skins.mjs` or `verify.mjs` means CI
      // reports a pass before the check finishes. That is the failure mode
      // worth a linter.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      // Stays strict. An empty `catch {}` around `localStorage` is defensible —
      // storage throws in private mode and the right response is to carry on
      // with the feature off — but "defensible" has to be written down, so the
      // two blocks in `lone-trail/client.ts` say why instead of being blank.
      'no-empty': 'error',
      // Deliberate: these scripts parse CSS and HTML with regexes and index
      // into arrays constantly. The rule fires on idioms that are correct here
      // (checking `null` before indexing, char comparison in the tokenizer) and
      // silencing it per-line in a 400-line parser would be worse than
      // silencing it here.
      'no-prototype-builtins': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },

  /* ------------------------------------------------------------ browser TS -- */
  {
    // `src/**` compiles into the page, so it runs in a browser and has DOM
    // globals. Not type-checked (`astro check` is not wired up here); the
    // TS config is syntactic plus the recommended correctness set.
    files: ['src/**/*.ts', 'src/**/*.astro'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaVersion: 2024, sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // The skins read `getComputedStyle(...).getPropertyValue(...)` and cast
      // to whatever the DOM is about to give them; `any` is how that arrives.
      '@typescript-eslint/no-explicit-any': 'warn',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },

  /* ------------------------------------------------- canvas scene (ES5-ish) -- */
  {
    // Terminal's `Chrome.astro` carries a ~250-line inline canvas scene written
    // in ES5 style: `var`, function expressions, numeric loops. It predates
    // this linter and it is *drawn*, not merely executed — the values that come
    // out of it are pixels, and several are captured across `var`'s function
    // scope (the orbit radius, the current `rgb` string).
    //
    // `no-var` is a layout preference here, not a defect, and converting 111
    // `var`s to `let` in code whose entire output is a picture — with no test
    // that can assert the picture is unchanged — is how a colour silently
    // shifts. So the rule stays off for this one block, and the correctness
    // rules below stay on.
    // `eslint-plugin-astro` does not lint an `.astro` file as one unit: it
    // splits it into virtual files — `Chrome.astro/0_0.ts` is the frontmatter
    // and `<script>` island, `Chrome.astro/1_0.ts` the next block. A glob on
    // `**/*.astro` matches the container, not those, so the rule has to be
    // turned off for the virtual path as well or it silently stays on.
    files: ['src/skins/terminal/Chrome.astro', 'src/skins/terminal/Chrome.astro/**'],
    rules: {
      'no-var': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          args: 'after-used',
        },
      ],
    },
  },

  /* ------------------------------------------------------------- astro bits -- */
  {
    // `.astro` frontmatter is TypeScript in a template. The default Astro
    // ruleset already assumes this; this block only turns down rules that
    // assume a component library with props that are all required.
    files: ['**/*.astro'],
    rules: {
      'astro/no-set-html-directive': 'off',
    },
  },

  /* ------------------------------------------------------------- TypeScript -- */
  {
    files: ['**/*.ts'],
    rules: {
      // Every skin's `client.ts` guards against a missing element before
      // touching it; `!` after that guard is the idiomatic expression of
      // "the guard above proved this", and demanding a cast instead makes the
      // guard harder to read.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  }
);

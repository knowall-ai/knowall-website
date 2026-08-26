import next from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';

// ESLint flat config (required by eslint-config-next 16). eslint-config-next 16
// ships native flat configs (arrays), so they are spread directly rather than
// wrapped in FlatCompat. Pinned to ESLint 9 via package.json overrides — the
// bundled plugins target ESLint 9, not 10.
const eslintConfig = [
  {
    ignores: ['.next/**', 'out/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts'],
  },
  ...next,
  prettier,
  {
    // eslint-config-next 16 bundles react-hooks 7, which adds the new
    // React-Compiler advisory rules (set-state-in-effect / use-memo / purity).
    // The codebase (incl. vendored shadcn/ui) predates them and hasn't opted
    // into React Compiler linting, so they're disabled here for the Next 16
    // upgrade rather than refactoring working components. Revisit if/when the
    // React Compiler is adopted.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/purity': 'off',
    },
  },
];

export default eslintConfig;

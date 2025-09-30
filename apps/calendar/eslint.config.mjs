import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'docs/**'],
  },
  {
    rules: {
      // TypeScript handles these better than ESLint
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          // Don't warn on unused function arguments
          args: 'after-used',
          // Allow unused variables that start with _
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // Don't warn on unused caught errors
          caughtErrors: 'none',
          // Allow destructured arrays to have unused elements
          ignoreRestSiblings: true,
        },
      ],

      // React Hooks - be more intelligent about dependencies
      'react-hooks/exhaustive-deps': [
        'warn',
        {
          // Allow stable dependencies that don't need to be in deps array
          additionalHooks: '(useAnimationFrame|useMemoizedCallback)',
        },
      ],

      // Allow console statements in development
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

      // TypeScript makes these redundant
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Allow unused expressions for optional chaining
      '@typescript-eslint/no-unused-expressions': [
        'warn',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],

      // Be less strict about import ordering
      'import/order': 'off',

      // Next.js specific
      '@next/next/no-img-element': 'off', // We handle this with next/image when needed

      // Accessibility - warn instead of error
      'jsx-a11y/role-supports-aria-props': 'warn',
      'jsx-a11y/aria-props': 'warn',
    },
  },
];

export default eslintConfig;

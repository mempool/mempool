import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

// Flat config migrated from legacy .eslintrc
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'src/resources/**',
      // Keep parity with legacy .eslintignore
      'frontend/**',
      'server.run.js',
    ],
  },
  js.configs.recommended,
  // Node globals for local JS utility scripts in this package
  {
    // Apply to all JS files in this package (including nested ones)
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        InitWally: 'readonly',
        document: 'readonly',
        window: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      // Make common browser globals available in TS as well
      globals: {
        document: 'readonly',
        window: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Adjust base recommended rules for TypeScript (matches legacy extends: plugin:@typescript-eslint/eslint-recommended)
      ...tsPlugin.configs['eslint-recommended']?.overrides?.[0]?.rules,
      // Start from @typescript-eslint's recommended rules
      ...tsPlugin.configs.recommended.rules,

      // Project-specific rules migrated from .eslintrc
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-var-requires': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'no-case-declarations': 'warn',
      'no-console': 'warn',
      'no-constant-condition': 'warn',
      'no-dupe-else-if': 'warn',
      'no-empty': 'warn',
      'no-extra-boolean-cast': 'warn',
      'no-prototype-builtins': 'warn',
      'no-self-assign': 'warn',
      'no-useless-catch': 'warn',
      'no-var': 'warn',
      'prefer-const': 'warn',
      'prefer-rest-params': 'warn',
      'quotes': ['warn', 'single', { allowTemplateLiterals: true }],
      'semi': 'warn',
      'curly': ['warn', 'all'],
      'eqeqeq': 'warn',
      'no-trailing-spaces': 'warn',
    },
  },
];

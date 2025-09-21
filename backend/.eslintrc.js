module.exports = {
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "tsconfigRootDir": __dirname
  },
  "plugins": [
    "@typescript-eslint",
    "local-rules"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "ignorePatterns": ["dist", "eslint-local-rules", ".eslintrc.js", "testSetup.ts", "__tests__", "*.config.ts"],
  "rules": {
    "@typescript-eslint/ban-ts-comment": 1,
    "@typescript-eslint/ban-types": 1,
    "@typescript-eslint/no-empty-function": 1,
    "@typescript-eslint/no-explicit-any": 1,
    "@typescript-eslint/no-inferrable-types": 0,
    "@typescript-eslint/no-namespace": 1,
    "@typescript-eslint/no-this-alias": 1,
    "@typescript-eslint/no-var-requires": 1,
    "@typescript-eslint/explicit-function-return-type": 1,
    "@typescript-eslint/no-unused-vars": 1,
    "@typescript-eslint/no-floating-promises": "error",
    "local-rules/no-unhandled-await": "error",
    "no-console": 1,
    "no-constant-condition": 1,
    "no-dupe-else-if": 1,
    "no-empty": 1,
    "no-prototype-builtins": 1,
    "no-self-assign": 1,
    "no-useless-catch": 1,
    "no-var": 1,
    "prefer-const": 1,
    "prefer-rest-params": 1,
    "quotes": [1, "single", { "allowTemplateLiterals": true }],
    "semi": 1,
    "curly": [1, "all"],
    "eqeqeq": 1,
    "no-trailing-spaces": 1
  }
}

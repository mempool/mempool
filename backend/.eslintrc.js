const path = require('path');

module.exports = {
    env: {
        node: true
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: path.join(__dirname, "tsconfig.json"),
        sourceType: "module"
    },
    plugins: [
        "@typescript-eslint",
        "prettier"
    ],
    extends: [
        "prettier"
    ],
    rules: {
        "prettier/prettier": [
            "error",
            {
                parser: "typescript",
                singleQuote: true,
                tabWidth: 2,
                endOfLine: "lf",
                trailingComma: "es5",
                arrowParens: "avoid",
                printWidth: 120
            }
        ],
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                args: "none"
            }
        ],
        "@typescript-eslint/prefer-namespace-keyword": "error",
        "@typescript-eslint/semi": [
            "error"
        ],
        "@typescript-eslint/type-annotation-spacing": "error",
        eqeqeq: [
            "warn",
            "smart"
        ],
        "id-match": "error",
        "no-eval": "error",
        "no-redeclare": "error",
        "no-var": "error"
    }
};

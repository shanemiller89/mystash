import typescriptEslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

// ─── Shared rules (both extension + webview) ─────────────────────
const sharedRules = {
    curly: "warn",
    eqeqeq: ["warn", "smart"],
    "no-throw-literal": "warn",
    semi: "warn",
    "no-unused-vars": "off", // handled by @typescript-eslint version
    "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
    }],
    "@typescript-eslint/naming-convention": ["warn", {
        selector: "import",
        format: ["camelCase", "PascalCase"],
    }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/consistent-type-imports": ["warn", {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
    }],
};

export default [
    // ─── Global ignores ───────────────────────────────────────
    {
        ignores: [
            "dist/**",
            "out/**",
            "node_modules/**",
            "webview-ui/node_modules/**",
            "**/*.js",
            "**/*.mjs",
        ],
    },

    // ─── Extension host: src/**/*.ts ──────────────────────────
    {
        files: ["src/**/*.ts"],
        plugins: {
            "@typescript-eslint": typescriptEslint.plugin,
        },
        languageOptions: {
            parser: typescriptEslint.parser,
            ecmaVersion: 2022,
            sourceType: "module",
        },
        rules: {
            ...sharedRules,
        },
    },

    // ─── Webview: webview-ui/src/**/*.{ts,tsx} ────────────────
    {
        files: ["webview-ui/src/**/*.{ts,tsx}"],
        plugins: {
            "@typescript-eslint": typescriptEslint.plugin,
            "react": reactPlugin,
            "react-hooks": reactHooksPlugin,
        },
        languageOptions: {
            parser: typescriptEslint.parser,
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        settings: {
            react: { version: "detect" },
        },
        rules: {
            ...sharedRules,
            // React rules
            "react/jsx-key": "warn",
            "react/jsx-no-duplicate-props": "error",
            "react/jsx-no-undef": "error",
            "react/no-children-prop": "warn",
            "react/no-danger-with-children": "error",
            "react/no-deprecated": "warn",
            "react/no-direct-mutation-state": "error",
            "react/no-unescaped-entities": "warn",
            "react/self-closing-comp": "warn",

            // React Hooks rules
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",

            // Relax naming convention for JSX components that use destructured props
            "@typescript-eslint/naming-convention": "off",
        },
    },

    // ─── Test files: relax some rules ─────────────────────────
    {
        files: ["src/test/**/*.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": "off",
        },
    },
];
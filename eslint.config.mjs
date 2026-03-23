// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default defineConfig(eslint.configs.recommended, tseslint.configs.recommended, {
    rules: {
        "prefer-const": "error",
        "max-lines-per-function": ["warn"],
        "max-lines": ["warn"],
        "max-params": ["warn", { max: 3 }],
        "max-nested-callbacks": ["warn", { max: 3 }],
        "max-depth": ["warn", { max: 4 }],
        "max-len": ["warn", { code: 100 }],
    },
},
stylistic.configs.customize({
    // the following options are the default values
    "indent": 4,
    "quotes": "double",
    "semi": true,
    "no-mixed-spaces-and-tabs": ["error"],
    // ...
}));

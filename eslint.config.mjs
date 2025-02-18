import globals from "globals";
import pluginJs from "@eslint/js";
import foundryGlobals from "./eslint-config-foundry.js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['foundry.js']
  },
  {
    languageOptions: { 
      globals: {
        ...globals.browser,
        ...globals.node
      } 
    }
  },
  ...foundryGlobals,
  pluginJs.configs.recommended,
];
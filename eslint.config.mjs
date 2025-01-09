import globals from "globals";
import pluginJs from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
	pluginJs.configs.recommended,
	eslintConfigPrettier,
	{
		name: "mat-eslint-file",
		languageOptions: {
			globals: {
				// Foundry globals - writeable
				game: "writeable",
				Roll: "writeable",
				// Foundry globals - readonly
				$: "readonly",
				Hooks: "readonly",
				foundry: "readonly",
				canvas: "readonly",
				ui: "readonly",
				Die: "readonly",
				renderTemplate: "readonly",
				getProperty: "readonly",
				FormApplication: "readonly",
				Dialog: "readonly",
				Macro: "readonly",
				VideoHelper: "readonly",
				ChatMessage: "readonly",
				// 3rd party module globals
				MidiQOL: "readonly",
				AutomatedAnimations: "readonly",
				// Browser globals
				...globals.browser,
			},
		},
		ignores: ["/**/foundry.js"],
		rules: {},
	},
];

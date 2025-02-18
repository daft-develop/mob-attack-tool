import globals from 'globals'
import pluginJs from '@eslint/js'
import foundryGlobals from './eslint-config-foundry.js'
import stylistic from '@stylistic/eslint-plugin'
import pluginMocha from 'eslint-plugin-mocha'
import pluginCypress from 'eslint-plugin-cypress/flat'
import pluginChaiFriendly from 'eslint-plugin-chai-friendly'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['foundry.js'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@sytlistic': stylistic,
    },
  },
  ...foundryGlobals,
  pluginJs.configs.recommended,
  stylistic.configs.customize({
    flat: true,
    indent: 2,
    quotes: 'single',
    semi: false,
  }),
  {
    name: 'cypress-specific-rules',
    files: ['cypress/**/*.js'],
    ...pluginMocha.configs.flat.recommended,
    ...pluginCypress.configs.recommended,
    ...pluginChaiFriendly.configs.recommendedFlat,
    plugins: {
      mocha: pluginMocha,
    },
    rules: {
      'mocha/no-exclusive-tests': 'warn',
      'mocha/no-skipped-tests': 'warn',
      'mocha/no-mocha-arrows': 'off',
      'cypress/no-unnecessary-waiting': 'off',
    },
  },
]

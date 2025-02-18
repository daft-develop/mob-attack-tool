import globals from 'globals'
import pluginJs from '@eslint/js'
import foundryGlobals from './eslint-config-foundry.js'
import stylistic from '@stylistic/eslint-plugin'

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
]

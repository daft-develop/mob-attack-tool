// globals from Foundry to ignore during linting
export default [
  {
    name: 'mat-eslint-file',
    languageOptions: {
      globals: {
        // Foundry globals - writeable
        game: 'writeable',
        Roll: 'writeable',
        // Foundry globals - readonly
        $: 'readonly',
        dnd5e: 'readonly',
        Hooks: 'readonly',
        CONFIG: 'readonly',
        foundry: 'readonly',
        canvas: 'readonly',
        ui: 'readonly',
        Die: 'readonly',
        renderTemplate: 'readonly',
        FormApplication: 'readonly',
        Dialog: 'readonly',
        Macro: 'readonly',
        VideoHelper: 'readonly',
        ChatMessage: 'readonly',
        // 3rd party module globals
        MidiQOL: 'readonly',
        AutomatedAnimations: 'readonly',
      },
    },
  },
]

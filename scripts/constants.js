// Module-wide constants. This file must not import anything: it is imported
// by most other modules, including in class bodies that run at load time,
// so it has to be fully evaluated before any of them.

// Must match "id" in module.json
export const moduleName = 'mob-attack-tool'

/**
 * Path to one of this module's Handlebars templates, as Foundry expects it
 * @param {string} relativePath - path below templates/, e.g. 'dialog/mat-dialog-weapons.hbs'
 * @returns {string} e.g. 'modules/mob-attack-tool/templates/dialog/mat-dialog-weapons.hbs'
 */
export function templatePath(relativePath) {
  return `modules/${moduleName}/templates/${relativePath}`
}

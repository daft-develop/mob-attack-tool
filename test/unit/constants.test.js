import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { moduleName, templatePath } from '../../scripts/constants.js'

describe('moduleName', () => {
  it('matches the id in module.json', () => {
    // vitest runs from the project root; import.meta.url is not a file: URL under jsdom
    const manifest = JSON.parse(readFileSync('module.json', 'utf8'))
    expect(moduleName).toBe(manifest.id)
  })
})

describe('templatePath', () => {
  it('builds the path Foundry loads templates from', () => {
    expect(templatePath('dialog/mat-dialog-weapons.hbs'))
      .toBe(`modules/${moduleName}/templates/dialog/mat-dialog-weapons.hbs`)
  })
})

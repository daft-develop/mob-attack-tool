// Verifies that every ES module import and template path in scripts/ resolves
// to a real file. ESLint's no-undef catches missing names, but not a relative
// path that points at a moved or deleted file, which stops Foundry loading the
// whole module. Bare specifiers (e.g. 'foundry.utils') are rejected because a
// browser cannot resolve them without an import map.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const moduleId = JSON.parse(readFileSync(join(root, 'module.json'), 'utf8')).id
const modulePrefix = `modules/${moduleId}/`

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (path.endsWith('.js') || path.endsWith('.mjs')) yield path
  }
}

const importPattern = /(?:\bimport\s[^'"]*?\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bexport\s[^'"]*?\bfrom\s*)(['"])([^'"]+)\1/g
const templatePattern = new RegExp(`(['"\`])(?:/)?${modulePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^'"\`]+\\.hbs)\\1`, 'g')

const problems = []
for (const file of walk(join(root, 'scripts'))) {
  const source = readFileSync(file, 'utf8')
    .split('\n')
    .map(line => (line.trimStart().startsWith('//') ? '' : line))
    .join('\n')
  const rel = relative(root, file)

  for (const [, , specifier] of source.matchAll(importPattern)) {
    if (specifier.startsWith('.')) {
      if (!existsSync(resolve(dirname(file), specifier))) {
        problems.push(`${rel}: import '${specifier}' does not resolve`)
      }
    }
    else if (!specifier.startsWith('/')) {
      problems.push(`${rel}: bare import '${specifier}' cannot be resolved by the browser`)
    }
  }

  for (const [, , templatePath] of source.matchAll(templatePattern)) {
    if (!existsSync(join(root, templatePath))) {
      problems.push(`${rel}: template '${modulePrefix}${templatePath}' does not exist`)
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} unresolved path(s)`)
  process.exit(1)
}
console.log('All imports and template paths resolve.')

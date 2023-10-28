const { join } = require('path')
const semver = require('semver')
const Arborist = require('@npmcli/arborist')

const run = async (path, useEngines) => {
  const pkgPath = join(path, 'package.json')
  const pkg = require(pkgPath)

  const engines = useEngines || pkg.engines.node

  const arb = new Arborist({ path })
  const tree = await arb.loadActual({ forceActual: true })
  const deps = await tree.querySelectorAll(`#${pkg.name} > .prod:attr(engines, [node])`)

  const invalid = []
  for (const dep of deps) {
    const depEngines = dep.target.package.engines.node
    if (!semver.subset(engines, depEngines)) {
      invalid.push({
        name: `${dep.name}@${dep.version}`,
        location: dep.location,
        engines: depEngines
      })
    }
  }

  if (invalid.length) {
    const msg = 'The following production dependencies are not compatible with ' +
`\`engines.node: ${engines}\` found in \`${pkgPath}\`:\n` + invalid.map((dep) => [
  `${dep.name}:`,
  `  engines.node: ${dep.engines}`,
  `  location: ${dep.location}`
    ].join('\n')).join('\n')
    throw new Error(msg)
  }
}

run(process.cwd(), ...process.argv.slice(2)).then(() => console.log('Success')).catch((err) => {
  console.error(err)
  process.exitCode = 1
})

#!/usr/bin/env node

import {request} from 'undici'
import {execFile} from 'child_process'
import {promisify} from 'util'
import semver from 'semver'
import chalk from 'chalk'

const exec = promisify(execFile)

;(async () => {
  try {
    const {stdout} = await exec('npm', ['ls', '--json', '--all', '--long'], {maxBuffer: Infinity})
    const root = JSON.parse(stdout)
    if (!root.engines || !root.engines.node) {
      throw new Error('engines.node is not defined')
    }
    const versions = await fetchVersions(root.engines.node)
    if (!versions.length) {
      throw new Error(`no node versions found matching ${root.engines.node}`)
    } else if (check(versions, root.dependencies)) {
      process.exitCode = 1
    }
  } catch (e) {
    console.error(chalk.red(e.message))
    process.exitCode = 1
  }
})()

async function fetchVersions(range) {
  const {body} = await request('https://nodejs.org/dist/')
  const text = await body.text()
  const versions = []
  const regex = /([0-9]+\.[0-9]+\.[0-9]+)\/<\/a>/g
  let match

  while ((match = regex.exec(text))) {
    if (semver.satisfies(match[1], range)) {
      versions.push(match[1])
    }
  }

  return versions
}

function check(versions, packages, tree, fail) {
  for (const pkg of Object.values(packages)) {
    if (pkg.missing) {
      throw new Error('missing package detected, please run npm install first')
    }
    const range = pkg.engines && pkg.engines.node
    if (range) {
      for (const version of versions) {
        if (!semver.satisfies(version, range)) {
          console.error(
            `${tree || ''}${pkg.name}@${pkg.version} ${chalk.bold.yellow(range)}` +
              ` is not satisfied by ${chalk.bold.blue(version)}`
          )
          fail = true
          break
        }
      }
    }
    if (pkg.dependencies) {
      fail = check(versions, pkg.dependencies, `${(tree || '') + pkg.name}@${pkg.version} > `, fail)
    }
  }

  return !!fail
}

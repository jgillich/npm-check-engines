#!/usr/bin/env node

const colors = require('colors');
const semver = require('semver');
const request = require('request');
const { execFile } = require('child_process');

console.log(('checking ' + process.cwd() + '/package.json').green);

execFile('npm', ['ls', '--json', '--all', '--long'], function (err, stdout, stderr) {
  handleErr(err);
  const root = JSON.parse(stdout);
  if (!root.engines || !root.engines.node) {
    handleErr(new Error('engines.node is not defined'));
  }
  engines(root.engines.node, function (err, engines) {
    handleErr(err);
    if (!check(engines, root.dependencies)) {
      console.log('no problems detected'.green);
    } else {
      process.exit(1);
    }
  });
});

function handleErr(err) {
  if (err) {
    console.error(err.message.red);
    process.exit(1);
  }
}

function engines(required, cb) {
  request('http://nodejs.org/dist/', function (err, res, body) {
    if (err) return cb(err);

    var supported = [];
    var regex = /([0-9]+\.[0-9]+\.[0-9]+)\/<\/a>/g;
    var match;

    while (match = regex.exec(body)) {
      if (semver.satisfies(match[1], required)) {
        supported.push(match[1]);
      }
    }
    cb(null, supported);
  });
}

function check(engines, packages, tree, fail) {
  for (const pkg of Object.values(packages)) {
    if (pkg.missing) {
      handleErr(new Error('missing package detected, please run npm install first'));
    }
    pkgTree = (tree || '') + pkg.name.red + ' ' + pkg.version;

    if (pkg.engines && pkg.engines.node) {
      engines.forEach(function (engine) {
        if (!semver.satisfies(engine, pkg.engines.node)) {
          console.error(pkgTree + ' does not satisfy engine ' + engine.green + ' (' + pkg.engines.node.red + ')')
          fail = true;
        }
      });
    }
    if (pkg.dependencies) {
      fail = check(engines, pkg.dependencies, pkgTree + ' > ', fail) || fail;
    }
  }

  return !!fail;
}

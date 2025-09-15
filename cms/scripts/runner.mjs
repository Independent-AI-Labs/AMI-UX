#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const APP_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const SH = path.join(APP_DIR, 'scripts', 'server.sh')

function run(cmd, opts={}) {
  return execSync(cmd, { stdio: 'inherit', ...opts })
}

function getPortArg() {
  const i = process.argv.findIndex(a => /^\d+$/.test(a))
  return i > 1 ? process.argv[i] : undefined
}

function usage() {
  console.log('Usage: node scripts/runner.mjs <start|stop|restart|status|kill-orphans> [port] [--dev] [--nowait] [--kill-orphans]')
}

const cmd = process.argv[2]
if (!cmd) { usage(); process.exit(2) }

const port = getPortArg() || process.env.PORT || '3000'
const flags = process.argv.slice(3).filter(a => !/^\d+$/.test(a)).join(' ')

try {
  switch (cmd) {
    case 'start':
    case 'stop':
    case 'restart':
    case 'status':
    case 'kill-orphans':
      run(`${SH} ${cmd} ${port} ${flags}`, { cwd: APP_DIR })
      break
    default:
      usage(); process.exit(2)
  }
} catch (e) {
  process.exit(typeof e.status === 'number' ? e.status : 1)
}

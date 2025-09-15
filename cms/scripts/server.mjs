#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const APP_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const TMP = os.tmpdir()

function pidFile(port) { return path.join(TMP, `docs-web-${port}.pid`) }
function portFile(port) { return path.join(TMP, `docs-web-${port}.port`) }
function logFile(port) { return path.join(TMP, `docs-web-${port}.log`) }

function arg(flag, def = null) {
  const i = process.argv.indexOf(flag)
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]
  return def
}

function has(flag) { return process.argv.includes(flag) }

function getBasePort() {
  const p = Number(arg('--port') || process.env.PORT || 3000)
  return Number.isFinite(p) && p > 0 ? p : 3000
}

async function sleep(ms) { await new Promise(r => setTimeout(r, ms)) }

async function httpOk(url, timeoutMs = 1000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), timeoutMs)
  try { const r = await fetch(url, { signal: c.signal }); return r.ok } catch { return false } finally { clearTimeout(t) }
}

function listeningOn(port) {
  try {
    // Try ss first
    const out = execSync('ss -ltnp', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\n+/).find(l => l.includes(`:${port}`))
    return !!out
  } catch {
    try {
      const out = execSync(`lsof -ti :${port} -sTCP:LISTEN`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      return !!out
    } catch { return false }
  }
}

function listenerPid(port) {
  try {
    const out = execSync('ss -ltnp', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const line = out.split(/\n+/).find(l => l.includes(`:${port}`)) || ''
    const m = line.match(/pid=(\d+)/)
    return m ? Number(m[1]) : null
  } catch {
    try {
      const out = execSync(`lsof -ti :${port} -sTCP:LISTEN`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      return out ? Number(out.split(/\s+/)[0]) : null
    } catch { return null }
  }
}

function readPid(p) { try { return Number(fs.readFileSync(p, 'utf8')) } catch { return null } }
function writePid(p, v) { fs.writeFileSync(p, String(v)) }

function killPidTree(pid) {
  if (!pid) return
  try { process.kill(-pid) } catch {}
  try { process.kill(pid) } catch {}
}

function killOrphans() {
  try {
    const out = execSync('ps -eo pid,command', { encoding: 'utf8' })
    const lines = out.split(/\n+/).filter(Boolean)
    const victims = lines
      .filter(l => /next (dev|start)/.test(l) && l.includes(APP_DIR))
      .map(l => Number(l.trim().split(/\s+/, 1)[0]))
    if (victims.length) {
      for (const pid of victims) { try { process.kill(pid, 'SIGKILL') } catch {} }
      console.log('Killed orphan next processes:', victims.join(', '))
    }
  } catch {}
}

async function cmdStart() {
  const dev = has('--dev') || process.env.DEV === '1'
  const anyport = has('--anyport')
  const waitSecs = Number(arg('--wait', '10'))
  const nowait = has('--nowait')
  const base = getBasePort()
  const candidates = anyport ? [base, base + 1000, base + 2000] : [base]
  candidates.push(0)
  for (let p of candidates) {
    if (p === 0) p = 40000 + Math.floor(Math.random() * 20000)
    // Clean existing PID if stale
    const pf = pidFile(p)
    const pid = readPid(pf)
    if (pid && !listeningOn(p)) { try { fs.unlinkSync(pf) } catch {} }
    // Try spawn
    const log = logFile(p); fs.writeFileSync(log, '')
    const args = [dev ? 'dev' : 'start', '-p', String(p)]
    const child = spawn(path.join(APP_DIR, 'node_modules/.bin/next'), args, {
      cwd: APP_DIR,
      env: { ...process.env, HOST: '0.0.0.0' },
      shell: false,
      detached: true,
      stdio: ['ignore', fs.openSync(log, 'a'), fs.openSync(log, 'a')],
    })
    writePid(pf, child.pid)
    fs.writeFileSync(portFile(p), String(p))
    console.log(`Started on port ${p} (pid ${child.pid}) | logs: ${log}`)
    if (nowait || waitSecs <= 0) { child.unref(); return }
    // Wait for readiness
    const loops = Math.max(1, Math.min(60, waitSecs * 3))
    for (let i = 0; i < loops; i++) {
      if (await httpOk(`http://127.0.0.1:${p}/api/tree`, 1000)) {
        child.unref(); console.log('Ready:', `http://127.0.0.1:${p}`); return
      }
      await sleep(333)
    }
    // If not ready, try next candidate
  }
  console.error('Failed to start on any candidate port')
  process.exitCode = 1
}

async function cmdStop() {
  const p = getBasePort()
  const pf = pidFile(p)
  const pid = readPid(pf)
  if (pid) {
    killPidTree(pid)
    try { fs.unlinkSync(pf) } catch {}
  }
  // Also kill listener on this port if different PID
  const lp = listenerPid(p)
  if (lp && lp !== pid) { try { process.kill(lp, 'SIGKILL') } catch {} }
  if (has('--kill-orphans')) killOrphans()
  console.log('Stopped (best-effort) on port', p)
}

async function cmdStatus() {
  const p = getBasePort()
  const lp = listenerPid(p)
  const ok = await httpOk(`http://127.0.0.1:${p}/api/tree`, 800)
  if (lp) console.log(`Running on port ${p} (pid ${lp}) | Ready: ${ok}`)
  else console.log(`Not running on port ${p}`)
}

async function cmdLogs() {
  const p = getBasePort()
  const log = logFile(p)
  try { const data = await fsp.readFile(log, 'utf8'); process.stdout.write(data) } catch { console.log('(no logs)') }
}

async function main() {
  const cmd = process.argv[2] || 'start'
  if (cmd === 'start') return cmdStart()
  if (cmd === 'stop') return cmdStop()
  if (cmd === 'status') return cmdStatus()
  if (cmd === 'logs') return cmdLogs()
  if (cmd === 'kill-orphans') { killOrphans(); return }
  console.log('Usage: server.mjs <start|stop|status|logs|kill-orphans> [--dev] [--port N] [--anyport] [--wait SECS] [--nowait]')
}

main().catch((e) => { console.error(e?.stack || e?.message || String(e)); process.exit(1) })


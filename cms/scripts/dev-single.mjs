import fs from 'fs/promises'
import fsSync from 'fs'
import net from 'net'
import path from 'path'
import { spawn } from 'child_process'

const APP_PORT = Number(process.env.NEXT_DEV_PORT || 3000)
const LOCK_DIR = path.resolve(process.cwd(), '.next')
const LOCK_FILE = path.join(LOCK_DIR, 'dev-server.lock')

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function isProcessAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function ensurePortFree(port) {
  await new Promise((resolve, reject) => {
    const tester = net.createServer()
    tester.unref()
    tester.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use.`))
      } else {
        reject(err)
      }
    })
    tester.listen({ port, host: '0.0.0.0', exclusive: true }, () => {
      tester.close(resolve)
    })
  })
}

async function readExistingLock() {
  if (!(await fileExists(LOCK_FILE))) return null
  try {
    const raw = await fs.readFile(LOCK_FILE, 'utf8')
    const data = JSON.parse(raw)
    if (data && typeof data.pid === 'number') return data
  } catch {
    // ignore parse errors: treat as stale and overwrite later
  }
  return null
}

async function writeLock() {
  await fs.mkdir(LOCK_DIR, { recursive: true })
  const payload = JSON.stringify({ pid: process.pid, createdAt: Date.now() })
  await fs.writeFile(LOCK_FILE, payload, { encoding: 'utf8', flag: 'w' })
}

function removeLockSync() {
  try {
    fsSync.unlinkSync(LOCK_FILE)
  } catch {
    // ignore
  }
}

async function main() {
  const existing = await readExistingLock()
  if (existing && isProcessAlive(existing.pid)) {
    console.error(`✖ Detected running dev server (pid: ${existing.pid}). Stop it before starting a new one.`)
    process.exit(1)
  }

  try {
    await ensurePortFree(APP_PORT)
  } catch (err) {
    console.error(`✖ ${err.message}`)
    console.error('   Stop the process holding the port or set NEXT_DEV_PORT to use a different one.')
    process.exit(1)
  }

  await writeLock()

  const args = ['dev', ...process.argv.slice(2)]
  const child = spawn('next', args, {
    stdio: 'inherit',
    env: process.env,
  })

  const cleanup = () => {
    removeLockSync()
  }

  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    child.kill('SIGINT')
  })
  process.on('SIGTERM', () => {
    child.kill('SIGTERM')
  })
  process.on('SIGHUP', () => {
    child.kill('SIGHUP')
  })

  child.on('exit', (code, signal) => {
    cleanup()
    if (signal) {
      process.kill(process.pid, signal)
    } else {
      process.exit(code ?? 0)
    }
  })

  child.on('error', (err) => {
    cleanup()
    console.error('Failed to start Next dev server:', err)
    process.exit(1)
  })
}

await main()

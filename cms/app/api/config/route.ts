import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

type Config = { docRoot: string, allowed?: string }

const DATA_DIR = path.resolve(process.cwd(), 'data')
const CONFIG_PATH = path.join(DATA_DIR, 'config.json')

async function ensureDataDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }) } catch {}
}

async function readConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    const cfg = JSON.parse(raw)
    return cfg
  } catch {
    return {
      docRoot: process.env.DOC_ROOT || '../../../AMI-REACH/social',
      allowed: process.env.ALLOWED_EXTENSIONS || '.md,.csv,.txt'
    }
  }
}

export async function GET() {
  const cfg = await readConfig()
  return NextResponse.json(cfg)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.docRoot !== 'string') {
    return NextResponse.json({ error: 'docRoot required' }, { status: 400 })
  }
  const candidate = body.docRoot
  const abs = path.resolve(process.cwd(), candidate)
  try {
    const st = await fs.stat(abs)
    if (!st.isDirectory()) throw new Error('Not a directory')
  } catch (e: any) {
    return NextResponse.json({ error: `Invalid directory: ${e?.message || 'stat failed'}` }, { status: 400 })
  }
  await ensureDataDir()
  const current = await readConfig()
  const next: Config = { ...current, docRoot: candidate }
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8')
  return NextResponse.json(next)
}


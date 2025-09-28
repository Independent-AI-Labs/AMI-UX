import { before, beforeEach, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

type LatexModule = typeof import('../app/api/latex/route')
type MediaModule = typeof import('../app/api/media/route')

type LatexGetResponse = Awaited<ReturnType<LatexModule['GET']>>

type JsonBody<T> = T extends Response ? Awaited<ReturnType<T['json']>> : never

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOC_ROOT_RELATIVE = 'content/docs'
const REPO_ROOT = path.resolve(__dirname, '../../..')
const REAL_TEX_SOURCE_PATH = path.join(
  REPO_ROOT,
  'compliance/docs/research/Open AMI Chapters I-IV Peer Review Draft 3.tex',
)
const REAL_TEX_BASENAME = 'open-ami-chapters.tex'
const CONFIG_TEMPLATE = {
  docRoot: DOC_ROOT_RELATIVE,
  docRootLabel: 'Docs',
}

const SAMPLE_PDF_BYTES = Buffer.from(
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUj4+CmVuZG9iagoyIDAgb2JqCjw8L1R5cGUgL1BhZ2VzIC9Db3VudCAxIC9LaWRzIFszIDAgUl0gL01lZGlhQm94IFswIDAgNjEyIDc5Ml0+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL1Jlc291cmNlcyA8PC9Gb250IDw8L0YxIDUgMCBSPj4+PiAvQ29udGVudHMgNCAwIFI+PgplbmRvYmoKNCAwIG9iago8PC9MZW5ndGggNDY+PnN0cmVhbQpCVApGLTEgMjQgVGYgNzIgNzIwIFRkIChIZWxsbyBXb3JsZCkgVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0YxIC9CYXNlRm9udCAvSGVsdmV0aWNhPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDYyIDAwMDAwIG4gCjAwMDAwMDEyMCAwMDAwMCBuIAowMDAwMDAxOTQgMDAwMDAgbiAKMDAwMDAwMjk0IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2IC9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjM4NQolJUVPRgo=',
  'base64',
)

let tempRepoRoot: string
let latexModule: LatexModule
let mediaModule: MediaModule
let complianceTexSource: string

function latexUrl(relPath: string, root = 'docRoot') {
  const url = new URL('http://localhost/api/latex')
  url.searchParams.set('path', relPath)
  url.searchParams.set('root', root)
  return url
}

function mediaUrl(relPath: string, root = 'docRoot') {
  const url = new URL('http://localhost/api/media')
  url.searchParams.set('path', relPath)
  url.searchParams.set('root', root)
  return url
}

async function writeConfig() {
  const cfgPath = path.join(tempRepoRoot, 'data', 'config.json')
  await writeFile(cfgPath, JSON.stringify(CONFIG_TEMPLATE, null, 2))
}

async function ensureDocRoot() {
  await mkdir(path.join(tempRepoRoot, DOC_ROOT_RELATIVE), { recursive: true })
}

async function writeTexSource(relPath: string, contents: string) {
  const target = path.join(tempRepoRoot, DOC_ROOT_RELATIVE, relPath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, contents)
  return target
}

async function parseJson<T>(response: LatexGetResponse): Promise<JsonBody<LatexGetResponse>> {
  const cloned = response.clone()
  const payload = await cloned.json()
  return payload as JsonBody<LatexGetResponse>
}

before(async () => {
  tempRepoRoot = await mkdtemp(path.join(os.tmpdir(), 'latex-tests-'))
  process.chdir(tempRepoRoot)
  await mkdir(path.join(tempRepoRoot, 'data'), { recursive: true })
  await ensureDocRoot()
  await writeConfig()

  complianceTexSource = await readFile(REAL_TEX_SOURCE_PATH, 'utf8')

  const latexModulePath = path.resolve(__dirname, '../app/api/latex/route.ts')
  latexModule = await import(pathToFileURL(latexModulePath).href) as LatexModule

  const mediaModulePath = path.resolve(__dirname, '../app/api/media/route.ts')
  mediaModule = await import(pathToFileURL(mediaModulePath).href) as MediaModule
})

beforeEach(async () => {
  await rm(path.join(tempRepoRoot, 'files'), { recursive: true, force: true })
  await rm(path.join(tempRepoRoot, DOC_ROOT_RELATIVE), { recursive: true, force: true })
  await ensureDocRoot()
  await writeConfig()
})

after(async () => {
  if (tempRepoRoot) {
    process.chdir(path.dirname(tempRepoRoot))
    await rm(tempRepoRoot, { recursive: true, force: true })
  }
})

test('GET marks LaTeX source as stale until a render is persisted', { concurrency: false }, async () => {
  await writeTexSource(REAL_TEX_BASENAME, complianceTexSource)

  const res = await latexModule.GET(new Request(latexUrl(REAL_TEX_BASENAME)))
  assert.equal(res.status, 200)

  const body = await parseJson(res)
  assert.equal(body.hasPdf, false)
  assert.equal(body.stale, true)
  assert.equal(body.pdfPath, null)
  assert.equal(body.metaPath, `${REAL_TEX_BASENAME}.meta`)
  assert.equal(body.headings.length, 0)
})

test('POST stores rendered PDF artefacts and GET reuses the cache', { concurrency: false }, async () => {
  const texRel = `reports/${REAL_TEX_BASENAME}`
  const texAbs = await writeTexSource(texRel, complianceTexSource)

  const initialRes = await latexModule.GET(new Request(latexUrl(texRel)))
  assert.equal(initialRes.status, 200)
  const initialBody = await parseJson(initialRes)
  assert.equal(initialBody.hasPdf, false)
  assert.equal(initialBody.stale, true)

  const form = new FormData()
  form.set('path', texRel)
  form.set('root', 'docRoot')
  form.set('headings', JSON.stringify([{ id: 'a', text: 'Intro', level: 1, page: 1 }]))
  form.set('log', 'stub log output')

  const pdfFile = new File([SAMPLE_PDF_BYTES], 'render.pdf', { type: 'application/pdf' })
  form.append('pdf', pdfFile)

  const postRes = await latexModule.POST(new Request(latexUrl(texRel), { method: 'POST', body: form }))
  assert.equal(postRes.status, 200)
  const postJson = await postRes.json()
  assert.equal(postJson.ok, true)
  assert.equal(typeof postJson.pdfPath, 'string')
  assert.equal(postJson.pdfPath, `${texRel}.meta/render.pdf`)

  const metaDir = path.join(tempRepoRoot, DOC_ROOT_RELATIVE, `${texRel}.meta`)
  const pdfPath = path.join(metaDir, 'render.pdf')
  const manifestPath = path.join(metaDir, 'manifest.json')
  const logPath = path.join(metaDir, 'compile.log')

  assert.equal(existsSync(metaDir), true)
  assert.equal(existsSync(pdfPath), true)
  assert.equal(existsSync(manifestPath), true)
  assert.equal(existsSync(logPath), true)

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const texStat = await stat(texAbs)
  assert.equal(manifest.sourceMtime, texStat.mtimeMs)
  assert.deepEqual(manifest.headings, [{ id: 'a', text: 'Intro', level: 1, page: 1 }])
  assert.equal(manifest.pdfFile, 'render.pdf')

  const cachedRes = await latexModule.GET(new Request(latexUrl(texRel)))
  assert.equal(cachedRes.status, 200)
  const cachedBody = await parseJson(cachedRes)
  assert.equal(cachedBody.hasPdf, true)
  assert.equal(cachedBody.stale, false)
  assert.equal(cachedBody.pdfPath, `${texRel}.meta/render.pdf`)
  assert.deepEqual(cachedBody.headings, [{ id: 'a', text: 'Intro', level: 1, page: 1 }])

  const mediaRes = await mediaModule.GET(new Request(mediaUrl(cachedBody.pdfPath)))
  assert.equal(mediaRes.status, 200)
  assert.equal(mediaRes.headers.get('Content-Type'), 'application/pdf')
  const mediaBytes = Buffer.from(await mediaRes.arrayBuffer())
  assert.equal(mediaBytes.equals(SAMPLE_PDF_BYTES), true)
})

test('GET reports cached renders as stale when the source file changes', { concurrency: false }, async () => {
  const texRel = `stale/${REAL_TEX_BASENAME}`
  await writeTexSource(texRel, complianceTexSource)

  const form = new FormData()
  form.set('path', texRel)
  form.set('root', 'docRoot')
  form.set('headings', JSON.stringify([]))
  const pdfFile = new File([SAMPLE_PDF_BYTES], 'render.pdf', { type: 'application/pdf' })
  form.append('pdf', pdfFile)

  // persist initial render
  const postRes = await latexModule.POST(new Request(latexUrl(texRel), { method: 'POST', body: form }))
  assert.equal(postRes.status, 200)

  const cachedRes = await latexModule.GET(new Request(latexUrl(texRel)))
  assert.equal(cachedRes.status, 200)
  const cachedBody = await parseJson(cachedRes)
  assert.equal(cachedBody.hasPdf, true)
  assert.equal(cachedBody.stale, false)

  // Modify source file to bump mtime and size
  await new Promise((resolve) => setTimeout(resolve, 25))
  await writeTexSource(texRel, `${complianceTexSource}\n% updated\n`)

  const staleRes = await latexModule.GET(new Request(latexUrl(texRel)))
  assert.equal(staleRes.status, 200)
  const staleBody = await parseJson(staleRes)
  assert.equal(staleBody.hasPdf, true)
  assert.equal(staleBody.stale, true)
  assert.equal(staleBody.pdfPath, `${texRel}.meta/render.pdf`)
})

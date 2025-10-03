import { before, beforeEach, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

type UploadModule = typeof import('../app/api/upload/route')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const originalCwd = process.cwd()
let tempRepoRoot: string
let uploadModule: UploadModule

before(async () => {
  tempRepoRoot = await mkdtemp(path.join(os.tmpdir(), 'upload-tests-'))
  process.chdir(tempRepoRoot)

  const modulePath = path.resolve(__dirname, '../app/api/upload/route.ts')
  uploadModule = await import(pathToFileURL(modulePath).href) as UploadModule
})

beforeEach(async () => {
  if (!tempRepoRoot) return
  await rm(path.join(tempRepoRoot, 'files'), { recursive: true, force: true })
  await rm(path.join(tempRepoRoot, 'data'), { recursive: true, force: true })
  await rm(path.join(tempRepoRoot, 'content'), { recursive: true, force: true })
  await rm(path.join(tempRepoRoot, 'docs'), { recursive: true, force: true })
})

after(async () => {
  process.chdir(originalCwd)
  if (tempRepoRoot) {
    await rm(tempRepoRoot, { recursive: true, force: true })
  }
})

test('GET reports zero offset for new uploads', { concurrency: false }, async () => {
  const { GET } = uploadModule
  const url = new URL('http://localhost/api/upload')
  url.searchParams.set('path', 'docs/sample.txt')
  url.searchParams.set('size', '11')

  const res = await GET(new Request(url))
  assert.equal(res.status, 200)

  const payload = await res.json()
  assert.equal(payload.offset, 0)
  assert.equal(payload.complete, false)
  assert.equal(payload.size, 11)
  assert.equal(payload.hash, null)
})

test('PUT supports resumable uploads and final hashing', { concurrency: false }, async () => {
  const { GET, PUT } = uploadModule
  const relativePath = 'docs/resume.txt'
  const expectedSize = 11
  const baseUrl = new URL('http://localhost/api/upload')
  baseUrl.searchParams.set('path', relativePath)
  baseUrl.searchParams.set('size', String(expectedSize))

  const firstChunk = Buffer.from('hello ')
  const firstRes = await PUT(
    new Request(baseUrl, {
      method: 'PUT',
      body: firstChunk,
      headers: { 'x-upload-offset': '0' },
    }),
  )

  assert.equal(firstRes.status, 200)
  const firstPayload = await firstRes.json()
  assert.equal(firstPayload.ok, true)
  assert.equal(firstPayload.complete, false)
  assert.equal(firstPayload.offset, firstChunk.length)
  assert.equal(firstPayload.size, expectedSize)

  const resumeUrl = new URL(baseUrl)
  resumeUrl.searchParams.set('intent', 'resume')
  const statusRes = await GET(new Request(resumeUrl))
  const statusPayload = await statusRes.json()
  assert.equal(statusPayload.offset, firstChunk.length)
  assert.equal(statusPayload.complete, false)
  assert.equal(statusPayload.size, expectedSize)

  const secondChunk = Buffer.from('world')
  const finalRes = await PUT(
    new Request(baseUrl, {
      method: 'PUT',
      body: secondChunk,
      headers: { 'x-upload-offset': String(firstChunk.length) },
    }),
  )

  assert.equal(finalRes.status, 200)
  const finalPayload = await finalRes.json()
  assert.equal(finalPayload.ok, true)
  assert.equal(finalPayload.complete, true)
  assert.equal(finalPayload.offset, expectedSize)
  assert.ok(Array.isArray(finalPayload.files))
  assert.equal(finalPayload.files.length, 1)

  const uploadedFile = path.join(tempRepoRoot, 'files', 'uploads', relativePath)
  assert.equal(existsSync(uploadedFile), true)
  const fileContents = await readFile(uploadedFile, 'utf8')
  assert.equal(fileContents, 'hello world')

  const expectedHash = createHash('sha256').update('hello world').digest('hex')
  assert.equal(finalPayload.files[0].hash, expectedHash)

  const metaPath = path.join(
    tempRepoRoot,
    'files',
    'uploads',
    '.upload-meta',
    `${relativePath}.json`,
  )
  const meta = JSON.parse(await readFile(metaPath, 'utf8'))
  assert.equal(meta.completed, true)
  assert.equal(meta.uploaded, expectedSize)
  assert.equal(meta.hash, expectedHash)
})

test('PUT rejects mismatched offsets', { concurrency: false }, async () => {
  const { PUT } = uploadModule
  const relativePath = 'docs/mismatch.txt'
  const expectedSize = 6
  const url = new URL('http://localhost/api/upload')
  url.searchParams.set('path', relativePath)
  url.searchParams.set('size', String(expectedSize))

  const firstChunk = Buffer.from('first!')
  const initialRes = await PUT(
    new Request(url, {
      method: 'PUT',
      body: firstChunk,
      headers: { 'x-upload-offset': '0' },
    }),
  )
  assert.equal(initialRes.status, 200)

  const badRes = await PUT(
    new Request(url, {
      method: 'PUT',
      body: Buffer.from('oops'),
      headers: { 'x-upload-offset': '2' },
    }),
  )

  assert.equal(badRes.status, 409)
  const badPayload = await badRes.json()
  assert.equal(badPayload.error, 'offset mismatch')
  assert.equal(badPayload.size, firstChunk.length)
})

test('PUT honours docRoot uploads and metadata storage', { concurrency: false }, async () => {
  const { GET, PUT } = uploadModule
  const docRootDir = path.join(tempRepoRoot, 'docs')
  await mkdir(docRootDir, { recursive: true })
  const dataDir = path.join(tempRepoRoot, 'data')
  await mkdir(dataDir, { recursive: true })
  const configPath = path.join(dataDir, 'config.json')
  const docRootRelative = path.relative(tempRepoRoot, docRootDir)
  await writeFile(configPath, JSON.stringify({ docRoot: docRootRelative, docRootLabel: 'Docs' }, null, 2))

  const relativePath = 'guides/start.md'
  const expectedSize = 12
  const baseUrl = new URL('http://localhost/api/upload')
  baseUrl.searchParams.set('path', relativePath)
  baseUrl.searchParams.set('size', String(expectedSize))
  baseUrl.searchParams.set('root', 'docRoot')

  const firstChunk = Buffer.from('hello ')
  const firstRes = await PUT(
    new Request(baseUrl, {
      method: 'PUT',
      body: firstChunk,
      headers: { 'x-upload-offset': '0' },
    }),
  )
  assert.equal(firstRes.status, 200)
  const firstPayload = await firstRes.json()
  assert.equal(firstPayload.complete, false)
  assert.equal(firstPayload.offset, firstChunk.length)

  const statusResumeUrl = new URL(baseUrl)
  statusResumeUrl.searchParams.set('intent', 'resume')
  const statusRes = await GET(new Request(statusResumeUrl))
  const statusPayload = await statusRes.json()
  assert.equal(statusPayload.offset, firstChunk.length)
  assert.equal(statusPayload.complete, false)

  const secondChunk = Buffer.from('world!')
  const finalRes = await PUT(
    new Request(baseUrl, {
      method: 'PUT',
      body: secondChunk,
      headers: { 'x-upload-offset': String(firstChunk.length) },
    }),
  )
  assert.equal(finalRes.status, 200)
  const finalPayload = await finalRes.json()
  assert.equal(finalPayload.complete, true)
  assert.equal(finalPayload.offset, expectedSize)
  assert.equal(finalPayload.rootKey, 'docRoot')
  assert.equal(finalPayload.rootLabel, 'Docs')
  assert.equal(path.resolve(finalPayload.rootBaseAbsolute || ''), docRootDir)

  const uploadedFile = path.join(docRootDir, relativePath)
  assert.equal(existsSync(uploadedFile), true)
  const contents = await readFile(uploadedFile, 'utf8')
  assert.equal(contents, 'hello world!')

  const metaPath = path.join(tempRepoRoot, 'data', 'upload-meta', 'docRoot', `${relativePath}.json`)
  assert.equal(existsSync(metaPath), true)
  const meta = JSON.parse(await readFile(metaPath, 'utf8'))
  assert.equal(meta.completed, true)
  assert.equal(meta.uploaded, expectedSize)

  const replaceCheckRes = await GET(new Request(baseUrl))
  const replaceCheck = await replaceCheckRes.json()
  assert.equal(replaceCheck.offset, 0)
  assert.equal(replaceCheck.complete, false)
  assert.equal(replaceCheck.existing, true)

  const resumeCheckUrl = new URL(baseUrl)
  resumeCheckUrl.searchParams.set('intent', 'resume')
  const resumeCheckRes = await GET(new Request(resumeCheckUrl))
  const resumeCheck = await resumeCheckRes.json()
  assert.equal(resumeCheck.offset, expectedSize)
  assert.equal(resumeCheck.complete, true)
})

test('GET rejects empty or traversal-only paths', { concurrency: false }, async () => {
  const { GET } = uploadModule
  const url = new URL('http://localhost/api/upload')
  url.searchParams.set('path', '..')
  url.searchParams.set('size', '10')

  const res = await GET(new Request(url))
  assert.equal(res.status, 400)
  const payload = await res.json()
  assert.equal(payload.error, 'invalid path')
})

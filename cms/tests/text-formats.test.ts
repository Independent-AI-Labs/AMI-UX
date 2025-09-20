import { before, beforeEach, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

type TreeModule = typeof import('../app/api/tree/route')
type FileModule = typeof import('../app/api/file/route')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const originalCwd = process.cwd()
let tempRepoRoot: string
let treeModule: TreeModule
let fileModule: FileModule

before(async () => {
  tempRepoRoot = await mkdtemp(path.join(os.tmpdir(), 'doc-tree-text-'))
  process.chdir(tempRepoRoot)

  const treeModulePath = path.resolve(__dirname, '../app/api/tree/route.ts')
  const fileModulePath = path.resolve(__dirname, '../app/api/file/route.ts')
  treeModule = await import(pathToFileURL(treeModulePath).href) as TreeModule
  fileModule = await import(pathToFileURL(fileModulePath).href) as FileModule
})

beforeEach(async () => {
  if (!tempRepoRoot) return
  await rm(path.join(tempRepoRoot, 'content'), { recursive: true, force: true })
  await rm(path.join(tempRepoRoot, 'data'), { recursive: true, force: true })
})

after(async () => {
  process.chdir(originalCwd)
  if (tempRepoRoot) {
    await rm(tempRepoRoot, { recursive: true, force: true })
  }
})

test('Doc tree exposes extended text formats and serves their contents', { concurrency: false }, async () => {
  const docRootDir = path.join(tempRepoRoot, 'content', 'docs')
  await mkdir(docRootDir, { recursive: true })
  await mkdir(path.join(tempRepoRoot, 'data'), { recursive: true })

  const configPath = path.join(tempRepoRoot, 'data', 'config.json')
  const docRootRelative = path.relative(tempRepoRoot, docRootDir)
  await writeFile(configPath, JSON.stringify({ docRoot: docRootRelative }, null, 2))

  const jsonPath = path.join(docRootDir, 'metadata', 'info.json')
  await mkdir(path.dirname(jsonPath), { recursive: true })
  await writeFile(jsonPath, JSON.stringify({ ok: true }, null, 2))

  const yamlPath = path.join(docRootDir, 'configs', 'app.yaml')
  await mkdir(path.dirname(yamlPath), { recursive: true })
  await writeFile(yamlPath, 'name: sample\nreplicas: 3\n')

  const uploadsFile = path.join(tempRepoRoot, 'files', 'uploads', '1757890575821', 'demo', 'sub', 'a.txt')
  await mkdir(path.dirname(uploadsFile), { recursive: true })
  await writeFile(uploadsFile, 'from uploads\n')

  const res = await treeModule.GET(new Request('http://localhost/api/tree'))
  assert.equal(res.status, 200)
  const payload = await res.json() as { children?: Array<{ path: string; type: string; children?: unknown[] }> }

  function collectPaths(nodeList: Array<{ path: string; type: string; children?: any[] }> | undefined, sink: Set<string>) {
    if (!Array.isArray(nodeList)) return
    for (const node of nodeList) {
      if (node.type === 'file') sink.add(node.path)
      if (node.children?.length) collectPaths(node.children as any, sink)
    }
  }

  const files = new Set<string>()
  collectPaths(payload.children, files)
  assert.ok(files.has('metadata/info.json'), 'expected JSON file to be present in tree')
  assert.ok(files.has('configs/app.yaml'), 'expected YAML file to be present in tree')

  const fileJsonUrl = new URL('http://localhost/api/file')
  fileJsonUrl.searchParams.set('path', 'metadata/info.json')
  const jsonRes = await fileModule.GET(new Request(fileJsonUrl))
  assert.equal(jsonRes.status, 200)
  const jsonText = await jsonRes.text()
  assert.ok(jsonText.includes('"ok"'), 'expected JSON content to be returned')

  const fileYamlUrl = new URL('http://localhost/api/file')
  fileYamlUrl.searchParams.set('path', 'configs/app.yaml')
  const yamlRes = await fileModule.GET(new Request(fileYamlUrl))
  assert.equal(yamlRes.status, 200)
  const yamlText = await yamlRes.text()
  assert.ok(yamlText.includes('replicas: 3'), 'expected YAML content to be returned')

  const uploadsRes = await treeModule.GET(new Request('http://localhost/api/tree?root=uploads'))
  assert.equal(uploadsRes.status, 200)
  const uploadsPayload = await uploadsRes.json() as { children?: Array<{ path: string; type: string; children?: unknown[] }> }
  const uploadFiles = new Set<string>()
  collectPaths(uploadsPayload.children, uploadFiles)
  assert.ok(uploadFiles.has('1757890575821/demo/sub/a.txt'), 'expected uploads file to be present in tree')

  const uploadsFileUrl = new URL('http://localhost/api/file')
  uploadsFileUrl.searchParams.set('path', '1757890575821/demo/sub/a.txt')
  uploadsFileUrl.searchParams.set('root', 'uploads')
  const uploadsFileRes = await fileModule.GET(new Request(uploadsFileUrl))
  assert.equal(uploadsFileRes.status, 200)
  const uploadsText = await uploadsFileRes.text()
  assert.ok(uploadsText.includes('from uploads'), 'expected uploads file content to be returned')
})

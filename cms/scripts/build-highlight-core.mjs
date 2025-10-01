import { cp, mkdir, rm, writeFile } from 'fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import process from 'node:process'
import chokidar from 'chokidar'

import { build as buildHighlightEngine } from './build-highlight-engine.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cmsRoot = path.resolve(__dirname, '..')
const packageRoot = path.join(cmsRoot, 'packages', 'highlight-core')
const engineRoot = path.join(cmsRoot, 'packages', 'highlight-engine')
const srcHighlight = path.join(packageRoot, 'src', 'highlight-plugin')
const srcLib = path.join(packageRoot, 'src', 'lib')
const engineDist = path.join(engineRoot, 'dist', 'browser')

const webJsRoot = path.join(cmsRoot, 'public', 'js')
const extRoot = path.join(cmsRoot, 'extension', 'highlight-plugin')
const extPkgRoot = path.join(extRoot, 'pkg')
const vendorSrc = path.join(cmsRoot, 'public', 'vendor', 'highlightjs')
const webEngineDest = path.join(webJsRoot, 'lib', 'highlight-engine')
const extEngineDest = path.join(extPkgRoot, 'lib', 'highlight-engine')

const webWrappers = [
  ['icon-pack.js', "export * from './lib/icon-pack.js';\n"],
  ['dialog-controller.js', "export * from './lib/dialog-controller.js';\n"],
  ['dialog-service.js', "export * from './lib/dialog-service.js';\n"],
  ['file-tree.js', "export * from './lib/file-tree.js';\n"],
  ['code-view.js', "export * from './lib/code-view.js';\n"],
  ['message-channel.js', "export * from './lib/message-channel.js';\n"],
]

const extWrappers = [
  ['icon-pack.js', "export * from './pkg/lib/icon-pack.js';\n"],
  ['dialog-controller.js', "export * from './pkg/lib/dialog-controller.js';\n"],
  ['dialog-service.js', "export * from './pkg/lib/dialog-service.js';\n"],
  ['file-tree.js', "export * from './pkg/lib/file-tree.js';\n"],
  ['code-view.js', "export * from './pkg/lib/code-view.js';\n"],
  ['message-channel.js', "export * from './pkg/lib/message-channel.js';\n"],
]

const wrapperPaths = [
  ...webWrappers.map(([file]) => path.join(webJsRoot, file)),
  ...extWrappers.map(([file]) => path.join(extRoot, file)),
]

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

async function copyDir(src, dest) {
  await rm(dest, { recursive: true, force: true })
  await ensureDir(path.dirname(dest))
  await cp(src, dest, { recursive: true })
}

async function writeWrappers(targetDir, entries) {
  await ensureDir(targetDir)
  const tasks = entries.map(([file, source]) =>
    writeFile(path.join(targetDir, file), source, 'utf8'),
  )
  await Promise.all(tasks)
}

async function clean() {
  const targets = [
    path.join(webJsRoot, 'highlight-plugin'),
    path.join(webJsRoot, 'lib'),
    extPkgRoot,
    path.join(extPkgRoot, 'lib'),
    path.join(extPkgRoot, 'vendor', 'highlightjs'),
    webEngineDest,
    extEngineDest,
  ]

  await Promise.all(
    targets.map((target) => rm(target, { recursive: true, force: true })),
  )

  await Promise.all(wrapperPaths.map((p) => rm(p, { force: true })))
  console.log('[highlight-core] clean complete')
}

async function build() {
  await ensureDir(webJsRoot)
  await ensureDir(extRoot)

  await buildHighlightEngine()

  await copyDir(srcHighlight, path.join(webJsRoot, 'highlight-plugin'))
  await copyDir(srcLib, path.join(webJsRoot, 'lib'))
  await copyDir(engineDist, webEngineDest)

  await ensureDir(extPkgRoot)
  await copyDir(srcHighlight, extPkgRoot)
  await copyDir(srcLib, path.join(extPkgRoot, 'lib'))
  await copyDir(engineDist, extEngineDest)

  await rm(path.join(extPkgRoot, 'vendor', 'highlightjs'), { recursive: true, force: true })
  await ensureDir(path.join(extPkgRoot, 'vendor'))
  await cp(vendorSrc, path.join(extPkgRoot, 'vendor', 'highlightjs'), { recursive: true })

  await writeWrappers(webJsRoot, webWrappers)
  await writeWrappers(extRoot, extWrappers)

  console.log('[highlight-core] build complete')
}

async function watch() {
  const watchPaths = [
    path.join(packageRoot, 'src'),
    path.join(engineRoot, 'src'),
    vendorSrc,
  ]

  let building = false
  let pending = false

  const runBuild = async () => {
    if (building) {
      pending = true
      return
    }
    building = true
    try {
      await build()
    } catch (err) {
      console.error('[highlight-core] build failed', err)
    } finally {
      building = false
      if (pending) {
        pending = false
        await runBuild()
      }
    }
  }

  await runBuild()

  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 10,
    },
  })

  watcher.on('all', async (event, filePath) => {
    console.log(`[highlight-core] detected ${event} in ${filePath}`)
    await runBuild()
  })

  const stop = () => {
    watcher.close().catch(() => {})
  }

  process.on('SIGINT', () => {
    stop()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    stop()
    process.exit(0)
  })

  console.log('[highlight-core] watching for changes...')
}

export { build, clean, watch }

async function runFromCLI() {
  const [, , rawCommand] = process.argv
  const command = rawCommand?.toLowerCase() ?? 'build'

  try {
    if (command === 'clean') {
      await clean()
    } else if (command === 'watch' || command === 'dev') {
      await watch()
    } else if (command === 'build') {
      await build()
    } else {
      console.error(`[highlight-core] unknown command: ${command}`)
      process.exitCode = 1
    }
  } catch (err) {
    console.error('[highlight-core] command failed', err)
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) {
  await runFromCLI()
}

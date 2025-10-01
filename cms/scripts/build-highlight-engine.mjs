import { build as esbuildBuild, context as esbuildContext } from 'esbuild'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cmsRoot = path.resolve(__dirname, '..')
const packageRoot = path.join(cmsRoot, 'packages', 'highlight-engine')
const srcDir = path.join(packageRoot, 'src')
const distRoot = path.join(packageRoot, 'dist')
const browserEntry = path.join(srcDir, 'browser', 'index.js')
const browserOutfile = path.join(distRoot, 'browser', 'index.js')

const baseConfig = {
  entryPoints: [browserEntry],
  outfile: browserOutfile,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: false,
  treeShaking: true,
  legalComments: 'none',
  loader: {
    '.wasm': 'binary',
  },
}

async function clean() {
  await rm(distRoot, { recursive: true, force: true })
  console.log('[highlight-engine] clean complete')
}

async function build() {
  await rm(distRoot, { recursive: true, force: true })
  await esbuildBuild({
    ...baseConfig,
    logLevel: 'silent',
  })
  console.log('[highlight-engine] build complete')
}

async function watch() {
  await rm(distRoot, { recursive: true, force: true })
  const ctx = await esbuildContext({
    ...baseConfig,
    logLevel: 'info',
  })
  await ctx.watch()
  console.log('[highlight-engine] watching for changes...')
}

async function runFromCLI() {
  const command = (process.argv[2] || 'build').toLowerCase()
  if (command === 'clean') {
    await clean()
  } else if (command === 'watch' || command === 'dev') {
    await watch()
  } else if (command === 'build') {
    await build()
  } else {
    console.error(`[highlight-engine] unknown command: ${command}`)
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) {
  await runFromCLI()
}

export { build, clean, watch }

#!/usr/bin/env node
import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const cmsRoot = path.resolve(here, '..')
  const srcHighlight = path.join(cmsRoot, 'public/js/highlight-plugin')
  const destHighlight = path.join(cmsRoot, 'extension/highlight-plugin/pkg')
  const sharedFiles = ['dialog-controller.js', 'dialog-service.js', 'message-channel.js']

  await mkdir(destHighlight, { recursive: true })
  await cp(srcHighlight, destHighlight, { recursive: true, force: true })

  await Promise.all(
    sharedFiles.map(async (name) => {
      await cp(path.join(cmsRoot, 'public/js', name), path.join(cmsRoot, 'extension/highlight-plugin', name))
    }),
  )

  console.log('Highlight extension assets synced.')
}

main().catch((err) => {
  console.error('[sync-highlight-extension] failed:', err)
  process.exitCode = 1
})

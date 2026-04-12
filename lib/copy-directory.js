'use strict'

const { promises: fs } = require('graceful-fs')
const crypto = require('crypto')
const path = require('path')

const { backOff } = require('exponential-backoff')

async function copyDirectory (src, dest, ensure = false) {
  try {
    await fs.stat(src)
  } catch {
    throw new Error(`Missing source directory for copy: ${src}`)
  }
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await copyDirectory(path.join(src, entry.name), path.join(dest, entry.name))
    } else if (entry.isFile()) {
      // with parallel installs, copying files may cause file errors on
      // Windows so use an exponential backoff to resolve collisions
      await backOff(async () => {
        try {
          await fs.copyFile(path.join(src, entry.name), path.join(dest, entry.name))
        } catch (err) {
          // if ensure, check if file already exists and that's good enough
          if (ensure && err.code === 'EBUSY') {
            try {
              await fs.stat(path.join(dest, entry.name))
              return
            } catch {}
          }
          throw err
        }
      })
    } else {
      throw new Error('Unexpected file directory entry type')
    }
  }
}

module.exports = copyDirectory

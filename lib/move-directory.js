'use strict'

const { promises: fs } = require('graceful-fs')
const crypto = require('crypto')
const path = require('path')

const RACE_ERRORS = ['ENOTEMPTY', 'EEXIST', 'EBUSY', 'EPERM']

async function moveDirectory (src, dest) {
  try {
    await fs.stat(src)
  } catch {
    throw new Error(`Missing source directory for move: ${src}`)
  }
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isFile()) {
      throw new Error('Unexpected file directory entry type')
    }

    // With parallel installs, multiple processes race to place the same
    // entry. Use fs.rename for an atomic move so no process ever sees a
    // partially written file. For cross-filesystem (EXDEV), copy to a
    // temp path in the dest directory first, then rename within the
    // same filesystem to keep it atomic.
    //
    // When another process wins the race, rename may fail with one of
    // these codes — all mean the destination was already placed and
    // are safe to ignore since every process extracts identical content.
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    try {
      await fs.rename(srcPath, destPath)
    } catch (err) {
      if (RACE_ERRORS.includes(err.code)) {
        // Another parallel process already placed this entry — ignore
      } else if (err.code === 'EXDEV') {
        // Cross-filesystem: copy to a uniquely named temp path in the
        // dest directory, then rename into place atomically
        const tmpPath = `${destPath}.tmp.${crypto.randomBytes(6).toString('hex')}`
        try {
          await fs.cp(srcPath, tmpPath, { recursive: true })
          await fs.rename(tmpPath, destPath)
        } catch (e) {
          await fs.rm(tmpPath, { recursive: true, force: true }).catch(() => {})
          if (!RACE_ERRORS.includes(e.code)) {
            throw e
          }
        }
      } else {
        throw err
      }
    }
  }
}

module.exports = moveDirectory

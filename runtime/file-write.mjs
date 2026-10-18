// M19.07 generic Node-only ⧅ file write capability. No task-specific CSV/JSON glue.
// The generated H-Code ESM embeds this self-contained module on demand.
import {
  constants, lstatSync, realpathSync, openSync, writeSync, fsyncSync,
  closeSync, linkSync, unlinkSync, statSync
} from 'node:fs';
import {isAbsolute, resolve, basename, dirname} from 'node:path';
import {randomBytes} from 'node:crypto';

export const MAX_OUTPUT_BYTES = 65_536;
const PORTABLE_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/;
const WINDOWS_DEVICE = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

function validateFilename(name) {
  if (typeof name !== 'string' || !PORTABLE_NAME.test(name) ||
      name.endsWith('.') || WINDOWS_DEVICE.test(name) ||
      name === '.' || name === '..' || isAbsolute(name) ||
      basename(name) !== name || /[\\/:\u0000-\u001f]/.test(name)) {
    throw new TypeError('⧅ expects a portable single-component filename');
  }
  return name;
}

function validateRoot(rawRoot) {
  if (typeof rawRoot !== 'string' || !isAbsolute(rawRoot)) {
    throw new TypeError('⧅ requires an explicitly approved absolute output directory');
  }
  const canonical = realpathSync(rawRoot);
  const entry = lstatSync(rawRoot);
  if (entry.isSymbolicLink() || !entry.isDirectory() ||
      resolve(rawRoot) !== canonical) {
    throw new TypeError('⧅ approved directory must be a canonical real directory');
  }
  return canonical;
}

function encodeContent(contents) {
  if (typeof contents !== 'string') {
    throw new TypeError('⧅ expects UTF-8 String content');
  }
  if (!contents.isWellFormed()) {
    throw new TypeError('⧅ rejects unpaired Unicode surrogates');
  }
  const encoded = new TextEncoder().encode(contents);
  if (encoded.length > MAX_OUTPUT_BYTES) {
    throw new RangeError('⧅ output exceeds 64 KiB UTF-8');
  }
  return encoded;
}

/**
 * Create a restricted, atomic, no-overwrite writer backed by a trusted root.
 * The output path is always a single portable basename. Publish using an
 * exclusive random temporary inode followed by linkSync (never rename), so a
 * preexisting file or symlink can never be clobbered even during a race.
 *
 * Node has no portable openat/dirfd confinement. The approved root must not
 * be writable/renameable by an attacker; for hostile roots use native openat.
 */
export function createFileWriteCapability({root, maxWrites = 32, maxTotalBytes = 262_144} = {}) {
  const approved = validateRoot(root);
  const originalRootStat = statSync(approved);
  if (!Number.isSafeInteger(maxWrites) || maxWrites < 1 || maxWrites > 64 ||
      !Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < 0 || maxTotalBytes > 4_194_304) {
    throw new RangeError('Invalid ⧅ effect budget');
  }
  let writes = 0, totalBytes = 0;
  const createdPaths = new Set();

  function write(name, contents) {
    name = validateFilename(name);
    const data = encodeContent(contents);
    if (writes >= maxWrites || totalBytes + data.byteLength > maxTotalBytes) {
      throw new RangeError('⧅ effect budget exceeded');
    }
    if (validateRoot(approved) !== approved) {
      throw new Error('⧅ output directory changed');
    }
    const currentRootStat = statSync(approved);
    if (currentRootStat.dev !== originalRootStat.dev ||
        currentRootStat.ino !== originalRootStat.ino) {
      throw new Error('⧅ approved directory inode changed');
    }
    const dest = resolve(approved, name);
    if (dirname(dest) !== approved) {
      throw new TypeError('⧅ path escaped the approved directory');
    }
    let tmp, fd;
    for (let attempt = 0; attempt < 5; attempt++) {
      tmp = resolve(approved, '.hcode-' + randomBytes(16).toString('hex') + '.tmp');
      try {
        fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT |
          constants.O_EXCL | (constants.O_NOFOLLOW || 0), 0o600);
        break;
      } catch (error) {
        if (error.code !== 'EEXIST' || attempt === 4) throw error;
      }
    }
    try {
      let offset = 0;
      while (offset < data.byteLength) {
        const count = writeSync(fd, data, offset, data.byteLength - offset);
        if (count <= 0) throw new Error('⧅ incomplete filesystem write');
        offset += count;
      }
      fsyncSync(fd);
      closeSync(fd);
      fd = undefined;
      const prePublishStat = statSync(approved);
      if (prePublishStat.dev !== originalRootStat.dev ||
          prePublishStat.ino !== originalRootStat.ino) {
        throw new Error('⧅ approved directory inode changed before publish');
      }
      linkSync(tmp, dest); // EEXIST means no overwrite, even if dest is a symlink.
      const size = statSync(dest).size;
      if (size !== data.byteLength) throw new Error('⧅ published size mismatch');
      writes++;
      totalBytes += data.byteLength;
      createdPaths.add(name);
      return size;
    } finally {
      if (fd !== undefined) closeSync(fd);
      try { unlinkSync(tmp); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  return Object.freeze({write,
    stats:() => Object.freeze({writes, totalBytes, filenames:[...createdPaths].sort()})
  });
}

import { inflateRawSync } from 'node:zlib';
import { crc32, safePath } from '../extension/lib/zip.mjs';
export const MAX_ARCHIVE = 200 * 1024 * 1024;
const MAX_FILE = 25 * 1024 * 1024;
export function readZip(bytes) {
  if (bytes.length < 22 || bytes.length > MAX_ARCHIVE) throw new Error('ZIP must be between 22 bytes and 200 MB.');
  const data = Buffer.from(bytes);
  let end = data.length - 22;
  for (; end >= Math.max(0, data.length - 65557); end--) {
    if (data.readUInt32LE(end) === 0x06054b50 && end + 22 + data.readUInt16LE(end + 20) === data.length) break;
  }
  if (end < 0 || data.readUInt32LE(end) !== 0x06054b50) throw new Error('Invalid ZIP end record.');
  const count = data.readUInt16LE(end + 10), size = data.readUInt32LE(end + 12), start = data.readUInt32LE(end + 16);
  if (data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6) || data.readUInt16LE(end + 8) !== count ||
      !count || count > 500 || start + size !== end) throw new Error('Unsupported or oversized ZIP directory.');
  const files = new Map();
  let pos = start, total = 0;
  for (let index = 0; index < count; index++) {
    if (pos + 46 > end || data.readUInt32LE(pos) !== 0x02014b50) throw new Error('Invalid ZIP directory entry.');
    const flags = data.readUInt16LE(pos + 8), method = data.readUInt16LE(pos + 10);
    const compressed = data.readUInt32LE(pos + 20), uncompressed = data.readUInt32LE(pos + 24);
    const nameLength = data.readUInt16LE(pos + 28), extra = data.readUInt16LE(pos + 30), comment = data.readUInt16LE(pos + 32);
    const local = data.readUInt32LE(pos + 42);
    const name = data.subarray(pos + 46, pos + 46 + nameLength).toString('utf8');
    const mode = (data.readUInt32LE(pos + 38) >>> 16) & 0xf000;
    if (!safePath(name) || files.has(name) || flags & 1 || ![0, 8].includes(method) || mode === 0xa000 ||
        compressed > MAX_FILE || uncompressed > MAX_FILE || pos + 46 + nameLength + extra + comment > end) {
      throw new Error(`Unsafe, duplicate, or unsupported ZIP entry: ${name}`);
    }
    total += uncompressed;
    if (total > MAX_ARCHIVE || local + 30 > start || data.readUInt32LE(local) !== 0x04034b50 ||
        data.readUInt16LE(local + 8) !== method || data.readUInt16LE(local + 6) !== flags) throw new Error('Invalid ZIP local header or size.');
    const localNameLength = data.readUInt16LE(local + 26), localExtra = data.readUInt16LE(local + 28);
    if (data.subarray(local + 30, local + 30 + localNameLength).toString('utf8') !== name) throw new Error('ZIP filenames disagree.');
    const from = local + 30 + localNameLength + localExtra;
    if (from + compressed > start) throw new Error('Truncated ZIP media.');
    const payload = data.subarray(from, from + compressed);
    const decoded = method === 0 ? payload : inflateRawSync(payload, { maxOutputLength: Math.max(uncompressed, 1) });
    if (decoded.length !== uncompressed || crc32(decoded) !== data.readUInt32LE(pos + 16)) throw new Error(`ZIP checksum mismatch: ${name}`);
    files.set(name, decoded);
    pos += 46 + nameLength + extra + comment;
  }
  if (pos !== end) throw new Error('Invalid ZIP directory length.');
  return files;
}

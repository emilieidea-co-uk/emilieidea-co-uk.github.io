// Small interoperable ZIP writer: STORE entries, UTF-8 filenames, no ZIP64.
const table = Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function safePath(name) {
  return typeof name === 'string' && name.length <= 240 &&
    /^[A-Za-z0-9_.\/-]+$/.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..');
}
export function createZip(entries) {
  if (!entries.length || entries.length > 500) throw new Error('Invalid ZIP file count.');
  const names = new Set();
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    if (!safePath(name) || names.has(name)) throw new Error(`Invalid or duplicate ZIP path: ${name}`);
    names.add(name);
    if (!(data instanceof Uint8Array)) throw new Error('ZIP data must be bytes.');
    const filename = new TextEncoder().encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + filename.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true);
    l.setUint16(6, 0x800, true); l.setUint16(12, 0x21, true);
    l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true);
    l.setUint16(26, filename.length, true); local.set(filename, 30);
    locals.push(local, data);
    const central = new Uint8Array(46 + filename.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, filename.length, true); c.setUint32(42, offset, true); central.set(filename, 46);
    centrals.push(central);
    offset += local.length + data.length;
    if (offset > 200 * 1024 * 1024) throw new Error('Export exceeds 200 MB. Export fewer posts.');
  }
  const centralSize = centrals.reduce((sum, value) => sum + value.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + 22);
  let position = 0;
  for (const part of [...locals, ...centrals, end]) { result.set(part, position); position += part.length; }
  return result;
}

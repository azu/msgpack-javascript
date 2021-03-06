import { prettyByte } from "./prettyByte";

export function utf8Count(str: string): number {
  const strLength = str.length;

  let byteLength = 0;
  let pos = 0;
  while (pos < strLength) {
    let value = str.charCodeAt(pos++);
    if (value >= 0xd800 && value <= 0xdbff) {
      // high surrogate
      if (pos < strLength) {
        const extra = str.charCodeAt(pos);
        if ((extra & 0xfc00) === 0xdc00) {
          ++pos;
          value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
        }
      }
      if (value >= 0xd800 && value <= 0xdbff) {
        continue; // drop lone surrogate
      }
    }

    if ((value & 0xffffff80) === 0) {
      // 1-byte
      byteLength++;
      continue;
    } else if ((value & 0xfffff800) === 0) {
      // 2-bytes
      byteLength += 2;
    } else if ((value & 0xffff0000) === 0) {
      // 3-byte
      byteLength += 3;
    } else if ((value & 0xffe00000) === 0) {
      // 4-byte
      byteLength += 4;
    } else {
      throw new Error(`Invalid UTF-8 byte: ${prettyByte(value)} at ${pos}`);
    }
  }
  return byteLength;
}

export function utf8Encode(str: string, view: DataView, offset: number): void {
  const strLength = str.length;

  let pos = 0;
  while (pos < strLength) {
    let value = str.charCodeAt(pos++);
    if (value >= 0xd800 && value <= 0xdbff) {
      // high surrogate
      if (pos < strLength) {
        const extra = str.charCodeAt(pos);
        if ((extra & 0xfc00) === 0xdc00) {
          ++pos;
          value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
        }
      }
      if (value >= 0xd800 && value <= 0xdbff) {
        continue; // drop lone surrogate
      }
    }

    if ((value & 0xffffff80) === 0) {
      // 1-byte
      view.setUint8(offset++, value);
      continue;
    } else if ((value & 0xfffff800) === 0) {
      // 2-bytes
      view.setUint8(offset++, ((value >> 6) & 0x1f) | 0xc0);
    } else if ((value & 0xffff0000) === 0) {
      // 3-byte
      view.setUint8(offset++, ((value >> 12) & 0x0f) | 0xe0);
      view.setUint8(offset++, ((value >> 6) & 0x3f) | 0x80);
    } else if ((value & 0xffe00000) === 0) {
      // 4-byte
      view.setUint8(offset++, ((value >> 18) & 0x07) | 0xf0);
      view.setUint8(offset++, ((value >> 12) & 0x3f) | 0x80);
      view.setUint8(offset++, ((value >> 6) & 0x3f) | 0x80);
    } else {
      throw new Error(`Invalid UTF-8 byte: ${prettyByte(value)} at ${pos}`);
    }

    view.setUint8(offset++, (value & 0x3f) | 0x80);
  }
}

export function utf8Decode(view: DataView, offset: number, byteLength: number): string {
  const out: Array<number> = [];
  const end = offset + byteLength;
  while (offset < end) {
    const byte1 = view.getUint8(offset++);
    if ((byte1 & 0x80) === 0) {
      // 1 byte
      out.push(byte1);
    } else if ((byte1 & 0xe0) === 0xc0) {
      // 2 bytes
      const byte2 = view.getUint8(offset++) & 0x3f;
      out.push(((byte1 & 0x1f) << 6) | byte2);
    } else if ((byte1 & 0xf0) === 0xe0) {
      // 3 bytes
      const byte2 = view.getUint8(offset++) & 0x3f;
      const byte3 = view.getUint8(offset++) & 0x3f;
      out.push(((byte1 & 0x1f) << 12) | (byte2 << 6) | byte3);
    } else if ((byte1 & 0xf8) === 0xf0) {
      // 4 bytes
      const byte2 = view.getUint8(offset++) & 0x3f;
      const byte3 = view.getUint8(offset++) & 0x3f;
      const byte4 = view.getUint8(offset++) & 0x3f;
      let codepoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
      if (codepoint > 0xffff) {
        codepoint -= 0x10000;
        out.push(((codepoint >>> 10) & 0x3ff) | 0xd800);
        codepoint = 0xdc00 | (codepoint & 0x3ff);
      }
      out.push(codepoint);
    } else {
      throw new Error(`Invalid UTF-8 byte ${prettyByte(byte1)} at ${offset}`);
    }
  }
  return String.fromCharCode(...out);
}

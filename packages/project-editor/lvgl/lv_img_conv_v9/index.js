// LVGLImage.js - Port of LVGLImage.py to JavaScript (Node.js)

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const child_process = require('child_process');
let lz4 = null;
try { lz4 = require('lz4'); } catch (e) { lz4 = null; }
let quantize = null;
try { quantize = require('quantize'); } catch (e) { quantize = null; }

// Utility functions for writing little-endian integers
function uint8_t(v) { return Buffer.from([v & 0xff]); }
function uint16_t(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v & 0xffff, 0); return b; }
function swap_uint16_t(v) { const b = Buffer.alloc(2); b.writeUInt16BE(v & 0xffff, 0); return b; }
function uint24_t(v) { const b = Buffer.alloc(3); b.writeUIntLE(v & 0xffffff, 0, 3); return b; }
function uint32_t(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0, 0); return b; }

function color_pre_multiply(r, g, b, a, background) {
  const bb = background & 0xff;
  const bg = (background >> 8) & 0xff;
  const br = (background >> 16) & 0xff;
  return [((r * a + (255 - a) * br) >> 8), ((g * a + (255 - a) * bg) >> 8), ((b * a + (255 - a) * bb) >> 8), a];
}

// ColorFormat "enum" with helper properties
const ColorFormat = {
  UNKNOWN: 0x00,
  RAW: 0x01,
  RAW_ALPHA: 0x02,
  L8: 0x06,
  I1: 0x07,
  I2: 0x08,
  I4: 0x09,
  I8: 0x0A,
  A1: 0x0B,
  A2: 0x0C,
  A4: 0x0D,
  A8: 0x0E,
  AL88: 0x15,
  ARGB8888: 0x10,
  XRGB8888: 0x11,
  RGB565: 0x12,
  RGB565_SWAPPED: 0x1B,
  ARGB8565: 0x13,
  RGB565A8: 0x14,
  RGB888: 0x0F,
  ARGB8888_PREMULTIPLIED: 0x1A,
};

// metadata helpers mapped by numeric value
const CF_META = {
  [ColorFormat.L8]: { bpp: 8 },
  [ColorFormat.I1]: { bpp: 1, ncolors: 2 },
  [ColorFormat.I2]: { bpp: 2, ncolors: 4 },
  [ColorFormat.I4]: { bpp: 4, ncolors: 16 },
  [ColorFormat.I8]: { bpp: 8, ncolors: 256 },
  [ColorFormat.A1]: { bpp: 1 },
  [ColorFormat.A2]: { bpp: 2 },
  [ColorFormat.A4]: { bpp: 4 },
  [ColorFormat.A8]: { bpp: 8 },
  [ColorFormat.AL88]: { bpp: 16 },
  [ColorFormat.ARGB8888]: { bpp: 32 },
  [ColorFormat.XRGB8888]: { bpp: 32 },
  [ColorFormat.RGB565]: { bpp: 16 },
  [ColorFormat.RGB565_SWAPPED]: { bpp: 16 },
  [ColorFormat.RGB565A8]: { bpp: 16 },
  [ColorFormat.ARGB8565]: { bpp: 24 },
  [ColorFormat.RGB888]: { bpp: 24 },
  [ColorFormat.ARGB8888_PREMULTIPLIED]: { bpp: 32 },
};

function bpp(cf) { return CF_META[cf] ? CF_META[cf].bpp : 0; }
function ncolors(cf) { return CF_META[cf] ? (CF_META[cf].ncolors || 0) : 0; }
function is_indexed(cf) { return ncolors(cf) !== 0; }
function is_alpha_only(cf) { return cf >= ColorFormat.A1 && cf <= ColorFormat.A8; }
function has_alpha(cf) { return is_alpha_only(cf) || is_indexed(cf) || [ColorFormat.AL88, ColorFormat.ARGB8888, ColorFormat.XRGB8888, ColorFormat.ARGB8565, ColorFormat.RGB565A8, ColorFormat.ARGB8888_PREMULTIPLIED].includes(cf); }

// RLE helper class
class RLEImage {
  static get_repeat_count(buf, offset, blksize) {
    if (offset + blksize > buf.length) return 0;
    const start = buf.slice(offset, offset + blksize);
    let index = offset;
    let repeat_cnt = 0;
    while (index + blksize <= buf.length) {
      const value = buf.slice(index, index + blksize);
      if (Buffer.compare(value, start) === 0) {
        repeat_cnt += 1;
        if (repeat_cnt === 127) break;
      } else break;
      index += blksize;
    }
    return repeat_cnt;
  }

  static get_nonrepeat_count(buf, offset, blksize, threshold) {
    if (offset + blksize > buf.length) return 0;
    let pre_value = buf.slice(offset, offset + blksize);
    let index = offset;
    let nonrepeat_count = 0;
    let repeat_cnt = 0;
    while (true) {
      const value = buf.slice(index, index + blksize);
      if (Buffer.compare(value, pre_value) === 0) {
        repeat_cnt += 1;
        if (repeat_cnt > threshold) {
          break;
        }
      } else {
        pre_value = value;
        nonrepeat_count += 1 + repeat_cnt;
        repeat_cnt = 0;
        if (nonrepeat_count >= 127) { nonrepeat_count = 127; break; }
      }
      index += blksize;
      if (index >= buf.length) { nonrepeat_count += repeat_cnt; break; }
    }
    return nonrepeat_count;
  }

  static rle_compress(data, blksize, threshold = 16) {
    let index = 0;
    const out = [];
    while (index < data.length) {
      const repeat_cnt = RLEImage.get_repeat_count(data, index, blksize);
      if (repeat_cnt === 0) break;
      if (repeat_cnt < threshold) {
        const nonrepeat_cnt = RLEImage.get_nonrepeat_count(data, index, blksize, threshold);
        out.push(Buffer.from([nonrepeat_cnt | 0x80]));
        out.push(data.slice(index, index + nonrepeat_cnt * blksize));
        index += nonrepeat_cnt * blksize;
      } else {
        out.push(Buffer.from([repeat_cnt]));
        out.push(data.slice(index, index + blksize));
        index += repeat_cnt * blksize;
      }
    }
    return Buffer.concat(out);
  }
}

class LVGLImageHeader {
  constructor(cf = ColorFormat.UNKNOWN, w = 0, h = 0, stride = 0, align = 1, flags = 0) {
    this.cf = cf;
    this.flags = flags;
    this.w = w & 0xffff;
    this.h = h & 0xffff;
    if (w > 0xffff || h > 0xffff) throw new Error(`w,h overflow: ${w}x${h}`);
    this.stride = stride === 0 ? this.stride_align(align) : stride;
  }

  stride_align(align) {
    let stride = this.stride_default;
    if (align === 1) {
      // no-op
    } else if (align > 1) {
      stride = Math.ceil(stride / align) * align;
    } else throw new Error(`Invalid stride align: ${align}`);
    this.stride = stride;
    return stride;
  }

  get stride_default() { return Math.floor((this.w * bpp(this.cf) + 7) / 8); }

  get binary() {
    const out = [];
    out.push(uint8_t(0x19));
    out.push(uint8_t(this.cf & 0xff));
    out.push(uint16_t(this.flags & 0xffff));
    out.push(uint16_t(this.w));
    out.push(uint16_t(this.h));
    out.push(uint16_t(this.stride));
    out.push(uint16_t(0));
    return Buffer.concat(out);
  }

  static fromBinary(data) {
    if (data.length < 12) throw new Error('invalid header length');
    const cf = data[1] & 0x1f;
    const w = data.readUInt16LE(4);
    const h = data.readUInt16LE(6);
    const stride = data.readUInt16LE(8);
    const hdr = new LVGLImageHeader(cf, w, h, stride);
    return hdr;
  }
}

class LVGLCompressData {
  constructor(cf, method, raw_data = Buffer.alloc(0)) {
    this.blk_size = Math.floor((bpp(cf) + 7) / 8);
    this.method = method; // string 'NONE'|'RLE'|'LZ4'
    this.raw_data = raw_data;
    this.raw_data_len = raw_data.length;
    this.compressed = this._compress(raw_data);
  }

  _compress(raw_data) {
    if (this.method === 'NONE') return raw_data;
    if (this.method === 'RLE') {
      let pad = Buffer.alloc(0);
      if (this.raw_data_len % this.blk_size) {
        pad = Buffer.alloc(this.blk_size - (this.raw_data_len % this.blk_size), 0);
      }
      const compressed = RLEImage.rle_compress(Buffer.concat([raw_data, pad]), this.blk_size);
      this.compressed_len = compressed.length;
      return Buffer.concat([uint32_t(0x01), uint32_t(this.compressed_len), uint32_t(this.raw_data_len), compressed]);
    }
    if (this.method === 'LZ4') {
      if (!lz4) throw new Error('LZ4 compression requested but "lz4" package is not installed. Install it with `npm install lz4`.');
      const maxSize = lz4.encodeBound(raw_data.length);
      const compressed = Buffer.alloc(maxSize);
      const compressedSize = lz4.encodeBlock(raw_data, compressed);
      const out = compressed.slice(0, compressedSize);
      this.compressed_len = out.length;
      return Buffer.concat([uint32_t(0x02), uint32_t(this.compressed_len), uint32_t(this.raw_data_len), out]);
    }
    throw new Error(`Invalid compress method: ${this.method}`);
  }
}

class RAWImage {
  constructor(cf = ColorFormat.UNKNOWN, data = Buffer.alloc(0)) { this.cf = cf; this.data = Buffer.from(data); }

  from_file(filename, cf) {
    if (cf !== ColorFormat.RAW && cf !== ColorFormat.RAW_ALPHA) throw new Error(`Invalid color format: ${cf}`);
    this.data = fs.readFileSync(filename);
    this.cf = cf;
    return this;
  }

  to_c_array(filename, outputname = null) {
    if (!filename.endsWith('.c')) throw new Error("filename not ended with '.c'");
    const dir = path.dirname(filename);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const varname = outputname || path.basename(filename).split('.')[0].replace(/[-.]/g, '_').replace(/\./g,'_');
    const flagsArr = [];
    if (this.premultiplied) flagsArr.push('LV_IMAGE_FLAGS_PREMULTIPLIED');
    const flags = flagsArr.length ? '0 | ' + flagsArr.join(' | ') : '0';
    const macro = 'LV_ATTRIBUTE_' + varname.toUpperCase();

    let header = `#if defined(LV_LVGL_H_INCLUDE_SIMPLE)\n#include "lvgl.h"\n#elif defined(LV_LVGL_H_INCLUDE_SYSTEM)\n#include <lvgl.h>\n#elif defined(LV_BUILD_TEST)\n#include "../lvgl.h"\n#else\n#include "lvgl/lvgl.h"\n#endif\n\n#ifndef LV_ATTRIBUTE_MEM_ALIGN\n#define LV_ATTRIBUTE_MEM_ALIGN\n#endif\n\n#ifndef ${macro}\n#define ${macro}\n#endif\n\nstatic const\nLV_ATTRIBUTE_MEM_ALIGN LV_ATTRIBUTE_LARGE_CONST ${macro}\nuint8_t ${varname}_map[] = {\n`;

    const ending = `\n};\n\nconst lv_image_dsc_t ${varname} = {\n  .header = {\n    .magic = LV_IMAGE_HEADER_MAGIC,\n    .cf = LV_COLOR_FORMAT_${Object.keys(ColorFormat).find(k=>ColorFormat[k]===this.cf)||'UNKNOWN'},\n    .flags = ${flags},\n    .w = 0,\n    .h = 0,\n    .stride = 0,\n    .reserved_2 = 0,\n  },\n  .data_size = sizeof(${varname}_map),\n  .data = ${varname}_map,\n  .reserved = NULL,\n};\n`;

    function write_binary(f, dataBuf, stride) {
      stride = stride === 0 ? 16 : stride;
      for (let i=0;i<dataBuf.length;i++) {
        if (i % stride === 0) f.write('\r\n    ');
        f.write(`0x${dataBuf[i].toString(16).padStart(2,'0')},`);
      }
      f.write('\r\n');
    }

    if (!this.data || this.data.length === 0) throw new Error('RAW data is empty; cannot write C array');
    const fh = fs.createWriteStream(filename, {flags:'w'});
    fh.write('\r\n' + header.replace(/\n/g,'\r\n'));
    write_binary(fh, this.data, 16);
    fh.write(ending.replace(/\n/g,'\r\n'));
    // Append final CRLF to match Python's output trailing blank line
    fh.write('\r\n');
    fh.end();
  }

  to_c_array_as_string(filename = null, outputname = null) {
    if (!this.data || this.data.length === 0) throw new Error('RAW data is empty; cannot create C array string');

    // Derive varname: prefer explicit outputname, then filename, then fallback 'raw_image'
    let varname = 'raw_image';
    if (outputname) varname = outputname;
    else if (filename) varname = path.basename(filename).split('.')[0];
    varname = varname.replace(/[-.]/g, '_').replace(/\./g, '_');

    const flagsArr = [];
    if (this.premultiplied) flagsArr.push('LV_IMAGE_FLAGS_PREMULTIPLIED');
    const flags = flagsArr.length ? '0 | ' + flagsArr.join(' | ') : '0';
    const macro = 'LV_ATTRIBUTE_' + varname.toUpperCase();

    let header_s = `#if defined(LV_LVGL_H_INCLUDE_SIMPLE)\n#include "lvgl.h"\n#elif defined(LV_LVGL_H_INCLUDE_SYSTEM)\n#include <lvgl.h>\n#elif defined(LV_BUILD_TEST)\n#include "../lvgl.h"\n#else\n#include "lvgl/lvgl.h"\n#endif\n\n#ifndef LV_ATTRIBUTE_MEM_ALIGN\n#define LV_ATTRIBUTE_MEM_ALIGN\n#endif\n\n#ifndef ${macro}\n#define ${macro}\n#endif\n\nstatic const\nLV_ATTRIBUTE_MEM_ALIGN LV_ATTRIBUTE_LARGE_CONST ${macro}\nuint8_t ${varname}_map[] = {\n`;

    const ending_s = `\n};\n\nconst lv_image_dsc_t ${varname} = {\n  .header = {\n    .magic = LV_IMAGE_HEADER_MAGIC,\n    .cf = LV_COLOR_FORMAT_${Object.keys(ColorFormat).find(k=>ColorFormat[k]===this.cf)||'UNKNOWN'},\n    .flags = ${flags},\n    .w = 0,\n    .h = 0,\n    .stride = 0,\n    .reserved_2 = 0,\n  },\n  .data_size = sizeof(${varname}_map),\n  .data = ${varname}_map,\n  .reserved = NULL,\n};\n`;

    function write_binary_str(dataBuf, stride) {
      stride = stride === 0 ? 16 : stride;
      let out = '';
      for (let i=0;i<dataBuf.length;i++) {
        if (i % stride === 0) out += '\r\n    ';
        out += `0x${dataBuf[i].toString(16).padStart(2,'0')},`;
      }
      out += '\r\n';
      return out;
    }

    let outStr = '';
    outStr += '\r\n' + header_s.replace(/\n/g, '\r\n');
    outStr += write_binary_str(this.data, 16);
    outStr += ending_s.replace(/\n/g, '\r\n');
    outStr += '\r\n';
    return outStr;
  }
}

class LVGLImage {
  constructor(cf = ColorFormat.UNKNOWN, w = 0, h = 0, data = Buffer.alloc(0)) {
    this.cf = cf; this.w = w; this.h = h; this.stride = 0; this.premultiplied = false; this.rgb565_dither = false; this.nema_gfx = false;
    if (data.length) this.set_data(cf, w, h, data);
  }

  set_data(cf, w, h, data, stride = 0) {
    if (w > 0xffff || h > 0xffff) throw new Error(`w,h overflow: ${w}x${h}`);
    this.cf = cf; this.w = w; this.h = h;
    this.stride = stride === 0 ? new LVGLImageHeader(cf, w, h, stride, 1).stride : stride;
    if (this.data_len !== data.length) throw new Error(`data length error got:${data.length}, expect:${this.data_len}`);
    this.data = Buffer.from(data);
    return this;
  }

  adjust_stride(stride = 0, align = 1) {
    if (this.stride === 0) { console.warn('Cannot adjust stride for empty image'); return; }
    if (align >= 1 && stride === 0) {
      const header = new LVGLImageHeader(this.cf, this.w, this.h, 0, align);
      stride = header.stride;
    } else if (stride > 0) {
      // use provided stride
    } else {
      throw new Error(`Invalid parameter, align:${align}, stride:${stride}`);
    }

    if (this.stride === stride) return; // no change
    if (this.data_len === 0) { this.stride = 0; return; }

    const current = new LVGLImageHeader(this.cf, this.w, this.h, this.stride);

    const change_stride = (dataBuf, h, current_stride, new_stride) => {
      const outParts = [];
      if (new_stride < current_stride) {
        for (let i=0;i<h;i++) {
          const start = i*current_stride; const end = start + new_stride;
          outParts.push(dataBuf.slice(start, end));
        }
      } else {
        const padding = Buffer.alloc(new_stride - current_stride, 0);
        for (let i=0;i<h;i++) {
          outParts.push(dataBuf.slice(i*current_stride, (i+1)*current_stride));
          outParts.push(padding);
        }
      }
      return Buffer.concat(outParts);
    };

    const palette_size = ncolors(this.cf) * 4;
    const parts = [];
    parts.push(this.data.slice(0, palette_size));
    parts.push(change_stride(this.data.slice(palette_size), this.h, current.stride, stride));

    if (this.cf === ColorFormat.RGB565A8) {
      console.warn('handle RGB565A8 alpha map');
      const a8_stride = Math.floor(this.stride / 2);
      const a8_map = this.data.slice(-a8_stride * this.h);
      parts.push(change_stride(a8_map, this.h, Math.floor(current.stride / 2), Math.floor(stride / 2)));
    }

    this.stride = stride;
    this.data = Buffer.concat(parts);
  }

  premultiply() {
    if (this.premultiplied) throw new Error('Image already pre-multiplied');
    if (!has_alpha(this.cf)) throw new Error(`Image has no alpha channel: ${this.cf}`);

    if (is_indexed(this.cf)) {
      const palette_size = ncolors(this.cf) * 4;
      const palette = this.data.slice(0, palette_size);
      const outPalette = Buffer.alloc(palette.length);
      for (let i=0;i<palette.length;i+=4) {
        const b = palette[i+0]; const g = palette[i+1]; const r = palette[i+2]; const a = palette[i+3];
        const nr = (r * a) >> 8; const ng = (g * a) >> 8; const nb = (b * a) >> 8;
        outPalette[i+0] = nb; outPalette[i+1] = ng; outPalette[i+2] = nr; outPalette[i+3] = a;
      }
      this.data = Buffer.concat([outPalette, this.data.slice(palette_size)]);
    } else if (this.cf === ColorFormat.ARGB8888) {
      const line_width = this.w * 4;
      for (let h=0; h<this.h; h++) {
        const offset = h * this.stride;
        const map = this.data.slice(offset, offset + this.stride);
        for (let i=0;i<line_width;i+=4) {
          const b = map[i+0]; const g = map[i+1]; const r = map[i+2]; const a = map[i+3];
          const nr = (r * a) >> 8; const ng = (g * a) >> 8; const nb = (b * a) >> 8;
          this.data[offset + i + 0] = nb; this.data[offset + i + 1] = ng; this.data[offset + i + 2] = nr; this.data[offset + i + 3] = a;
        }
      }
    } else {
      throw new Error(`premultiply not implemented for ${this.cf}`);
    }

    this.premultiplied = true;
  }

  get data_len() {
    const p = is_indexed(this.cf) && this.w * this.h ? ncolors(this.cf) * 4 : 0;
    let total = p + this.stride * this.h;
    if (this.cf === ColorFormat.RGB565A8) { total += Math.floor(this.stride / 2) * this.h; }
    return total;
  }

  to_bin(filename, compress = 'NONE') {
    if (!filename.endsWith('.bin')) throw new Error("filename not ended with '.bin'");
    const dir = path.dirname(filename);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const flags = 0 | (compress !== 'NONE' ? 0x08 : 0) | (this.premultiplied ? 0x01 : 0);
    const header = new LVGLImageHeader(this.cf, this.w, this.h, this.stride, 1, flags);
    const compressed = new LVGLCompressData(this.cf, compress, this.data);
    const bin = Buffer.concat([header.binary, compressed.compressed]);
    fs.writeFileSync(filename, bin);
    return this;
  }

  to_bin_as_buffer(compress = 'NONE') {
    const flags = 0 | (compress !== 'NONE' ? 0x08 : 0) | (this.premultiplied ? 0x01 : 0);
    const header = new LVGLImageHeader(this.cf, this.w, this.h, this.stride, 1, flags);
    const compressed = new LVGLCompressData(this.cf, compress, this.data);
    const bin = Buffer.concat([header.binary, compressed.compressed]);
    return bin;
  }

  // helpers for PNG <-> LVGL conversion
  sRGB_to_linear(x) {
    if (x < 0.04045) return x / 12.92;
    return Math.pow((x + 0.055) / 1.055, 2.4);
  }

  linear_to_sRGB(y) {
    if (y <= 0.0031308) return 12.92 * y;
    return 1.055 * Math.pow(y, 1 / 2.4) - 0.055;
  }

  // pack rows of small bitdepth into bytes (bpp = 1,2,4,8). Input: rows = Array of Arrays
  pack_rows(rows, bpp) {
    const out = [];
    const per_byte = 8 / bpp;
    for (const row of rows) {
      const bytes = [];
      let cur = 0;
      let bits_filled = 0; // bits filled in cur (from MSB)
      for (const val of row) {
        cur = (cur << bpp) | (val & ((1 << bpp) - 1));
        bits_filled += bpp;
        if (bits_filled === 8) {
          bytes.push(cur & 0xff);
          cur = 0; bits_filled = 0;
        }
      }
      if (bits_filled > 0) {
        cur = cur << (8 - bits_filled);
        bytes.push(cur & 0xff);
      }
      out.push(Buffer.from(bytes));
    }
    return Buffer.concat(out);
  }

  // Unpack LVGL image data to array suitable for PNG writing
  unpack_colors(data, cf, w) {
    const ret = [];
    const bitPerPixel = bpp(cf);
    if (bitPerPixel === 8) {
      for (let i = 0; i < data.length; i++) ret.push(data[i]);
      return ret;
    }

    if (bitPerPixel === 4) {
      if (cf === ColorFormat.A4) {
        const values = Array.from({length:16}, (_,i)=>i*17);
        for (const p of data) {
          for (let i=0;i<2;i++) {
            ret.push(values[(p >> (4 - i*4)) & 0x0f]);
            if (ret.length % w === 0) break;
          }
        }
      } else {
        const values = Array.from({length:16}, (_,i)=>i);
        for (const p of data) {
          for (let i=0;i<2;i++) {
            ret.push(values[(p >> (4 - i*4)) & 0x0f]);
            if (ret.length % w === 0) break;
          }
        }
      }
      return ret;
    }

    if (bitPerPixel === 2) {
      if (cf === ColorFormat.A2) {
        const values = [0,85,170,255];
        for (const p of data) {
          for (let i=0;i<4;i++) {
            ret.push(values[(p >> (6 - i*2)) & 0x03]);
            if (ret.length % w === 0) break;
          }
        }
      } else {
        const values = [0,1,2,3];
        for (const p of data) {
          for (let i=0;i<4;i++) {
            ret.push(values[(p >> (6 - i*2)) & 0x03]);
            if (ret.length % w === 0) break;
          }
        }
      }
      return ret;
    }

    if (bitPerPixel === 1) {
      if (cf === ColorFormat.A1) {
        const values = [0,255];
        for (const p of data) {
          for (let i=0;i<8;i++) {
            ret.push(values[(p >> (7 - i)) & 0x01]);
            if (ret.length % w === 0) break;
          }
        }
      } else {
        const values = [0,1];
        for (const p of data) {
          for (let i=0;i<8;i++) {
            ret.push(values[(p >> (7 - i)) & 0x01]);
            if (ret.length % w === 0) break;
          }
        }
      }
      return ret;
    }

    if (bitPerPixel === 16) {
      if (cf === ColorFormat.RGB565) {
        const pixels = [];
        for (let i=0;i<data.length;i+=2) pixels.push((data[i+1]<<8)|data[i]);
        for (const p of pixels) {
          ret.push(this.bit_extend((p >> 11) & 0x1f, 5));
          ret.push(this.bit_extend((p >> 5) & 0x3f, 6));
          ret.push(this.bit_extend((p >> 0) & 0x1f, 5));
        }
      } else if (cf === ColorFormat.RGB565_SWAPPED) {
        const pixels = [];
        for (let i=0;i<data.length;i+=2) pixels.push((data[i]<<8)|data[i+1]);
        for (const p of pixels) {
          ret.push(this.bit_extend((p >> 11) & 0x1f, 5));
          ret.push(this.bit_extend((p >> 5) & 0x3f, 6));
          ret.push(this.bit_extend((p >> 0) & 0x1f, 5));
        }
      } else if (cf === ColorFormat.AL88) {
        const L = [];
        const A = [];
        for (let i=0;i<data.length;i+=2) { L.push(data[i]); A.push(data[i+1]); }
        for (let i=0;i<L.length;i++) { ret.push(L[i]); ret.push(A[i]); }
      }
      return ret;
    }

    if (bitPerPixel === 24) {
      if (cf === ColorFormat.RGB888) {
        for (let i=0;i<data.length;i+=3) { ret.push(data[i+2]); ret.push(data[i+1]); ret.push(data[i]); }
      } else if (cf === ColorFormat.RGB565A8) {
        const alpha_size = Math.floor(data.length / 3);
        const pixel_alpha = data.slice(-alpha_size);
        const pixel_data = data.slice(0, data.length - alpha_size);
        const pixels = [];
        for (let i=0;i<pixel_data.length;i+=2) pixels.push((pixel_data[i+1]<<8)|pixel_data[i]);
        for (let i=0;i<pixels.length;i++) {
          const p = pixels[i];
          ret.push(this.bit_extend((p >> 11) & 0x1f,5));
          ret.push(this.bit_extend((p >> 5) & 0x3f,6));
          ret.push(this.bit_extend((p >> 0) & 0x1f,5));
          ret.push(pixel_alpha[i]);
        }
      } else if (cf === ColorFormat.ARGB8565) {
        for (let i=0;i<data.length;i+=3) {
          const l = data[i]; const h = data[i+1]; const a = data[i+2];
          const p = (h<<8)|l;
          ret.push(this.bit_extend((p >> 11) & 0x1f,5));
          ret.push(this.bit_extend((p >> 5) & 0x3f,6));
          ret.push(this.bit_extend((p >> 0) & 0x1f,5));
          ret.push(a);
        }
      }
      return ret;
    }

    if (bitPerPixel === 32) {
      for (let i=0;i<data.length;i+=4) ret.push(data[i+2], data[i+1], data[i], data[i+3]);
      return ret;
    }

    throw new Error('Unsupported bpp');
  }

  bit_extend(value, bpp) {
    if (value === 0) return 0;
    let res = value;
    let bpp_now = bpp;
    while (bpp_now < 8) { res |= value << (8 - bpp_now); bpp_now += bpp; }
    return res;
  }

  // Simple wrapper to call pngquant if available (uses pngquant-bin if installed)
  classPngQuant(ncolors=256, dither=true, execPath='', forceJS=false, forceBin=false) {
    let pngquantPath = null;
    try {
      pngquantPath = require('pngquant-bin');
    } catch (e) {
      pngquantPath = null;
    }

    return {
      convert: (filename) => {
        // If forced to use binary but not available -> error
        if (forceBin && !pngquantPath && !execPath) {
          throw new Error('pngquant binary was forced but not found; install pngquant or the npm package "pngquant-bin"');
        }

        // If user forced JS quantize, or pngquant binary not available (and JS quantize exists)
        if ((forceJS || (!pngquantPath && !execPath)) && quantize) {
          // Support filename as Buffer or data URI strings
          let png;
          if (Buffer.isBuffer(filename)) png = PNG.sync.read(filename, { inputHasAlpha: true });
          else if (typeof filename === 'string' && filename.startsWith('data:image/png;base64,')) {
            png = PNG.sync.read(Buffer.from(filename.split(',')[1], 'base64'), { inputHasAlpha: true });
          } else {
            const buf = fs.readFileSync(filename);
            png = PNG.sync.read(buf, { inputHasAlpha: true });
          }

          // Build pixel array for quantize: [[r,g,b], ...]
          const pixels = [];
          let hasTransparent = false;
          for (let y = 0; y < png.height; y++) {
            for (let x = 0; x < png.width; x++) {
              const i = (png.width * y + x) * 4;
              const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2], a = png.data[i + 3];
              if (a === 0) hasTransparent = true;
              pixels.push([r, g, b]);
            }
          }

          const cmap = quantize(pixels, ncolors);
          let pal = cmap.palette(); // array of [r,g,b]

          // Convert to palette entries with alpha
          const palWithAlpha = pal.slice(0, ncolors).map(p => [p[0], p[1], p[2], 255]);

          // If transparent pixels exist, ensure an explicit transparent palette entry
          if (hasTransparent) {
            const hasTransparentEntry = palWithAlpha.some(pp => pp[3] === 0);
            if (!hasTransparentEntry) {
              if (palWithAlpha.length < ncolors) palWithAlpha.push([0, 0, 0, 0]);
              else palWithAlpha[palWithAlpha.length - 1] = [0, 0, 0, 0];
            }
          }

          // Pad palette to ncolors
          while (palWithAlpha.length < ncolors) palWithAlpha.push([255, 255, 255, 0]);

          // Map pixels to palette indices (nearest neighbor)
          const rows = [];
          for (let y = 0; y < png.height; y++) {
            const row = [];
            for (let x = 0; x < png.width; x++) {
              const i = (png.width * y + x) * 4;
              const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2], a = png.data[i + 3];
              if (a === 0) {
                let tIndex = palWithAlpha.findIndex(p => p[3] === 0);
                if (tIndex < 0) tIndex = 0;
                row.push(tIndex);
              } else {
                let best = 0, bestDist = Infinity;
                for (let pi = 0; pi < palWithAlpha.length; pi++) {
                  const pc = palWithAlpha[pi];
                  const dr = r - pc[0], dg = g - pc[1], db = b - pc[2];
                  const dist = dr * dr + dg * dg + db * db;
                  if (dist < bestDist) { bestDist = dist; best = pi; }
                }
                row.push(best);
              }
            }
            rows.push(row);
          }

          return { palette: palWithAlpha, rows: rows, width: png.width, height: png.height };
        }

        if (!pngquantPath && execPath) {
          if (Buffer.isBuffer(filename) || (typeof filename === 'string' && filename.startsWith('data:image/png;base64,'))) {
            throw new Error('pngquant binary conversion requires a file path; provide a filename or use JS quantize (forceJS=true)');
          }
          // fallback to PATH or execPath binary
          const cmd = `${dither ? '' : '--nofs'} ${ncolors} --force - < "${filename}"`;
          try {
            return child_process.execSync(cmd, { shell: true });
          } catch (e) {
            throw new Error('pngquant not found; install pngquant or the npm package "pngquant-bin"');
          }
        }

        // resolve binary path if pngquant-bin returned an object
        let bin = pngquantPath || path.join(execPath, 'pngquant');
        if (bin && typeof bin === 'object' && bin.default) bin = bin.default;
        const args = [];
        if (!dither) args.push('--nofs');
        args.push(String(ncolors));
        args.push('--force', '--output', '-', '--', filename);

        const res = child_process.spawnSync(bin, args);
        if (res.status !== 0) {
          const err = res.stderr ? res.stderr.toString() : 'unknown error';
          throw new Error(`pngquant conversion failed: ${err}`);
        }
        return res.stdout;
      }
    };
  }

  _readPNG(input) {
    let buf;
    if (Buffer.isBuffer(input)) buf = input;
    else if (typeof input === 'string' && input.startsWith('data:image/png;base64,')) {
      buf = Buffer.from(input.split(',')[1], 'base64');
    } else if (typeof input === 'string') {
      buf = fs.readFileSync(input);
    } else {
      throw new Error('Unsupported input for PNG: expected filename, data URI, or Buffer');
    }
    // store the last input buffer so callers (e.g., to_c_array) can decide
    // whether the original input was a file (PNG/JPEG) and possibly embed
    // the original bytes when producing C arrays for RAW inputs.
    this._last_input_buf = buf;
    try {
      return PNG.sync.read(buf, {inputHasAlpha:true});
    } catch (err) {
      // Try to recover from common cases where the buffer has leading/trailing
      // garbage (e.g., some data URIs or wrapped files). First look for the PNG
      // signature (0x89 'PNG') and re-attempt parsing from there.
      const sig = Buffer.from([0x89,0x50,0x4E,0x47]);
      const pos = buf.indexOf(sig);
      if (pos > 0) {
        buf = buf.slice(pos);
        this._last_input_buf = buf;
        return PNG.sync.read(buf, {inputHasAlpha:true});
      }
      // If signature found at start but parsing failed, try trimming trailing
      // bytes after the IEND chunk in case extra bytes were appended.
      const iend = Buffer.from('IEND');
      const iendPos = buf.indexOf(iend);
      if (iendPos !== -1) {
        const endPos = iendPos + 8; // IEND + CRC
        // Only trim if it actually shortens the buffer
        if (endPos < buf.length) {
          buf = buf.slice(0, endPos);
          this._last_input_buf = buf;
          return PNG.sync.read(buf, {inputHasAlpha:true});
        }
      }
      throw err;
    }
  }

  _png_to_indexed(cf, filename) {
    // read raw PNG bytes
    let png = this._readPNG(filename);

    // For simplicity, always use pngquant when target is indexed and colors less than 256
    const auto_cf = (cf === null || cf === undefined);
    if (auto_cf) cf = ColorFormat.I8; // default

    // Possibly convert to indexed palette using pngquant or JS fallback
    let quantResult = null;
    const palette_len = png.palette ? png.palette.length : 0;
    if (!png.palette || (!auto_cf && palette_len !== ncolors(cf))) {
      const q = this.classPngQuant(ncolors(cf), true, '', this.forceJSQuant, this.forceUsePngquant);
      const res = q.convert(filename);
      if (Buffer.isBuffer(res)) {
        png = PNG.sync.read(res, {inputHasAlpha:true});
      } else if (res && res.palette && res.rows) {
        quantResult = res; // { palette: [[r,g,b,a],..], rows: [ [idx,...], ... ], width, height }
      } else {
        throw new Error('pngquant conversion returned unexpected result');
      }
    }

    // build palette (RGBA) either from quantResult, png.palette or derive from pixels
    let palette = [];
    if (quantResult) {
      palette = quantResult.palette.map(p => [p[0], p[1], p[2], p[3]]);
    } else if (png.palette) {
      palette = png.palette.map(([r,g,b,a]) => [r,g,b,a]);
    } else {
      // derive palette from unique colors in image
      const map = new Map();
      for (let y=0;y<png.height;y++) {
        for (let x=0;x<png.width;x++) {
          const i = (png.width*y + x)*4;
          const r = png.data[i]; const g = png.data[i+1]; const b = png.data[i+2]; const a = png.data[i+3];
          const key = `${r},${g},${b},${a}`;
          if (!map.has(key)) map.set(key, map.size);
        }
      }
      for (const [k,v] of map.entries()) palette.push(k.split(',').map(s=>Number(s)));
      while (palette.length < ncolors(cf)) palette.push([255,255,255,0]);
    }

    // assemble rawdata palette
    const palette_buf = Buffer.alloc(ncolors(cf)*4);
    for (let i=0;i<ncolors(cf);i++) {
      const idxv = palette[i] || [255,255,255,0];
      // Coerce/clamp each component to a valid 0..255 integer to avoid writeUInt8 range errors
      const b = Number.isFinite(Number(idxv[2])) ? (Number(idxv[2]) & 0xff) : 0;
      const g = Number.isFinite(Number(idxv[1])) ? (Number(idxv[1]) & 0xff) : 0;
      const r = Number.isFinite(Number(idxv[0])) ? (Number(idxv[0]) & 0xff) : 0;
      const a = Number.isFinite(Number(idxv[3])) ? (Number(idxv[3]) & 0xff) : 0;
      palette_buf.writeUInt8(b, i*4 + 0);
      palette_buf.writeUInt8(g, i*4 + 1);
      palette_buf.writeUInt8(r, i*4 + 2);
      palette_buf.writeUInt8(a, i*4 + 3);
    }

    // Build bitmap data: either use quantResult.rows or map pixels to palette indices
    let bitmapBuf = null;
    if (quantResult) {
      // quantResult.rows is array of rows (arrays of indices)
      if (cf === ColorFormat.I8) {
        const rowsBufs = quantResult.rows.map(r => Buffer.from(r));
        bitmapBuf = Buffer.concat(rowsBufs);
      } else {
        bitmapBuf = this.pack_rows(quantResult.rows, bpp(cf));
      }
    } else {
      // Map pixels to palette indices (exact match) and pack according to bpp
      // Build color->index map from palette
      const palMap = new Map();
      for (let pi=0; pi<palette.length; pi++) {
        const p = palette[pi];
        palMap.set(`${p[0]},${p[1]},${p[2]},${p[3]}`, pi);
      }

      if (cf === ColorFormat.I8) {
        bitmapBuf = Buffer.alloc(png.width * png.height);
        for (let y=0;y<png.height;y++) {
          for (let x=0;x<png.width;x++) {
            const i = (png.width*y + x)*4;
            const key = `${png.data[i]},${png.data[i+1]},${png.data[i+2]},${png.data[i+3]}`;
            let id = palMap.has(key) ? palMap.get(key) : 0;
            bitmapBuf[y*png.width + x] = id & 0xff;
          }
        }
      } else {
        const rows = [];
        for (let y=0;y<png.height;y++) {
          const row = [];
          for (let x=0;x<png.width;x++) {
            const i = (png.width*y + x)*4;
            const key = `${png.data[i]},${png.data[i+1]},${png.data[i+2]},${png.data[i+3]}`;
            let id = palMap.has(key) ? palMap.get(key) : 0;
            row.push(id);
          }
          rows.push(row);
        }
        bitmapBuf = this.pack_rows(rows, bpp(cf));
      }
    }

    const raw = Buffer.concat([palette_buf, bitmapBuf]);
    this.set_data(cf, png.width, png.height, raw);
  }

  _png_to_alpha_only(cf, filename) {
    const png = this._readPNG(filename);
    if (!png.alpha) throw new Error(`${filename} has no alpha channel`);

    if (cf === ColorFormat.A8) {
      const raw = Buffer.alloc(png.width * png.height);
      let pos = 0;
      for (let y=0;y<png.height;y++) for (let x=0;x<png.width;x++) { const i=(png.width*y+x)*4; raw[pos++]=png.data[i+3]; }
      this.set_data(cf, png.width, png.height, raw);
    } else {
      const shift = 8 - bpp(cf);
      const mask = (1<<bpp(cf)) - 1;
      const rows = [];
      for (let y=0;y<png.height;y++) {
        const row = [];
        for (let x=0;x<png.width;x++) { const i=(png.width*y+x)*4; row.push((png.data[i+3] >> shift) & mask); }
        rows.push(row);
      }
      const packed = this.pack_rows(rows, bpp(cf));
      this.set_data(cf, png.width, png.height, packed);
    }
  }

  _png_to_al88(cf, filename) {
    const png = this._readPNG(filename);
    if (!png.alpha) throw new Error(`${filename} has no alpha channel`);
    const raw = Buffer.alloc(png.width * png.height * 2);
    let pos = 0;
    for (let y=0;y<png.height;y++) {
      for (let x=0;x<png.width;x++) {
        const i=(png.width*y+x)*4;
        const r = png.data[i]; const g = png.data[i+1]; const b = png.data[i+2]; const a = png.data[i+3];
        const r_lin = this.sRGB_to_linear(r/255.0);
        const g_lin = this.sRGB_to_linear(g/255.0);
        const b_lin = this.sRGB_to_linear(b/255.0);
        const luma = 0.2126*r_lin + 0.7152*g_lin + 0.0722*b_lin;
        const luma_byte = Math.floor(this.linear_to_sRGB(luma)*255);
        raw[pos++] = luma_byte;
        raw[pos++] = a;
      }
    }
    this.set_data(ColorFormat.AL88, png.width, png.height, raw);
  }

  _png_to_luma_only(cf, filename) {
    const png = this._readPNG(filename);
    const raw = Buffer.alloc(png.width * png.height);
    let pos = 0;
    for (let y=0;y<png.height;y++) {
      for (let x=0;x<png.width;x++) {
        const i=(png.width*y+x)*4;
        let r = png.data[i], g = png.data[i+1], b = png.data[i+2], a = png.data[i+3];
        [r,g,b,a] = color_pre_multiply(r,g,b,a, this.background || 0);
        r = this.sRGB_to_linear(r/255.0);
        g = this.sRGB_to_linear(g/255.0);
        b = this.sRGB_to_linear(b/255.0);
        const luma = 0.2126*r + 0.7152*g + 0.0722*b;
        raw[pos++] = Math.floor(this.linear_to_sRGB(luma)*255);
      }
    }
    this.set_data(ColorFormat.L8, png.width, png.height, raw);
  }

  _png_to_raw(cf, filename) {
    const png = this._readPNG(filename);
    const out = [];
    for (let y=0;y<png.height;y++) {
      for (let x=0;x<png.width;x++) {
        const i=(png.width*y+x)*4; const r=png.data[i], g=png.data[i+1], b=png.data[i+2], a=png.data[i+3];
        if (cf === ColorFormat.RAW) {
          const [rr,gg,bb,aa] = color_pre_multiply(r,g,b,a, this.background || 0);
          out.push(uint32_t((0xff<<24)|(rr<<16)|(gg<<8)|bb));
        } else {
          out.push(uint32_t((a<<24)|(r<<16)|(g<<8)|b));
        }
      }
    }
    const raw = Buffer.concat(out.map(b=>Buffer.from(b)));
    // stride is 4 bytes per pixel for RAW formats
    this.set_data(cf, png.width, png.height, raw, png.width * 4);
  }

  _png_to_colormap(cf, filename) {
    const png = this._readPNG(filename);
    const rows = [];
    const out = [];
    const alpha = [];

    for (let y=0;y<png.height;y++) {
      for (let x=0;x<png.width;x++) {
        const i=(png.width*y+x)*4; const r=png.data[i], g=png.data[i+1], b=png.data[i+2], a=png.data[i+3];
        if (cf === ColorFormat.ARGB8888) {
          out.push(uint32_t((a<<24)|(r<<16)|(g<<8)|b));
        } else if (cf === ColorFormat.ARGB8888_PREMULTIPLIED) {
          const rr = Math.floor(r*a/255), gg = Math.floor(g*a/255), bb = Math.floor(b*a/255);
          out.push(uint32_t((a<<24)|(rr<<16)|(gg<<8)|bb));
        } else if (cf === ColorFormat.XRGB8888) {
          const [rr,gg,bb,aa] = color_pre_multiply(r,g,b,a, this.background || 0);
          out.push(uint32_t((0xff<<24)|(rr<<16)|(gg<<8)|bb));
        } else if (cf === ColorFormat.RGB888) {
          const [rr,gg,bb,aa] = color_pre_multiply(r,g,b,a, this.background || 0);
          out.push(uint24_t((rr<<16)|(gg<<8)|bb));
        } else if (cf === ColorFormat.RGB565 || cf === ColorFormat.RGB565_SWAPPED) {
          const [rr,gg,bb,aa] = color_pre_multiply(r,g,b,a, this.background || 0);
          const color = ((rr>>3)<<11) | ((gg>>2)<<5) | ((bb>>3)<<0);
          if (cf === ColorFormat.RGB565) out.push(uint16_t(color)); else out.push(swap_uint16_t(color));
        } else if (cf === ColorFormat.RGB565A8) {
          const color = ((r>>3)<<11) | ((g>>2)<<5) | ((b>>3)<<0);
          out.push(uint16_t(color)); alpha.push(uint8_t(a));
        } else if (cf === ColorFormat.ARGB8565) {
          const color = ((r>>3)<<11) | ((g>>2)<<5) | ((b>>3)<<0);
          out.push(uint24_t((a<<16)|color));
        } else if (cf === ColorFormat.RAW) {
          // RAW: no alpha channel — store as XRGB8888 (opaque)
          const [rr,gg,bb,aa] = color_pre_multiply(r,g,b,a, this.background || 0);
          out.push(uint32_t((0xff<<24)|(rr<<16)|(gg<<8)|bb));
        } else if (cf === ColorFormat.RAW_ALPHA) {
          // RAW_ALPHA: store as ARGB8888
          out.push(uint32_t((a<<24)|(r<<16)|(g<<8)|b));
        } else {
          // Generic fallbacks based on bits-per-pixel
          const bits = bpp(cf);
          if (bits === 32) {
            out.push(uint32_t((a<<24)|(r<<16)|(g<<8)|b));
          } else if (bits === 24) {
            out.push(uint24_t((r<<16)|(g<<8)|b));
          } else if (bits === 16) {
            const color = ((r>>3)<<11) | ((g>>2)<<5) | ((b>>3)<<0);
            if (cf === ColorFormat.RGB565_SWAPPED) out.push(swap_uint16_t(color)); else out.push(uint16_t(color));
            if (cf === ColorFormat.RGB565A8) alpha.push(uint8_t(a));
          } else {
            throw new Error(`Invalid color format: ${cf}`);
          }
        }
      }
    }

    let raw = Buffer.concat(out.map(b=>Buffer.from(b))).flat ? Buffer.concat(out) : Buffer.concat(out.map(x=>Buffer.from(x)));
    if (cf === ColorFormat.RGB565A8) raw = Buffer.concat([Buffer.concat(out), Buffer.concat(alpha)]);
    this.set_data(cf, png.width, png.height, raw);
  }

  from_png(filename, cf = null, background = 0x000000, rgb565_dither=false, nema_gfx=false, forceJSQuant=false, forceUsePngquant=false) {
    this.background = background;
    this.rgb565_dither = rgb565_dither;
    this.nema_gfx = nema_gfx;
    this.forceJSQuant = forceJSQuant;
    this.forceUsePngquant = forceUsePngquant;

    // Accept string names like 'ARGB8888' or numeric string values
    if (typeof cf === 'string') {
      const up = cf.toUpperCase();
      if (up === 'AUTO') cf = null;
      else if (ColorFormat.hasOwnProperty(up)) cf = ColorFormat[up];
      else {
        const n = Number(cf);
        if (!Number.isNaN(n)) cf = n; else throw new Error(`Unknown color format: ${cf}`);
      }
    }

    // guess cf from filename if none (skip for data URIs or Buffers)
    if (!cf && typeof filename === 'string' && !filename.startsWith('data:')) {
      const names = path.basename(filename).split('.');
      for (let i=1;i<names.length-1;i++) {
        if (ColorFormat.hasOwnProperty(names[i])) { cf = ColorFormat[names[i]]; break; }
      }
    }

    // Special-case: if caller provided a data URI and requested RAW/RAW_ALPHA,
    // treat it as an embedded file and avoid feeding it through pngjs (some
    // small data-URI PNGs may provoke strict parser errors). Store the raw
    // bytes in `this._last_input_buf` and set image to RAW-as-file layout.
    if ((cf === ColorFormat.RAW || cf === ColorFormat.RAW_ALPHA) && typeof filename === 'string' && filename.startsWith('data:')) {
      let buf;
      if (filename.startsWith('data:image/png;base64,')) buf = Buffer.from(filename.split(',')[1], 'base64');
      else { const parts = filename.split(','); buf = parts.length>1 ? Buffer.from(parts[1], 'base64') : Buffer.from(''); }
      this._last_input_buf = buf;
      this.cf = cf;
      this.w = 0; this.h = 0; this.stride = 0;
      this.data = buf;
      return this;
    }

    if (!cf || is_indexed(cf)) this._png_to_indexed(cf, filename);
    else if (is_alpha_only(cf)) this._png_to_alpha_only(cf, filename);
    else if (cf === ColorFormat.AL88) this._png_to_al88(cf, filename);
    else if (cf === ColorFormat.L8) this._png_to_luma_only(cf, filename);
    else if (cf === ColorFormat.RAW || cf === ColorFormat.RAW_ALPHA) this._png_to_raw(cf, filename);
    else if (has_alpha(cf) || bpp(cf) > 8) this._png_to_colormap(cf, filename);
    else {
      const cfName = Object.keys(ColorFormat).find(k => ColorFormat[k] === cf) || cf;
      throw new Error(`missing logic for ${cfName}`);
    }

    return this;
  }

  to_png(filename) {
    if (!filename.endsWith('.png')) throw new Error("filename not ended with '.png'");
    const dir = path.dirname(filename);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const old_stride = this.stride;
    // ensure stride = aligned to 1 during conversion
    // Note: no stride adjustment implemented; assume stride is fine

    let rgba = null;
    if (is_indexed(this.cf)) {
      const data = this.data;
      const palette = [];
      for (let i=0;i<ncolors(this.cf);i++) {
        const off = i*4; palette.push([data[off+2], data[off+1], data[off+0], data[off+3]]);
      }
      const bitmap = data.slice(ncolors(this.cf)*4);
      rgba = Buffer.alloc(this.w * this.h * 4);
      for (let i=0;i<this.w*this.h;i++) {
        const idx = bitmap[i]; const [r,g,b,a] = palette[idx]; const off = i*4; rgba[off]=r; rgba[off+1]=g; rgba[off+2]=b; rgba[off+3]=a;
      }
    } else if (is_alpha_only(this.cf)) {
      const transparency = this.unpack_colors(this.data, this.cf, this.w);
      rgba = Buffer.alloc(this.w * this.h * 4);
      for (let i=0;i<transparency.length;i++) { const a = transparency[i]; const off=i*4; rgba[off]=0; rgba[off+1]=0; rgba[off+2]=0; rgba[off+3]=a; }
    } else if (this.cf === ColorFormat.L8) {
      rgba = Buffer.alloc(this.w * this.h * 4);
      for (let i=0;i<this.data.length;i++) { const v = this.data[i]; const off=i*4; rgba[off]=v; rgba[off+1]=v; rgba[off+2]=v; rgba[off+3]=255; }
    } else if (this.cf === ColorFormat.AL88) {
      const arr = this.unpack_colors(this.data, this.cf, this.w);
      rgba = Buffer.alloc(this.w * this.h * 4);
      for (let i=0;i<arr.length/2;i++) { const l=arr[i*2]; const a=arr[i*2+1]; const off=i*4; rgba[off]=l; rgba[off+1]=l; rgba[off+2]=l; rgba[off+3]=a; }
    } else if (has_alpha(this.cf) || bpp(this.cf) >= 16) {
      const arr = this.unpack_colors(this.data, this.cf, this.w);
      rgba = Buffer.alloc(this.w * this.h * 4);
      for (let i=0;i<arr.length/4;i++) { const r=arr[i*4], g=arr[i*4+1], b=arr[i*4+2], a=arr[i*4+3]; const off=i*4; rgba[off]=r; rgba[off+1]=g; rgba[off+2]=b; rgba[off+3]=a; }
    } else if (this.cf === ColorFormat.RAW || this.cf === ColorFormat.RAW_ALPHA) {
      rgba = Buffer.alloc(this.w * this.h * 4);
      for (let i = 0; i < this.w * this.h; i++) {
        const off = i * 4; const b = this.data[off], g = this.data[off+1], r = this.data[off+2], a = this.data[off+3];
        const alpha = this.cf === ColorFormat.RAW ? 255 : a;
        const o = i*4; rgba[o]=r; rgba[o+1]=g; rgba[o+2]=b; rgba[o+3]=alpha;
      }
    } else {
      throw new Error(`missing logic: ${this.cf}`);
    }

    const png = new PNG({width:this.w, height:this.h});
    png.data = rgba;
    const ws = fs.createWriteStream(filename);
    png.pack().pipe(ws);
  }

  to_c_array(filename, outputname = null, compress = 'NONE') {
    if (!filename.endsWith('.c')) throw new Error("filename not ended with '.c'");
    const dir = path.dirname(filename);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // For RAW/RAW_ALPHA: if data looks like a file (PNG signature), delegate to RAWImage behavior
    if ((this.cf === ColorFormat.RAW || this.cf === ColorFormat.RAW_ALPHA) && compress === 'NONE') {
      const pngSig = Buffer.from([0x89,0x50,0x4e,0x47]);
      const hasFileSig = (this.data && this.data.length >= 4 && this.data.slice(0,4).equals(pngSig)) || (this._last_input_buf && this._last_input_buf.length >= 4 && this._last_input_buf.slice(0,4).equals(pngSig));
      if (hasFileSig) {
        // When the image was originally loaded from a file/data-uri we may want to
        // embed the original file bytes in the C array (RAW-as-file behavior).
        // Use RAWImage to produce the same layout (zeroed w/h/stride).
        const buf = (this.data && this.data.length >=4 && this.data.slice(0,4).equals(pngSig)) ? this.data : this._last_input_buf;
        const tmp = new RAWImage(this.cf, buf);
        tmp.premultiplied = this.premultiplied;
        return tmp.to_c_array(filename, outputname);
      }
    }

    let data = null;
    if (compress !== 'NONE') data = new LVGLCompressData(this.cf, compress, this.data).compressed; else data = this.data;

    const varname = outputname || path.basename(filename).split('.')[0].replace(/[-.]/g, '_');
    const flagsArr = [];
    if (compress !== 'NONE') flagsArr.push('LV_IMAGE_FLAGS_COMPRESSED');
    if (this.premultiplied) flagsArr.push('LV_IMAGE_FLAGS_PREMULTIPLIED');
    const flags = flagsArr.length ? '0 | ' + flagsArr.join(' | ') : '0';
    const macro = 'LV_ATTRIBUTE_' + varname.toUpperCase();

    let header = `#if defined(LV_LVGL_H_INCLUDE_SIMPLE)\n#include "lvgl.h"\n#elif defined(LV_LVGL_H_INCLUDE_SYSTEM)\n#include <lvgl.h>\n#elif defined(LV_BUILD_TEST)\n#include "../lvgl.h"\n#else\n#include "lvgl/lvgl.h"\n#endif\n\n#ifndef LV_ATTRIBUTE_MEM_ALIGN\n#define LV_ATTRIBUTE_MEM_ALIGN\n#endif\n\n#ifndef ${macro}\n#define ${macro}\n#endif\n\nstatic const\nLV_ATTRIBUTE_MEM_ALIGN LV_ATTRIBUTE_LARGE_CONST ${macro}\nuint8_t ${varname}_map[] = {\n`;

    const ending = `\n};\n\nconst lv_image_dsc_t ${varname} = {\n  .header = {\n    .magic = LV_IMAGE_HEADER_MAGIC,\n    .cf = LV_COLOR_FORMAT_${Object.keys(ColorFormat).find(k=>ColorFormat[k]===this.cf)||'UNKNOWN'},\n    .flags = ${flags},\n    .w = ${this.w},\n    .h = ${this.h},\n    .stride = ${this.stride},\n    .reserved_2 = 0,\n  },\n  .data_size = sizeof(${varname}_map),\n  .data = ${varname}_map,\n  .reserved = NULL,\n};\n`;

    function write_binary(f, dataBuf, stride) {
      stride = stride === 0 ? 16 : stride;
      for (let i=0;i<dataBuf.length;i++) {
        if (i % stride === 0) f.write('\r\n    ');
        f.write(`0x${dataBuf[i].toString(16).padStart(2,'0')},`);
      }
      f.write('\r\n');
    }

    const fh = fs.createWriteStream(filename, {flags:'w'});
    const normalizedHeader = '\r\n' + header.replace(/\n/g, '\r\n');
    fh.write(normalizedHeader);

    if (compress !== 'NONE') {
      write_binary(fh, data, 16);
    } else {
      const ncols = ncolors(this.cf);
      if (ncols) write_binary(fh, data.slice(0, ncols*4), 16);
      write_binary(fh, data.slice(ncols*4), this.stride);
    }

    fh.write(ending);
    fh.end();
  }

  to_c_array_as_string(filename, outputname = null, compress = 'NONE') {
    // For RAW/RAW_ALPHA: if data looks like a file (PNG signature), delegate to RAWImage-style output
    if ((this.cf === ColorFormat.RAW || this.cf === ColorFormat.RAW_ALPHA) && compress === 'NONE') {
      const pngSig = Buffer.from([0x89,0x50,0x4e,0x47]);
      const hasFileSig = (this.data && this.data.length >= 4 && this.data.slice(0,4).equals(pngSig)) || (this._last_input_buf && this._last_input_buf.length >= 4 && this._last_input_buf.slice(0,4).equals(pngSig));
      if (hasFileSig) {
        const buf = (this.data && this.data.length >=4 && this.data.slice(0,4).equals(pngSig)) ? this.data : this._last_input_buf;
        const tmp = new RAWImage(this.cf, buf);
        tmp.premultiplied = this.premultiplied;
        return tmp.to_c_array_as_string(filename, outputname);
      }
    }

    let data = null;
    if (compress !== 'NONE') data = new LVGLCompressData(this.cf, compress, this.data).compressed; else data = this.data;

    const varname = outputname || (filename ? path.basename(filename).split('.')[0].replace(/[-.]/g, '_') : 'image');
    const flagsArr = [];
    if (compress !== 'NONE') flagsArr.push('LV_IMAGE_FLAGS_COMPRESSED');
    if (this.premultiplied) flagsArr.push('LV_IMAGE_FLAGS_PREMULTIPLIED');
    const flags = flagsArr.length ? '0 | ' + flagsArr.join(' | ') : '0';
    const macro = 'LV_ATTRIBUTE_' + varname.toUpperCase();

    let header = `#if defined(LV_LVGL_H_INCLUDE_SIMPLE)\n#include "lvgl.h"\n#elif defined(LV_LVGL_H_INCLUDE_SYSTEM)\n#include <lvgl.h>\n#elif defined(LV_BUILD_TEST)\n#include "../lvgl.h"\n#else\n#include "lvgl/lvgl.h"\n#endif\n\n#ifndef LV_ATTRIBUTE_MEM_ALIGN\n#define LV_ATTRIBUTE_MEM_ALIGN\n#endif\n\n#ifndef ${macro}\n#define ${macro}\n#endif\n\nstatic const\nLV_ATTRIBUTE_MEM_ALIGN LV_ATTRIBUTE_LARGE_CONST ${macro}\nuint8_t ${varname}_map[] = {\n`;

    const ending = `\n};\n\nconst lv_image_dsc_t ${varname} = {\n  .header = {\n    .magic = LV_IMAGE_HEADER_MAGIC,\n    .cf = LV_COLOR_FORMAT_${Object.keys(ColorFormat).find(k=>ColorFormat[k]===this.cf)||'UNKNOWN'},\n    .flags = ${flags},\n    .w = ${this.w},\n    .h = ${this.h},\n    .stride = ${this.stride},\n    .reserved_2 = 0,\n  },\n  .data_size = sizeof(${varname}_map),\n  .data = ${varname}_map,\n  .reserved = NULL,\n};\n`;

    function write_binary_str(dataBuf, stride) {
      stride = stride === 0 ? 16 : stride;
      let out = '';
      for (let i=0;i<dataBuf.length;i++) {
        if (i % stride === 0) out += '\r\n    ';
        out += `0x${dataBuf[i].toString(16).padStart(2,'0')},`;
      }
      out += '\r\n';
      return out;
    }

    let outStr = '';
    outStr += '\r\n' + header.replace(/\n/g, '\r\n');

    if (compress !== 'NONE') {
      outStr += write_binary_str(data, 16);
    } else {
      const ncols = ncolors(this.cf);
      if (ncols) outStr += write_binary_str(data.slice(0, ncols*4), 16);
      outStr += write_binary_str(data.slice(ncols*4), this.stride);
    }

    outStr += ending;
    return outStr;
  }
}

module.exports = { LVGLImage, RAWImage, LVGLImageHeader, LVGLCompressData, RLEImage, ColorFormat, bpp, ncolors, is_indexed, is_alpha_only, has_alpha };

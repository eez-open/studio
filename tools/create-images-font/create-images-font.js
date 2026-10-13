#!/usr/bin/env node
//
// Creates (or updates) an "images font" in an EEZ-GUI project from SVG images.
//
// Usage: node create-images-font.js <config.json>
//
// Config JSON:
// {
//     "eez-project": "./my-project/my-project.eez-project", // relative to config file
//     "width": 48,                // glyph width in pixels
//     "height": 48,               // glyph height in pixels
//     "images": [                 // SVG images as data URLs (base64 or url-encoded) or raw SVG text
//         "data:image/svg+xml;base64,..."
//     ],
//     "name": "images",           // optional, font name (default "images")
//     "bpp": 8,                   // optional, 1, 2, 4 or 8 (default 8)
//     "encoding": 57344           // optional, encoding of the first image (default 0x0021)
// }
//
// Image i becomes glyph with encoding (encoding + i). If a font with the given
// name already exists in the project it is replaced, otherwise a new font
// (without id) is added.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Resvg } = require("@resvg/resvg-js");

function fail(message) {
    console.error("Error: " + message);
    process.exit(1);
}

function decodeSvg(image) {
    if (typeof image != "string") {
        fail("each image must be a string");
    }
    const m = image.match(/^data:image\/svg\+xml(;[^,]*)?,/i);
    if (!m) {
        if (image.trim().startsWith("<")) {
            return image;
        }
        fail("image is not an SVG data URL");
    }
    const data = image.substring(m[0].length);
    if (/;base64/i.test(m[1] || "")) {
        return Buffer.from(data, "base64").toString("utf8");
    }
    return decodeURIComponent(data);
}

// Renders SVG fitted (aspect ratio preserved) and centered in width x height
// box. Returns alpha channel (0-255) per pixel.
function renderAlpha(svg, width, height) {
    const probe = new Resvg(svg);
    const scale = Math.min(width / probe.width, height / probe.height);
    const w = Math.max(1, Math.min(width, Math.round(probe.width * scale)));
    const h = Math.max(1, Math.min(height, Math.round(probe.height * scale)));

    const rendered = new Resvg(svg, {
        fitTo: w / probe.width <= h / probe.height
            ? { mode: "width", value: w }
            : { mode: "height", value: h }
    }).render();

    const ox = Math.floor((width - rendered.width) / 2);
    const oy = Math.floor((height - rendered.height) / 2);

    const alpha = new Array(width * height).fill(0);
    const pixels = rendered.pixels;
    for (let y = 0; y < rendered.height; y++) {
        for (let x = 0; x < rendered.width; x++) {
            const dx = x + ox;
            const dy = y + oy;
            if (dx >= 0 && dx < width && dy >= 0 && dy < height) {
                alpha[dy * width + dx] = pixels[(y * rendered.width + x) * 4 + 3];
            }
        }
    }
    return alpha;
}

// Packs 8-bit alpha values to bpp, same layout as EEZ Studio font editor.
function packPixels(alpha, width, height, bpp) {
    if (bpp == 8) {
        return alpha;
    }
    const bytesPerLine = Math.floor((width * bpp + 7) / 8);
    const out = new Array(bytesPerLine * height).fill(0);
    const perByte = 8 / bpp;
    const max = (1 << bpp) - 1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const a = alpha[y * width + x];
            const v = bpp == 1 ? (a >= 128 ? 1 : 0) : Math.round((a * max) / 255);
            const shift = (perByte - 1 - (x % perByte)) * bpp;
            out[y * bytesPerLine + Math.floor(x / perByte)] |= v << shift;
        }
    }
    return out;
}

function serializePixelArray(pixelArray) {
    return pixelArray.map(p => p.toString(16).padStart(2, "0")).join("");
}

function main() {
    const configPath = process.argv[2];
    if (!configPath) {
        fail("usage: node create-images-font.js <config.json>");
    }
    const configAbsPath = path.resolve(configPath);
    const config = JSON.parse(fs.readFileSync(configAbsPath, "utf8"));

    const width = config.width;
    const height = config.height;
    const bpp = config.bpp ?? 8;
    const name = config.name ?? "images";
    const firstEncoding = config.encoding ?? 0x0021;

    if (!config["eez-project"]) fail('"eez-project" is missing in config');
    if (!Number.isInteger(width) || width < 1 || width > 255) fail('"width" must be an integer 1-255');
    if (!Number.isInteger(height) || height < 1 || height > 255) fail('"height" must be an integer 1-255');
    if (![1, 2, 4, 8].includes(bpp)) fail('"bpp" must be 1, 2, 4 or 8');
    if (!Array.isArray(config.images) || config.images.length == 0) fail('"images" must be a non-empty array');

    const projectPath = path.resolve(path.dirname(configAbsPath), config["eez-project"]);
    const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));

    project.fonts = project.fonts || [];
    const index = project.fonts.findIndex(f => f.name == name);
    const prev = index != -1 ? project.fonts[index] : undefined;

    // objIDs are never generated here (Studio generates missing ones on
    // load), but the ones of the previous font are kept so they stay stable
    const prevGlyphObjIDs = new Map(
        (prev?.glyphs ?? []).filter(g => g.objID).map(g => [g.encoding, g.objID])
    );
    const withObjID = (objID, obj) => (objID ? { objID, ...obj } : obj);

    const glyphs = config.images.map((image, i) => {
        const alpha = renderAlpha(decodeSvg(image), width, height);
        const encoding = firstEncoding + i;
        return withObjID(prevGlyphObjIDs.get(encoding), {
            encoding,
            x: 0,
            y: 0,
            width,
            height,
            dx: width,
            glyphBitmap: {
                width,
                height,
                pixelArray: serializePixelArray(packPixels(alpha, width, height, bpp))
            }
        });
    });

    // Font is always rebuilt from scratch (only id, description, alwaysBuild and the
    // objIDs of the previous font are kept); a new font gets no id.
    const font = withObjID(prev?.objID, {
        ...(prev?.id !== undefined ? { id: prev.id } : {}),
        name,
        ...(prev?.description !== undefined ? { description: prev.description } : {}),
        renderingEngine: "freetype",
        // Font.source is a required object in the project schema
        source: withObjID(prev?.source?.objID, { filePath: "", size: height }),
        bpp,
        height,
        ascent: height,
        descent: 0,
        glyphs,
        alwaysBuild: prev?.alwaysBuild ?? false,
        lvglAdditionalSources: []
    });

    if (prev) {
        project.fonts[index] = font;
    } else {
        project.fonts.push(font);
    }

    fs.writeFileSync(projectPath, JSON.stringify(project, undefined, 2));

    console.log(
        `Font "${name}" written to ${projectPath}: ${glyphs.length} glyphs, ` +
            `${width}x${height}, ${bpp} bpp, encodings ${firstEncoding}-${firstEncoding + glyphs.length - 1}`
    );
}

main();

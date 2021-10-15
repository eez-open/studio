// Your bundler file
const esbuild = require("esbuild");
const { nodeExternalsPlugin } = require("esbuild-node-externals");
const fs = require("fs");

// esbuild packages/home/main.tsx --bundle --sourcemap --metafile=meta.json --platform=node --target=node14.6
//     --external:node-ensure --external:better-sqlite3 --external:electron
//     --outfile=build/home/main.js

(async () => {
    const result = await esbuild.build({
        entryPoints: ["packages/home/main.tsx"],
        bundle: true,
        sourcemap: true,
        metafile: true,
        platform: "node",
        target: "node14.6",
        outfile: "build/home/main.js",
        external: ["node-ensure", "fs", "net", "electron"],
        plugins: [nodeExternalsPlugin()]
    });

    fs.writeFileSync("bundle-meta.json", JSON.stringify(result, undefined, 4), {
        encoding: "utf8"
    });
})();

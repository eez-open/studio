// Your bundler file
const esbuild = require("esbuild");
const { nodeExternalsPlugin } = require("esbuild-node-externals");
const fs = require("fs");

// esbuild packages/home/main.tsx --bundle --sourcemap --metafile=meta.json --platform=node --target=node14.6
//     --external:node-ensure --external:better-sqlite3 --external:electron
//     --outfile=build/home/main.js

esbuild.build({
    entryPoints: ["packages/home/main.tsx"],
    bundle: true,
    sourcemap: false,
    metafile: false,
    minify: true,
    platform: "node",
    target: "node14.6",
    outfile: "build/home/main.js",
    external: [
        "node-ensure",
        "fs",
        "net",
        "electron",
        "better-sqlite3",
        "mobx",
        "react",
        "react-dom",
        "mobx-react"
    ],
    plugins: [nodeExternalsPlugin()]
});

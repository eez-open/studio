/**
 * Preview Server for Docker Simulator
 *
 * Serves the built LVGL WebAssembly application via a local HTTP server
 * for preview in an iframe within the EEZ Studio application.
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { AddressInfo } from "net";

////////////////////////////////////////////////////////////////////////////////

const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".wasm": "application/wasm",
    ".data": "application/octet-stream",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

////////////////////////////////////////////////////////////////////////////////

export class PreviewServer {
    private server: http.Server | null = null;
    private servingPath: string = "";
    private port: number = 0;

    get isRunning(): boolean {
        return this.server !== null;
    }

    get url(): string {
        return this.port > 0 ? `http://127.0.0.1:${this.port}` : "";
    }

    /**
     * Start the preview server
     * @param buildOutputPath - Path to the directory containing the built files
     * @returns The URL where the preview is accessible
     */
    async start(buildOutputPath: string): Promise<string> {
        if (this.server) {
            await this.stop();
        }

        this.servingPath = buildOutputPath;

        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.server.on("error", err => {
                reject(err);
            });

            // Listen on a random available port
            this.server.listen(0, "127.0.0.1", () => {
                const address = this.server!.address() as AddressInfo;
                this.port = address.port;
                const url = `http://127.0.0.1:${this.port}`;
                console.log(`Preview server started at ${url}`);
                resolve(url);
            });
        });
    }

    /**
     * Stop the preview server
     */
    async stop(): Promise<void> {
        return new Promise(resolve => {
            if (this.server) {
                this.server.close(() => {
                    console.log("Preview server stopped");
                    this.server = null;
                    this.port = 0;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle incoming HTTP requests
     */
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        // Set CORS headers for Electron
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        // Handle preflight
        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }

        // Only handle GET requests
        if (req.method !== "GET") {
            res.writeHead(405);
            res.end("Method Not Allowed");
            return;
        }

        // Parse URL and get file path
        let urlPath = req.url || "/";

        // Remove query string
        const queryIndex = urlPath.indexOf("?");
        if (queryIndex !== -1) {
            urlPath = urlPath.substring(0, queryIndex);
        }

        // Default to index.html
        if (urlPath === "/") {
            urlPath = "/index.html";
        }

        // Decode URL
        urlPath = decodeURIComponent(urlPath);

        // Prevent directory traversal
        const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, "");
        const filePath = path.join(this.servingPath, safePath);

        // Check if file is within serving directory
        if (!filePath.startsWith(this.servingPath)) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
        }

        // Check if file exists
        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404);
                res.end("Not Found");
                return;
            }

            // Get MIME type
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = MIME_TYPES[ext] || "application/octet-stream";

            // For HTML files, inject console capture script
            if (ext === ".html") {
                fs.readFile(filePath, "utf8", (readErr, content) => {
                    if (readErr) {
                        res.writeHead(500);
                        res.end("Internal Server Error");
                        return;
                    }

                    // Inject console capture script at the beginning of <head>
                    const consoleScript = `<script>
(function() {
    var originalConsole = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console)
    };
    
    function formatArgs(args) {
        return Array.from(args).map(function(arg) {
            if (arg === null) return 'null';
            if (arg === undefined) return 'undefined';
            if (typeof arg === 'object') {
                try { return JSON.stringify(arg); } catch(e) { return String(arg); }
            }
            return String(arg);
        }).join(' ');
    }
    
    function sendToParent(level, args) {
        try {
            window.parent.postMessage({
                type: 'console',
                level: level,
                message: formatArgs(args)
            }, '*');
        } catch(e) {}
    }
    
    console.log = function() { sendToParent('log', arguments); originalConsole.log.apply(console, arguments); };
    console.info = function() { sendToParent('info', arguments); originalConsole.info.apply(console, arguments); };
    console.warn = function() { sendToParent('warn', arguments); originalConsole.warn.apply(console, arguments); };
    console.error = function() { sendToParent('error', arguments); originalConsole.error.apply(console, arguments); };
    console.debug = function() { sendToParent('debug', arguments); originalConsole.debug.apply(console, arguments); };
    
    // Capture uncaught errors
    window.onerror = function(msg, url, line, col, error) {
        sendToParent('error', ['Uncaught Error: ' + msg + ' at ' + url + ':' + line + ':' + col]);
    };
    
    // Capture unhandled promise rejections
    window.onunhandledrejection = function(event) {
        sendToParent('error', ['Unhandled Promise Rejection: ' + event.reason]);
    };
})();
</script>`;

                    const modifiedContent = content.replace(
                        /<head>/i,
                        "<head>" + consoleScript
                    );

                    res.setHeader("Content-Type", mimeType);
                    res.setHeader(
                        "Content-Length",
                        Buffer.byteLength(modifiedContent, "utf8")
                    );
                    res.writeHead(200);
                    res.end(modifiedContent);
                });
                return;
            }

            // Set headers
            res.setHeader("Content-Type", mimeType);
            res.setHeader("Content-Length", stats.size);

            // Special headers for WebAssembly
            if (ext === ".wasm") {
                res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
                res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
            }

            // Stream the file
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);

            stream.on("error", () => {
                res.writeHead(500);
                res.end("Internal Server Error");
            });
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

// Singleton instance
export const previewServer = new PreviewServer();

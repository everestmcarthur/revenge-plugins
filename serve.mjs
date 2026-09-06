import http from "http";
import fs from "fs";
import path from "path";
import os from "os";

const PORT = 8000;
const DIST_DIR = path.resolve("./dist");

const MIME_TYPES = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
};

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    const safeUrl = decodeURIComponent(req.url?.split("?")[0] || "/");
    let filePath = path.join(DIST_DIR, safeUrl);

    // Root blacklist.json fallback
    if (safeUrl === "/blacklist.json") {
        const rootBlacklist = path.resolve("./blacklist.json");
        if (fs.existsSync(rootBlacklist)) {
            filePath = rootBlacklist;
        }
    }

    const PRIVATE_DIST_DIR = path.resolve("../revenge-plugins-private/dist");

    // Direct /<plugin>/manifest.json or /<plugin>/index.js routing to install/ directory if needed
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        const parts = safeUrl.split("/").filter(Boolean);
        if (parts.length === 2 && (parts[1] === "manifest.json" || parts[1] === "index.js")) {
            const installFilePath = path.join(DIST_DIR, parts[0], "install", parts[1]);
            if (fs.existsSync(installFilePath) && fs.statSync(installFilePath).isFile()) {
                filePath = installFilePath;
            } else {
                const privateInstallFilePath = path.join(PRIVATE_DIST_DIR, parts[0], "install", parts[1]);
                if (fs.existsSync(privateInstallFilePath) && fs.statSync(privateInstallFilePath).isFile()) {
                    filePath = privateInstallFilePath;
                }
            }
        } else if (fs.existsSync(path.join(PRIVATE_DIST_DIR, safeUrl))) {
            filePath = path.join(PRIVATE_DIST_DIR, safeUrl);
        }
    }

    // Directory routing:
    // If requesting /<plugin>/install or /<plugin>/install/, serve manifest.json
    // Otherwise serve index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        if (filePath.endsWith("install") || filePath.endsWith("install" + path.sep)) {
            filePath = path.join(filePath, "manifest.json");
        } else {
            filePath = path.join(filePath, "index.html");
        }
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        console.log(`[404] Not Found: ${req.url} -> ${filePath}`);
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const iface of Object.values(interfaces)) {
        if (!iface) continue;
        for (const alias of iface) {
            if (alias.family === "IPv4" && !alias.internal) {
                addresses.push(alias.address);
            }
        }
    }

    console.log(`\n🚀 Server listening on port ${PORT} (0.0.0.0)`);
    console.log(`Accessible URLs:`);
    for (const addr of addresses) {
        console.log(`  - http://${addr}:${PORT}/`);
        console.log(`    • Antied:      http://${addr}:${PORT}/antied/install/`);
        console.log(`    • Antied Zero: http://${addr}:${PORT}/antied-zero/install/`);
    }
    console.log(`\nReady for device testing via Tailscale / LAN!\n`);
});

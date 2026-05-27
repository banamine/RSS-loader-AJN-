// ============ SIMPLE PROXY SERVER ==========
// Run with: node server-proxy.js

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 8080;

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Proxy endpoint: /proxy?url=...
    if (parsedUrl.pathname === '/proxy') {
        const targetUrl = parsedUrl.query.url;
        if (!targetUrl) {
            res.writeHead(400);
            res.end('Missing url parameter');
            return;
        }
        
        console.log(`Proxying: ${targetUrl}`);
        
        const protocol = targetUrl.startsWith('https') ? https : http;
        const proxyReq = protocol.get(targetUrl, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, {
                'Content-Type': proxyRes.headers['content-type']
            });
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (err) => {
            console.error('Proxy error:', err);
            res.writeHead(500);
            res.end(`Proxy error: ${err.message}`);
        });
        
        return;
    }
    
    // Serve static files
    const fs = require('fs');
    const path = require('path');
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        const ext = path.extname(filePath);
        const contentType = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json'
        }[ext] || 'text/plain';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     🚀 AJN Hourly Archive - Local Proxy Server          ║
║                                                        ║
║     Server running at: http://localhost:${PORT}         ║
║     Proxy endpoint: http://localhost:${PORT}/proxy?url=   ║
║                                                        ║
║     Press Ctrl+C to stop                                ║
╚══════════════════════════════════════════════════════════╝
    `);
});
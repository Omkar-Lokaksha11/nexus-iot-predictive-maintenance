const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ROOT = __dirname;

function generateSensorData() {
return {
temperature: Number((40 + Math.random() * 8).toFixed(1)),
vibration: Number((1.4 + Math.random() * 1.2).toFixed(2)),
rpm: Math.round(1400 + Math.random() * 120),
timestamp: new Date().toISOString()
};
}

const mimeTypes = {
".html": "text/html; charset=utf-8",
".css": "text/css; charset=utf-8",
".js": "application/javascript; charset=utf-8",
".json": "application/json; charset=utf-8",
".png": "image/png",
".jpg": "image/jpeg",
".jpeg": "image/jpeg",
".svg": "image/svg+xml",
".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {

res.setHeader("Access-Control-Allow-Origin", "*");

if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
}

if (req.method !== "GET") {
    res.writeHead(405, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
        error: "Method not allowed"
    }));

    return;
}

// ==============================
// SENSOR API
// ==============================

if (req.url === "/api/sensors") {

    const data = generateSensorData();

    res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
    });

    res.end(JSON.stringify(data));

    console.log("Sensor data sent:", data);

    return;
}

// ==============================
// WEBSITE FILES
// ==============================

let requestPath = req.url.split("?")[0];

if (requestPath === "/") {
    requestPath = "/index.html";
}

const filePath = path.join(
    ROOT,
    requestPath
);

// Security check
if (!filePath.startsWith(ROOT)) {

    res.writeHead(403, {
        "Content-Type": "text/plain"
    });

    res.end("403 Forbidden");

    return;
}

fs.readFile(
    filePath,
    (error, data) => {

        if (error) {

            res.writeHead(404, {
                "Content-Type": "text/plain"
            });

            res.end("404 - File not found");

            return;
        }

        const extension =
            path.extname(filePath)
                .toLowerCase();

        const contentType =
            mimeTypes[extension] ||
            "application/octet-stream";

        res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": "no-cache"
        });

        res.end(data);
    }
);

});

// ==============================
// SERVER ERROR
// ==============================

server.on(
"error",
(error) => {

    if (error.code === "EADDRINUSE") {

        console.error(
            "Port 3000 is already in use."
        );

        console.error(
            "Stop the previous Node server first."
        );

        return;
    }

    console.error(
        "Server error:",
        error
    );
}

);

// ==============================
// START SERVER
// ==============================

server.listen(
PORT,
() => {

    console.log("");
    console.log(
        "================================"
    );

    console.log(
        " NEXUS VIRTUAL IoT SERVER"
    );

    console.log(
        "================================"
    );

    console.log(
        "Website:    http://localhost:3000"
    );

    console.log(
        "Sensor API: http://localhost:3000/api/sensors"
    );

    console.log("");

    console.log(
        "Virtual sensor system is ONLINE."
    );

    console.log("");
}

);
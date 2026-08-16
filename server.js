const http = require("http");

const PORT = 3000;

function generateSensorData() {

    const temperature =
        40 + Math.random() * 8;

    const vibration =
        1.4 + Math.random() * 1.2;

    const rpm =
        1400 + Math.random() * 120;

    return {
        temperature: Number(temperature.toFixed(1)),
        vibration: Number(vibration.toFixed(2)),
        rpm: Math.round(rpm),
        timestamp: new Date().toISOString()
    };
}


const server = http.createServer((req, res) => {

    // CORS
    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );


    // OPTIONS request
    if (req.method === "OPTIONS") {

        res.writeHead(204);

        res.end();

        return;
    }


    // Sensor API
    if (
        req.method === "GET" &&
        req.url === "/api/sensors"
    ) {

        const data =
            generateSensorData();


        res.writeHead(
            200,
            {
                "Content-Type":
                    "application/json"
            }
        );


        res.end(
            JSON.stringify(data)
        );


        console.log(
            "Sensor data sent:",
            data
        );


        return;
    }


    // Home
    if (
        req.method === "GET" &&
        req.url === "/"
    ) {

        res.writeHead(
            200,
            {
                "Content-Type":
                    "text/plain"
            }
        );


        res.end(
            "NEXUS Virtual IoT Server is running."
        );


        return;
    }


    // 404
    res.writeHead(
        404,
        {
            "Content-Type":
                "application/json"
        }
    );


    res.end(
        JSON.stringify({
            error: "Route not found"
        })
    );

});


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
            `Server running at: http://localhost:${PORT}`
        );

        console.log(
            `Sensor API: http://localhost:${PORT}/api/sensors`
        );

        console.log("");
    }
);
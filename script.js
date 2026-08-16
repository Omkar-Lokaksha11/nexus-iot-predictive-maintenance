document.addEventListener("DOMContentLoaded", () => {
    console.log("NEXUS System Initialized");

    // ==========================================
    // ELEMENTS
    // ==========================================

    const launchButton = document.getElementById("launchButton");
    const monitoringSection = document.getElementById("monitoring");

    const healthValue = document.getElementById("healthValue");
    const temperatureValue = document.getElementById("temperatureValue");
    const vibrationValue = document.getElementById("vibrationValue");
    const rpmValue = document.getElementById("rpmValue");

    const connectionText = document.getElementById("connectionText");
    const connectionSubtext = document.getElementById("connectionSubtext");

    const canvas = document.getElementById("sensorGraph");
    const ctx = canvas ? canvas.getContext("2d") : null;

    // ==========================================
    // MACHINE DATA
    // ==========================================

    let temperature = 42;
    let vibration = 1.8;
    let rpm = 1450;

    // ==========================================
    // MODES
    // ==========================================

    let dataSource = "simulation";
    let simulationMode = "normal";
    let apiConnected = false;

    // ==========================================
    // GRAPH DATA
    // ==========================================

    const MAX_POINTS = 20;

    const temperatureHistory = [];
    const vibrationHistory = [];
    const rpmHistory = [];

    // ==========================================
    // LAUNCH BUTTON
    // ==========================================

    if (launchButton) {
        launchButton.addEventListener("click", () => {
            if (monitoringSection) {
                monitoringSection.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    }

    // ==========================================
    // SCROLL ANIMATION
    // ==========================================

    const animatedElements = document.querySelectorAll(
        ".stat-card, .flow-card"
    );

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                    }
                });
            },
            {
                threshold: 0.12
            }
        );

        animatedElements.forEach((element) => {
            observer.observe(element);
        });
    } else {
        animatedElements.forEach((element) => {
            element.classList.add("visible");
        });
    }

    // ==========================================
    // HEALTH CALCULATION
    // ==========================================

    function calculateHealth(temp, vib, motorRpm) {
        let health = 100;

        if (temp > 45) {
            health -= (temp - 45) * 4;
        }

        if (temp > 50) {
            health -= 10;
        }

        if (vib > 2.2) {
            health -= (vib - 2.2) * 18;
        }

        if (vib > 3.0) {
            health -= 12;
        }

        if (motorRpm > 1550) {
            health -= (motorRpm - 1550) / 20;
        }

        if (motorRpm < 1350) {
            health -= (1350 - motorRpm) / 20;
        }

        return Math.round(
            Math.max(
                0,
                Math.min(100, health)
            )
        );
    }

    // ==========================================
    // MACHINE STATUS
    // ==========================================

    function getMachineStatus(health) {
        if (health >= 80) {
            return {
                text: "OPTIMAL",
                level: "optimal"
            };
        }

        if (health >= 60) {
            return {
                text: "WARNING",
                level: "warning"
            };
        }

        return {
            text: "CRITICAL",
            level: "critical"
        };
    }

    // ==========================================
    // MACHINE ALERT
    // ==========================================

    function showMachineAlert(status) {
        const oldAlert = document.querySelector(".machine-alert");

        if (oldAlert) {
            oldAlert.remove();
        }

        let message = "Machine operating normally.";
        let icon = "●";

        if (status === "warning") {
            message = "Abnormal machine condition detected.";
            icon = "⚠";
        }

        if (status === "critical") {
            message = "Machine failure risk detected.";
            icon = "⚠";
        }

        const alert = document.createElement("div");

        alert.className = `machine-alert ${status}`;

        alert.innerHTML = `
            <div class="alert-icon">
                ${icon}
            </div>

            <div class="alert-content">
                <strong>
                    ${status.toUpperCase()}
                </strong>

                <span>
                    ${message}
                </span>
            </div>
        `;

        document.body.appendChild(alert);

        if (status === "optimal") {
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 2500);
        }
    }

    // ==========================================
    // SIMULATION DATA
    // ==========================================

    function generateSimulationData() {
        if (simulationMode === "normal") {
            temperature += (Math.random() - 0.5) * 1.2;
            vibration += (Math.random() - 0.5) * 0.2;
            rpm += (Math.random() - 0.5) * 50;
        }

        if (simulationMode === "warning") {
            temperature += (48 - temperature) * 0.25;
            vibration += (2.7 - vibration) * 0.25;
            rpm += (1570 - rpm) * 0.25;
        }

        if (simulationMode === "critical") {
            temperature += (54 - temperature) * 0.25;
            vibration += (3.4 - vibration) * 0.25;
            rpm += (1600 - rpm) * 0.25;
        }

        temperature = Math.max(
            35,
            Math.min(55, temperature)
        );

        vibration = Math.max(
            1,
            Math.min(3.5, vibration)
        );

        rpm = Math.max(
            1300,
            Math.min(1600, rpm)
        );
    }

    // ==========================================
    // VIRTUAL IoT API
    // ==========================================

    async function getIoTData() {
        try {
            const response = await fetch(
                "http://localhost:3000/api/sensors",
                {
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP Error ${response.status}`
                );
            }

            const data = await response.json();

            const newTemperature = Number(data.temperature);
            const newVibration = Number(data.vibration);
            const newRpm = Number(data.rpm);

            if (
                !Number.isFinite(newTemperature) ||
                !Number.isFinite(newVibration) ||
                !Number.isFinite(newRpm)
            ) {
                throw new Error("Invalid sensor data received");
            }

            temperature = newTemperature;
            vibration = newVibration;
            rpm = newRpm;

            apiConnected = true;

            if (connectionText) {
                connectionText.textContent =
                    "IoT DEVICE CONNECTED";
            }

            if (connectionSubtext) {
                connectionSubtext.textContent =
                    "Live data received from virtual IoT server";
            }

            console.log("IoT DATA:", data);

        } catch (error) {
            apiConnected = false;

            console.error(
                "IoT connection error:",
                error
            );

            if (connectionText) {
                connectionText.textContent =
                    "IoT CONNECTION ERROR";
            }

            if (connectionSubtext) {
                connectionSubtext.textContent =
                    "Check that server.js is running";
            }
        }
    }

    // ==========================================
    // HISTORY
    // ==========================================

    function updateHistory() {
        temperatureHistory.push(temperature);
        vibrationHistory.push(vibration);
        rpmHistory.push(rpm);

        if (temperatureHistory.length > MAX_POINTS) {
            temperatureHistory.shift();
        }

        if (vibrationHistory.length > MAX_POINTS) {
            vibrationHistory.shift();
        }

        if (rpmHistory.length > MAX_POINTS) {
            rpmHistory.shift();
        }
    }

    // ==========================================
    // GRAPH
    // ==========================================

    function drawGraph() {
        if (!canvas || !ctx) {
            return;
        }

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        if (!width || !height) {
            return;
        }

        ctx.clearRect(
            0,
            0,
            width,
            height
        );

        // Grid
        for (let i = 0; i <= 5; i++) {
            const y =
                20 +
                ((height - 40) * i) / 5;

            ctx.beginPath();

            ctx.moveTo(0, y);
            ctx.lineTo(width, y);

            ctx.strokeStyle =
                "rgba(255,255,255,0.07)";

            ctx.lineWidth = 1;
            ctx.stroke();
        }

        function drawLine(
            data,
            min,
            max,
            color
        ) {
            if (data.length < 2) {
                return;
            }

            ctx.beginPath();

            data.forEach((value, index) => {
                const x =
                    (index / (MAX_POINTS - 1)) *
                    width;

                const normalized =
                    (value - min) /
                    (max - min);

                const safeNormalized =
                    Math.max(
                        0,
                        Math.min(1, normalized)
                    );

                const y =
                    height -
                    safeNormalized *
                        (height - 40) -
                    20;

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";

            ctx.stroke();
        }

        drawLine(
            temperatureHistory,
            35,
            55,
            "#ff7b7b"
        );

        drawLine(
            vibrationHistory,
            1,
            3.5,
            "#ffd166"
        );

        drawLine(
            rpmHistory,
            1300,
            1600,
            "#6ea8ff"
        );
    }

    // ==========================================
    // GRAPH RESIZE
    // ==========================================

    function resizeGraph() {
        if (!canvas || !ctx) {
            return;
        }

        const rect =
            canvas.getBoundingClientRect();

        const dpr =
            window.devicePixelRatio || 1;

        canvas.width =
            rect.width * dpr;

        canvas.height =
            rect.height * dpr;

        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );

        drawGraph();
    }

    window.addEventListener(
        "resize",
        resizeGraph
    );

    // ==========================================
    // SOURCE BUTTONS
    // ==========================================

    const sourceButtons =
        document.querySelectorAll(
            ".source-button"
        );

    sourceButtons.forEach((button) => {
        button.addEventListener(
            "click",
            async () => {
                dataSource =
                    button.dataset.source ||
                    "simulation";

                sourceButtons.forEach((item) => {
                    item.classList.remove("active");
                });

                button.classList.add("active");

                if (dataSource === "simulation") {
                    if (connectionText) {
                        connectionText.textContent =
                            "SIMULATION MODE";
                    }

                    if (connectionSubtext) {
                        connectionSubtext.textContent =
                            "Local machine simulation active";
                    }
                } else {
                    if (connectionText) {
                        connectionText.textContent =
                            "CONNECTING TO IoT...";
                    }

                    if (connectionSubtext) {
                        connectionSubtext.textContent =
                            "Reading virtual sensor API";
                    }
                }

                await updateMachineData();
            }
        );
    });

    // ==========================================
    // SIMULATION MODE BUTTONS
    // ==========================================

    const controlButtons =
        document.querySelectorAll(
            ".control-button"
        );

    controlButtons.forEach((button) => {
        button.addEventListener(
            "click",
            async () => {
                simulationMode =
                    button.dataset.mode ||
                    "normal";

                controlButtons.forEach((item) => {
                    item.classList.remove("active");
                });

                button.classList.add("active");

                if (dataSource === "simulation") {
                    await updateMachineData();
                }
            }
        );
    });

    // ==========================================
    // UPDATE UI
    // ==========================================

    function updateUI(health, status) {
        if (healthValue) {
            healthValue.textContent = health;
        }

        if (temperatureValue) {
            temperatureValue.textContent =
                temperature.toFixed(1);
        }

        if (vibrationValue) {
            vibrationValue.textContent =
                vibration.toFixed(2);
        }

        if (rpmValue) {
            rpmValue.textContent =
                Math.round(rpm);
        }

        const statusElements =
            document.querySelectorAll(
                ".stat-status"
            );

        if (statusElements.length >= 4) {
            statusElements[0].textContent =
                `● ${status.text}`;

            statusElements[1].textContent =
                temperature > 48
                    ? "● HIGH"
                    : "● NORMAL";

            statusElements[2].textContent =
                vibration > 2.5
                    ? "● HIGH"
                    : "● STABLE";

            statusElements[3].textContent =
                rpm > 1550 || rpm < 1350
                    ? "● ABNORMAL"
                    : "● RUNNING";
        }
    }

    // ==========================================
    // MAIN UPDATE
    // ==========================================

    async function updateMachineData() {
        if (dataSource === "simulation") {
            generateSimulationData();

            apiConnected = false;
        } else {
            await getIoTData();
        }

        const health =
            calculateHealth(
                temperature,
                vibration,
                rpm
            );

        const status =
            getMachineStatus(health);

        updateUI(
            health,
            status
        );

        updateHistory();

        drawGraph();

        showMachineAlert(
            status.level
        );

        console.log(
            "NEXUS MACHINE DATA",
            {
                source: dataSource,
                apiConnected,
                temperature:
                    Number(temperature.toFixed(2)),
                vibration:
                    Number(vibration.toFixed(2)),
                rpm:
                    Math.round(rpm),
                health,
                status: status.text
            }
        );
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    resizeGraph();

    updateMachineData();

    // ==========================================
    // LIVE UPDATE
    // ==========================================

    setInterval(
        updateMachineData,
        2000
    );

});
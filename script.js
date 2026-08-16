// ==========================================
// NEXUS - INTELLIGENT IoT PREDICTIVE
// MAINTENANCE DASHBOARD
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("NEXUS System Initialized");

    // ==========================================
    // DOM ELEMENTS
    // ==========================================

    const launchButton =
        document.getElementById("launchButton");

    const monitoringSection =
        document.getElementById("monitoring");

    const healthValue =
        document.getElementById("healthValue");

    const temperatureValue =
        document.getElementById("temperatureValue");

    const vibrationValue =
        document.getElementById("vibrationValue");

    const rpmValue =
        document.getElementById("rpmValue");

    const statusDot =
        document.querySelector(".status-dot");

    const machineCore =
        document.querySelector(".machine-core");

    const sensors =
        document.querySelectorAll(".sensor");


    // ==========================================
    // MACHINE DATA
    // ==========================================

    let temperature = 42;

    let vibration = 1.8;

    let rpm = 1450;


    // ==========================================
    // DATA SOURCE
    // ==========================================

    let dataSource = "simulation";


    // ==========================================
    // SIMULATION MODE
    // ==========================================

    let simulationMode = "normal";


    // ==========================================
    // GRAPH DATA
    // ==========================================

    const MAX_POINTS = 20;

    const temperatureHistory = [];

    const vibrationHistory = [];

    const rpmHistory = [];


    // ==========================================
    // CANVAS
    // ==========================================

    const canvas =
        document.getElementById("sensorGraph");

    const ctx =
        canvas
            ? canvas.getContext("2d")
            : null;


    // ==========================================
    // LAUNCH MONITORING
    // ==========================================

    if (launchButton && monitoringSection) {

        launchButton.addEventListener(
            "click",
            () => {

                monitoringSection.scrollIntoView({
                    behavior: "smooth"
                });

            }
        );

    }


    // ==========================================
    // SYSTEM STATUS BLINK
    // ==========================================

    if (statusDot) {

        setInterval(() => {

            statusDot.style.opacity =
                statusDot.style.opacity === "0.3"
                    ? "1"
                    : "0.3";

        }, 800);

    }


    // ==========================================
    // SENSOR HOVER
    // ==========================================

    sensors.forEach(sensor => {

        sensor.addEventListener(
            "mouseenter",
            () => {

                sensor.style.transform =
                    "scale(1.08)";

            }
        );


        sensor.addEventListener(
            "mouseleave",
            () => {

                sensor.style.transform =
                    "scale(1)";

            }
        );

    });


    // ==========================================
    // MACHINE CORE
    // ==========================================

    if (machineCore) {

        machineCore.addEventListener(
            "click",
            () => {

                machineCore.style.transform =
                    "scale(1.15)";


                setTimeout(() => {

                    machineCore.style.transform =
                        "scale(1)";

                }, 300);

            }
        );

    }


    // ==========================================
    // SCROLL ANIMATION
    // ==========================================

    const cards =
        document.querySelectorAll(
            ".stat-card, .flow-card"
        );


    if ("IntersectionObserver" in window) {

        const observer =
            new IntersectionObserver(
                entries => {

                    entries.forEach(entry => {

                        if (
                            entry.isIntersecting
                        ) {

                            entry.target.classList.add(
                                "visible"
                            );

                        }

                    });

                },
                {
                    threshold: 0.15
                }
            );


        cards.forEach(card => {

            observer.observe(card);

        });

    }


    // ==========================================
    // HEALTH CALCULATION
    // ==========================================

    function calculateHealth(
        temp,
        vib,
        motorRpm
    ) {

        let health = 100;


        // Temperature

        if (temp > 45) {

            health -=
                (temp - 45) * 4;

        }


        if (temp > 50) {

            health -= 10;

        }


        // Vibration

        if (vib > 2.2) {

            health -=
                (vib - 2.2) * 18;

        }


        if (vib > 3.0) {

            health -= 12;

        }


        // RPM

        if (motorRpm > 1550) {

            health -=
                (motorRpm - 1550) / 20;

        }


        if (motorRpm < 1350) {

            health -=
                (1350 - motorRpm) / 20;

        }


        health =
            Math.max(
                0,
                Math.min(
                    100,
                    health
                )
            );


        return Math.round(health);

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

        const oldAlert =
            document.querySelector(
                ".machine-alert"
            );


        if (oldAlert) {

            oldAlert.remove();

        }


        let message;


        if (status === "critical") {

            message =
                "Machine failure risk detected.";

        }

        else if (status === "warning") {

            message =
                "Abnormal machine condition detected.";

        }

        else {

            message =
                "Machine operating normally.";

        }


        const alert =
            document.createElement("div");


        alert.className =
            "machine-alert " + status;


        alert.innerHTML = `

            <div class="alert-icon">

                ${status === "optimal" ? "●" : "⚠"}

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

                alert.remove();

            }, 2000);

        }

    }


    // ==========================================
    // HISTORY
    // ==========================================

    function updateHistory() {

        temperatureHistory.push(
            temperature
        );

        vibrationHistory.push(
            vibration
        );

        rpmHistory.push(
            rpm
        );


        if (
            temperatureHistory.length >
            MAX_POINTS
        ) {

            temperatureHistory.shift();

        }


        if (
            vibrationHistory.length >
            MAX_POINTS
        ) {

            vibrationHistory.shift();

        }


        if (
            rpmHistory.length >
            MAX_POINTS
        ) {

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


        const width =
            canvas.clientWidth;

        const height =
            canvas.clientHeight;


        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        // Horizontal grid

        for (
            let i = 0;
            i <= 5;
            i++
        ) {

            const y =
                20 +
                (
                    (height - 40) *
                    i /
                    5
                );


            ctx.beginPath();

            ctx.moveTo(
                0,
                y
            );

            ctx.lineTo(
                width,
                y
            );


            ctx.strokeStyle =
                "rgba(255,255,255,0.07)";

            ctx.lineWidth = 1;

            ctx.stroke();

        }


        // Vertical grid

        for (
            let i = 0;
            i <= 10;
            i++
        ) {

            const x =
                width * i / 10;


            ctx.beginPath();

            ctx.moveTo(
                x,
                0
            );

            ctx.lineTo(
                x,
                height
            );


            ctx.strokeStyle =
                "rgba(255,255,255,0.04)";

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


            data.forEach(
                (value, index) => {

                    const x =
                        (
                            index /
                            (MAX_POINTS - 1)
                        ) *
                        width;


                    const normalized =
                        (
                            value - min
                        ) /
                        (max - min);


                    const y =
                        height -
                        (
                            normalized *
                            (height - 40)
                        ) -
                        20;


                    if (index === 0) {

                        ctx.moveTo(
                            x,
                            y
                        );

                    }

                    else {

                        ctx.lineTo(
                            x,
                            y
                        );

                    }

                }
            );


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

        if (!canvas) {

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
    // SIMULATION
    // ==========================================

    function generateSimulationData() {

        if (
            simulationMode ===
            "normal"
        ) {

            temperature +=
                (
                    Math.random() - 0.5
                ) * 1.2;


            vibration +=
                (
                    Math.random() - 0.5
                ) * 0.2;


            rpm +=
                (
                    Math.random() - 0.5
                ) * 50;

        }


        else if (
            simulationMode ===
            "warning"
        ) {

            temperature +=
                (
                    48 - temperature
                ) * 0.25;


            vibration +=
                (
                    2.7 - vibration
                ) * 0.25;


            rpm +=
                (
                    1570 - rpm
                ) * 0.25;

        }


        else if (
            simulationMode ===
            "critical"
        ) {

            temperature +=
                (
                    54 - temperature
                ) * 0.25;


            vibration +=
                (
                    3.4 - vibration
                ) * 0.25;


            rpm +=
                (
                    1600 - rpm
                ) * 0.25;

        }


        temperature =
            Math.max(
                35,
                Math.min(
                    55,
                    temperature
                )
            );


        vibration =
            Math.max(
                1,
                Math.min(
                    3.5,
                    vibration
                )
            );


        rpm =
            Math.max(
                1300,
                Math.min(
                    1600,
                    rpm
                )
            );

    }


    // ==========================================
    // IoT API
    // ==========================================

    async function getIoTData() {

        try {

            const response =
                await fetch(
                    "http://localhost:3000/api/sensors"
                );


            if (!response.ok) {

                throw new Error(
                    "Sensor API connection failed"
                );

            }


            const data =
                await response.json();


            temperature =
                data.temperature;


            vibration =
                data.vibration;


            rpm =
                data.rpm;


            console.log(
                "IoT DATA:",
                data
            );

        }

        catch (error) {

            console.error(
                "IoT connection error:",
                error
            );

        }

    }


    // ==========================================
    // UPDATE DASHBOARD
    // ==========================================

    async function updateMachineData() {

        if (
            dataSource ===
            "simulation"
        ) {

            generateSimulationData();

        }

        else {

            await getIoTData();

        }


        const health =
            calculateHealth(
                temperature,
                vibration,
                rpm
            );


        const status =
            getMachineStatus(
                health
            );


        // Update values

        if (healthValue) {

            healthValue.textContent =
                health;

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


        // Status

        const statusElements =
            document.querySelectorAll(
                ".stat-status"
            );


        if (
            statusElements.length >= 4
        ) {

            statusElements[0].textContent =
                "● " +
                status.text;


            statusElements[1].textContent =
                temperature > 48
                    ? "● HIGH"
                    : "● NORMAL";


            statusElements[2].textContent =
                vibration > 2.5
                    ? "● HIGH"
                    : "● STABLE";


            statusElements[3].textContent =
                (
                    rpm > 1550 ||
                    rpm < 1350
                )
                    ? "● ABNORMAL"
                    : "● RUNNING";

        }


        // Graph

        updateHistory();

        drawGraph();


        console.log(
            "NEXUS:",
            {
                source: dataSource,
                temperature,
                vibration,
                rpm,
                health,
                status: status.text
            }
        );


        // Alert

        showMachineAlert(
            status.level
        );

    }


    // ==========================================
    // DATA SOURCE PANEL
    // ==========================================

    function createDataSourcePanel() {

        const panel =
            document.createElement(
                "div"
            );


        panel.className =
            "nexus-data-source";


        panel.innerHTML = `

            <div class="data-source-title">
                DATA SOURCE
            </div>


            <div class="data-source-status">

                <span
                    class="data-source-dot">
                </span>

                <span id="dataSourceText">
                    SIMULATION
                </span>

            </div>


            <div class="data-source-buttons">

                <button
                    class="source-button active"
                    data-source="simulation">

                    SIMULATION

                </button>


                <button
                    class="source-button"
                    data-source="iot">

                    IoT DEVICE

                </button>

            </div>

        `;


        document.body.appendChild(
            panel
        );


        const buttons =
            panel.querySelectorAll(
                ".source-button"
            );


        const sourceText =
            panel.querySelector(
                "#dataSourceText"
            );


        buttons.forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    dataSource =
                        button.dataset.source;


                    buttons.forEach(
                        btn => {

                            btn.classList.remove(
                                "active"
                            );

                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    sourceText.textContent =
                        dataSource === "simulation"
                            ? "SIMULATION"
                            : "IoT DEVICE";


                    console.log(
                        "Data source:",
                        dataSource
                    );

                }
            );

        });

    }


    // ==========================================
    // CONTROL PANEL
    // ==========================================

    function createControlPanel() {

        const panel =
            document.createElement(
                "div"
            );


        panel.className =
            "nexus-control-panel";


        panel.innerHTML = `

            <div class="control-title">
                NEXUS CONTROL
            </div>


            <div class="control-subtitle">
                MACHINE SIMULATION
            </div>


            <div class="control-buttons">

                <button
                    data-mode="normal"
                    class="control-button active">

                    NORMAL

                </button>


                <button
                    data-mode="warning"
                    class="control-button">

                    WARNING

                </button>


                <button
                    data-mode="critical"
                    class="control-button">

                    CRITICAL

                </button>

            </div>

        `;


        document.body.appendChild(
            panel
        );


        const buttons =
            panel.querySelectorAll(
                ".control-button"
            );


        buttons.forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    simulationMode =
                        button.dataset.mode;


                    buttons.forEach(
                        btn => {

                            btn.classList.remove(
                                "active"
                            );

                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    console.log(
                        "Simulation mode:",
                        simulationMode
                    );

                }
            );

        });

    }


    // ==========================================
    // INITIALIZATION
    // ==========================================

    resizeGraph();

    createDataSourcePanel();

    createControlPanel();

    updateMachineData();


    // ==========================================
    // UPDATE EVERY 2 SECONDS
    // ==========================================

    setInterval(
        updateMachineData,
        2000
    );

});
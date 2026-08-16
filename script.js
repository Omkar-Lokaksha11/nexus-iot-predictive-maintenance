// ==========================================
// NEXUS - INTELLIGENT MACHINE MONITORING
// ==========================================

document.addEventListener("DOMContentLoaded", function () {

    console.log("NEXUS system initialized.");

    // ==========================================
    // ELEMENTS
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
    // LAUNCH MONITORING
    // ==========================================

    if (launchButton && monitoringSection) {

        launchButton.addEventListener("click", function () {

            monitoringSection.scrollIntoView({
                behavior: "smooth"
            });

        });

    }


    // ==========================================
    // SYSTEM STATUS
    // ==========================================

    if (statusDot) {

        setInterval(function () {

            statusDot.style.opacity =
                statusDot.style.opacity === "0.3"
                    ? "1"
                    : "0.3";

        }, 800);

    }


    // ==========================================
    // SENSOR HOVER
    // ==========================================

    sensors.forEach(function (sensor) {

        sensor.addEventListener(
            "mouseenter",
            function () {

                sensor.style.transform =
                    "scale(1.08)";

            }
        );


        sensor.addEventListener(
            "mouseleave",
            function () {

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
            function () {

                machineCore.style.transform =
                    "scale(1.15)";

                setTimeout(function () {

                    machineCore.style.transform =
                        "scale(1)";

                }, 300);

            }
        );

    }


    // ==========================================
    // SCROLL REVEAL
    // ==========================================

    const cards =
        document.querySelectorAll(
            ".stat-card, .flow-card"
        );


    if ("IntersectionObserver" in window) {

        const observer =
            new IntersectionObserver(
                function (entries) {

                    entries.forEach(function (entry) {

                        if (entry.isIntersecting) {

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


        cards.forEach(function (card) {

            observer.observe(card);

        });

    }


    // ==========================================
    // MACHINE VARIABLES
    // ==========================================

    let temperature = 42.0;

    let vibration = 1.80;

    let rpm = 1450;


    // ==========================================
    // SIMULATION MODE
    // ==========================================

    let simulationMode = "normal";


    // ==========================================
    // HEALTH CALCULATION
    // ==========================================

    function calculateHealth(
        temperature,
        vibration,
        rpm
    ) {

        let health = 100;


        if (temperature > 45) {

            health -=
                (temperature - 45) * 4;

        }


        if (temperature > 50) {

            health -= 10;

        }


        if (vibration > 2.2) {

            health -=
                (vibration - 2.2) * 18;

        }


        if (vibration > 3.0) {

            health -= 12;

        }


        if (rpm > 1550) {

            health -=
                (rpm - 1550) / 20;

        }


        if (rpm < 1350) {

            health -=
                (1350 - rpm) / 20;

        }


        health = Math.max(
            0,
            Math.min(100, health)
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
    // ALERT SYSTEM
    // ==========================================

    function showMachineAlert(status) {

        let alertMessage = "";


        if (status === "critical") {

            alertMessage =
                "Machine failure risk detected.";

        }

        else if (status === "warning") {

            alertMessage =
                "Abnormal machine condition detected.";

        }

        else {

            alertMessage =
                "Machine operating normally.";

        }


        const existingAlert =
            document.querySelector(
                ".machine-alert"
            );


        if (existingAlert) {

            existingAlert.remove();

        }


        const alert =
            document.createElement("div");


        alert.className =
            "machine-alert " + status;


        let icon = "●";


        if (
            status === "warning" ||
            status === "critical"
        ) {

            icon = "⚠";

        }


        alert.innerHTML = `

            <div class="alert-icon">

                ${icon}

            </div>

            <div class="alert-content">

                <strong>

                    ${status.toUpperCase()}

                </strong>

                <span>

                    ${alertMessage}

                </span>

            </div>

        `;


        document.body.appendChild(alert);


        if (status === "optimal") {

            setTimeout(function () {

                if (alert) {

                    alert.remove();

                }

            }, 2000);

        }

    }


    // ==========================================
    // UPDATE MACHINE DATA
    // ==========================================

    function updateMachineData() {


        // ======================================
        // MANUAL SIMULATION MODES
        // ======================================

        if (simulationMode === "normal") {

            temperature +=
                (Math.random() - 0.5) * 1.2;

            vibration +=
                (Math.random() - 0.5) * 0.2;

            rpm +=
                (Math.random() - 0.5) * 50;

        }


        else if (simulationMode === "warning") {

            temperature +=
                (48 - temperature) * 0.25;

            vibration +=
                (2.7 - vibration) * 0.25;

            rpm +=
                (1570 - rpm) * 0.25;

        }


        else if (simulationMode === "critical") {

            temperature +=
                (54 - temperature) * 0.25;

            vibration +=
                (3.4 - vibration) * 0.25;

            rpm +=
                (1600 - rpm) * 0.25;

        }


        // ======================================
        // LIMIT VALUES
        // ======================================

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


        // ======================================
        // HEALTH
        // ======================================

        const health =
            calculateHealth(
                temperature,
                vibration,
                rpm
            );


        const status =
            getMachineStatus(health);


        // ======================================
        // ALERT
        // ======================================

        showMachineAlert(
            status.level
        );


        // ======================================
        // UPDATE VALUES
        // ======================================

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


        // ======================================
        // UPDATE STATUS
        // ======================================

        const statusElements =
            document.querySelectorAll(
                ".stat-status"
            );


        if (statusElements.length >= 4) {

            statusElements[0].textContent =
                "● " + status.text;


            statusElements[1].textContent =
                temperature > 48
                    ? "● HIGH"
                    : "● NORMAL";


            statusElements[2].textContent =
                vibration > 2.5
                    ? "● HIGH"
                    : "● STABLE";


            statusElements[3].textContent =
                rpm > 1550 ||
                rpm < 1350
                    ? "● ABNORMAL"
                    : "● RUNNING";

        }


        // ======================================
        // DEBUG
        // ======================================

        console.log(
            "NEXUS DATA",
            {
                mode: simulationMode,
                temperature:
                    temperature.toFixed(1),
                vibration:
                    vibration.toFixed(2),
                rpm:
                    Math.round(rpm),
                health:
                    health,
                status:
                    status.text
            }
        );

    }


    // ==========================================
    // CONTROL PANEL
    // ==========================================

    function createControlPanel() {

        const panel =
            document.createElement("div");


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


        document.body.appendChild(panel);


        const buttons =
            panel.querySelectorAll(
                ".control-button"
            );


        buttons.forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    simulationMode =
                        button.dataset.mode;


                    buttons.forEach(
                        function (btn) {

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
    // START CONTROL PANEL
    // ==========================================

    createControlPanel();


    // ==========================================
    // INITIAL UPDATE
    // ==========================================

    updateMachineData();


    // ==========================================
    // UPDATE EVERY 2 SECONDS
    // ==========================================

    setInterval(
        updateMachineData,
        2000
    );

});
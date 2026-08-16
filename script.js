// ==========================================
// NEXUS - INTELLIGENT MACHINE MONITORING
// ==========================================

document.addEventListener("DOMContentLoaded", function () {

    console.log("NEXUS system initialized.");

    // ==========================================
    // GET HTML ELEMENTS
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
    // MONITORING BUTTON
    // ==========================================

    if (launchButton && monitoringSection) {

        launchButton.addEventListener("click", function () {

            monitoringSection.scrollIntoView({
                behavior: "smooth"
            });

        });

    }


    // ==========================================
    // SYSTEM ONLINE INDICATOR
    // ==========================================

    if (statusDot) {

        setInterval(function () {

            if (statusDot.style.opacity === "0.3") {

                statusDot.style.opacity = "1";

            } else {

                statusDot.style.opacity = "0.3";

            }

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
    // MACHINE HEALTH CALCULATION
    // ==========================================

    function calculateHealth(
        temperature,
        vibration,
        rpm
    ) {

        let health = 100;


        // ------------------------------
        // TEMPERATURE EFFECT
        // ------------------------------

        if (temperature > 45) {

            health -=
                (temperature - 45) * 4;

        }


        if (temperature > 50) {

            health -= 10;

        }


        // ------------------------------
        // VIBRATION EFFECT
        // ------------------------------

        if (vibration > 2.2) {

            health -=
                (vibration - 2.2) * 18;

        }


        if (vibration > 3.0) {

            health -= 12;

        }


        // ------------------------------
        // RPM EFFECT
        // ------------------------------

        if (rpm > 1550) {

            health -=
                (rpm - 1550) / 20;

        }


        if (rpm < 1350) {

            health -=
                (1350 - rpm) / 20;

        }


        // ------------------------------
        // LIMIT HEALTH
        // ------------------------------

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
    // MACHINE ALERT SYSTEM
    // ==========================================

    function showMachineAlert(
        status,
        temperature,
        vibration,
        rpm
    ) {

        let alertMessage = "";


        // --------------------------------------
        // CRITICAL
        // --------------------------------------

        if (status === "critical") {

            alertMessage =
                "Machine failure risk detected.";

        }


        // --------------------------------------
        // WARNING
        // --------------------------------------

        else if (status === "warning") {

            alertMessage =
                "Abnormal machine condition detected.";

        }


        // --------------------------------------
        // OPTIMAL
        // --------------------------------------

        else {

            alertMessage =
                "Machine operating normally.";

        }


        // --------------------------------------
        // REMOVE OLD ALERT
        // --------------------------------------

        const existingAlert =
            document.querySelector(
                ".machine-alert"
            );


        if (existingAlert) {

            existingAlert.remove();

        }


        // --------------------------------------
        // CREATE ALERT
        // --------------------------------------

        const alert =
            document.createElement("div");


        alert.className =
            "machine-alert " + status;


        // --------------------------------------
        // ALERT ICON
        // --------------------------------------

        let icon = "●";


        if (status === "warning") {

            icon = "⚠";

        }


        if (status === "critical") {

            icon = "⚠";

        }


        // --------------------------------------
        // ALERT CONTENT
        // --------------------------------------

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


        // --------------------------------------
        // ADD TO PAGE
        // --------------------------------------

        document.body.appendChild(alert);


        // --------------------------------------
        // NORMAL ALERT AUTO REMOVE
        // --------------------------------------

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


        // --------------------------------------
        // SENSOR SIMULATION
        // --------------------------------------

        temperature +=
            (Math.random() - 0.5) * 2;


        vibration +=
            (Math.random() - 0.5) * 0.4;


        rpm +=
            (Math.random() - 0.5) * 80;


        // --------------------------------------
        // KEEP VALUES IN RANGE
        // --------------------------------------

        temperature = Math.max(
            35,
            Math.min(55, temperature)
        );


        vibration = Math.max(
            1.0,
            Math.min(3.5, vibration)
        );


        rpm = Math.max(
            1300,
            Math.min(1600, rpm)
        );


        // --------------------------------------
        // CALCULATE HEALTH
        // --------------------------------------

        const health =
            calculateHealth(
                temperature,
                vibration,
                rpm
            );


        // --------------------------------------
        // GET MACHINE STATUS
        // --------------------------------------

        const status =
            getMachineStatus(health);


        // --------------------------------------
        // SHOW ALERT
        // --------------------------------------

        showMachineAlert(
            status.level,
            temperature,
            vibration,
            rpm
        );


        // --------------------------------------
        // UPDATE TEMPERATURE
        // --------------------------------------

        if (temperatureValue) {

            temperatureValue.textContent =
                temperature.toFixed(1);

        }


        // --------------------------------------
        // UPDATE VIBRATION
        // --------------------------------------

        if (vibrationValue) {

            vibrationValue.textContent =
                vibration.toFixed(2);

        }


        // --------------------------------------
        // UPDATE RPM
        // --------------------------------------

        if (rpmValue) {

            rpmValue.textContent =
                Math.round(rpm);

        }


        // --------------------------------------
        // UPDATE HEALTH
        // --------------------------------------

        if (healthValue) {

            healthValue.textContent =
                health;

        }


        // --------------------------------------
        // UPDATE STATUS TEXT
        // --------------------------------------

        const statusElements =
            document.querySelectorAll(
                ".stat-status"
            );


        if (statusElements.length >= 4) {


            // Machine Health

            statusElements[0].textContent =
                "● " + status.text;


            // Temperature

            statusElements[1].textContent =
                temperature > 48
                    ? "● HIGH"
                    : "● NORMAL";


            // Vibration

            statusElements[2].textContent =
                vibration > 2.5
                    ? "● HIGH"
                    : "● STABLE";


            // RPM

            statusElements[3].textContent =
                rpm > 1550 ||
                rpm < 1350
                    ? "● ABNORMAL"
                    : "● RUNNING";

        }


        // --------------------------------------
        // CONSOLE DATA
        // --------------------------------------

        console.log(
            "NEXUS LIVE DATA",
            {
                temperature:
                    temperature.toFixed(1)
                    + " °C",

                vibration:
                    vibration.toFixed(2)
                    + " mm/s",

                rpm:
                    Math.round(rpm),

                health:
                    health + "%",

                status:
                    status.text
            }
        );

    }


    // ==========================================
    // INITIAL DATA UPDATE
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
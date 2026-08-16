// ==========================================
// NEXUS - MACHINE INTELLIGENCE SYSTEM
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

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

    const sensors =
        document.querySelectorAll(".sensor");

    const machineCore =
        document.querySelector(".machine-core");


    // ==========================================
    // LAUNCH MONITORING
    // ==========================================

    if (launchButton && monitoringSection) {

        launchButton.addEventListener("click", () => {

            monitoringSection.scrollIntoView({
                behavior: "smooth"
            });

        });

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

    sensors.forEach((sensor) => {

        sensor.addEventListener("mouseenter", () => {

            sensor.style.transform = "scale(1.08)";

        });


        sensor.addEventListener("mouseleave", () => {

            sensor.style.transform = "scale(1)";

        });

    });


    // ==========================================
    // MACHINE CORE INTERACTION
    // ==========================================

    if (machineCore) {

        machineCore.addEventListener("click", () => {

            machineCore.style.transform =
                "scale(1.15)";

            setTimeout(() => {

                machineCore.style.transform =
                    "scale(1)";

            }, 300);

        });

    }


    // ==========================================
    // SCROLL REVEAL
    // ==========================================

    const cards = document.querySelectorAll(
        ".stat-card, .flow-card"
    );


    const observer = new IntersectionObserver(
        (entries) => {

            entries.forEach((entry) => {

                if (entry.isIntersecting) {

                    entry.target.classList.add("visible");

                }

            });

        },
        {
            threshold: 0.15
        }
    );


    cards.forEach((card) => {

        observer.observe(card);

    });


    // ==========================================
    // LIVE MACHINE DATA SIMULATION
    // ==========================================

    let temperature = 42;
    let vibration = 1.8;
    let rpm = 1450;


    function updateMachineData() {

        // Temperature variation
        temperature +=
            (Math.random() - 0.5) * 1.2;


        // Vibration variation
        vibration +=
            (Math.random() - 0.5) * 0.25;


        // RPM variation
        rpm +=
            (Math.random() - 0.5) * 30;


        // Keep values within realistic demo range
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


        // ======================================
        // MACHINE HEALTH CALCULATION
        // ======================================

        let health = 100;


        // Temperature penalty
        if (temperature > 45) {

            health -=
                (temperature - 45) * 2;

        }


        // Vibration penalty
        if (vibration > 2.2) {

            health -=
                (vibration - 2.2) * 12;

        }


        // RPM penalty
        if (rpm > 1550 || rpm < 1350) {

            health -= 5;

        }


        health = Math.max(
            0,
            Math.min(100, health)
        );


        // ======================================
        // UPDATE UI
        // ======================================

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


        if (healthValue) {

            healthValue.textContent =
                Math.round(health);

        }

    }


    // ==========================================
    // START LIVE DATA
    // ==========================================

    updateMachineData();

    setInterval(
        updateMachineData,
        2000
    );


});
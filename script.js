// ==========================================
// NEXUS — INTERACTIVE SYSTEM
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("NEXUS system initialized.");

    // ------------------------------------------
    // Launch Monitoring Button
    // ------------------------------------------

    const launchButton = document.getElementById("launchButton");
    const monitoringSection = document.getElementById("monitoring");

    if (launchButton && monitoringSection) {

        launchButton.addEventListener("click", () => {

            monitoringSection.scrollIntoView({
                behavior: "smooth"
            });

        });

    }


    // ------------------------------------------
    // System Status Animation
    // ------------------------------------------

    const statusDot = document.querySelector(".status-dot");

    if (statusDot) {

        setInterval(() => {

            statusDot.style.opacity =
                statusDot.style.opacity === "0.3"
                    ? "1"
                    : "0.3";

        }, 800);

    }


    // ------------------------------------------
    // Sensor Animation
    // ------------------------------------------

    const sensors = document.querySelectorAll(".sensor");

    sensors.forEach((sensor, index) => {

        sensor.addEventListener("mouseenter", () => {

            sensor.style.transform = "scale(1.08)";

        });

        sensor.addEventListener("mouseleave", () => {

            sensor.style.transform = "scale(1)";

        });

    });


    // ------------------------------------------
    // Machine Core Interaction
    // ------------------------------------------

    const machineCore = document.querySelector(".machine-core");

    if (machineCore) {

        machineCore.addEventListener("click", () => {

            machineCore.style.transform = "scale(1.15)";

            setTimeout(() => {

                machineCore.style.transform = "scale(1)";

            }, 300);

        });

    }


    // ------------------------------------------
    // Reveal Sections on Scroll
    // ------------------------------------------

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

});
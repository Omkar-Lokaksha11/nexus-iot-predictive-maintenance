/**
 * SMARTTWIN AI - Frontend Client Controller
 * AI-Based Digital Twin for Smart Manufacturing Using Predictive Maintenance
 * Full-stack integration with FastAPI backend, SQLite, and Scikit-learn ML pipeline.
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log("[SmartTwin AI] Initializing dashboard interface...");

    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================
    const state = {
        activeSection: "overview",
        isSimPaused: false,
        activeScenario: "normal",
        machineType: "M",
        tempUnit: "K", // 'K' or 'C'
        isFetchingTelemetry: false,
        telemetryTimer: null,
        telemetryHistory: [],
        alerts: [],
        maintenanceEvents: [],
        modelMetrics: null
    };

    // =========================================================================
    // TOAST NOTIFICATION HELPER
    // =========================================================================
    const toastContainer = document.getElementById("toastContainer");

    function showToast(type, title, message) {
        if (!toastContainer) return;

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;

        const icons = {
            success: "✓",
            warning: "⚠",
            error: "✖",
            info: "ℹ"
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || "ℹ"}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${message}</div>
            </div>
            <button class="toast-close" type="button" aria-label="Close notification">&times;</button>
        `;

        const closeBtn = toast.querySelector(".toast-close");
        closeBtn.addEventListener("click", () => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(20px)";
            setTimeout(() => toast.remove(), 300);
        });

        toastContainer.appendChild(toast);

        // Auto remove after 3.5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = "0";
                toast.style.transform = "translateX(20px)";
                setTimeout(() => toast.remove(), 300);
            }
        }, 3500);
    }

    // =========================================================================
    // WELCOME SCREEN MANAGEMENT (PHASE 4)
    // =========================================================================
    const welcomeScreen = document.getElementById("welcomeScreen");
    const appLayout = document.getElementById("appLayout");
    const btnLaunchDashboard = document.getElementById("btnLaunchDashboard");
    const btnExploreWelcome = document.getElementById("btnExploreWelcome");
    const btnSkipWelcome = document.getElementById("btnSkipWelcome");
    const btnReturnWelcome = document.getElementById("btnReturnWelcome");

    function enterDashboard(targetSection = "overview") {
        if (!welcomeScreen || !appLayout) return;

        welcomeScreen.classList.add("hiding");
        setTimeout(() => {
            welcomeScreen.style.display = "none";
            appLayout.style.display = "flex";
            switchSection(targetSection);
            resizeCanvas();
            // Start streaming telemetry
            startTelemetryLoop();
        }, 350);
    }

    function returnToWelcome() {
        if (!welcomeScreen || !appLayout) return;

        stopTelemetryLoop();
        welcomeScreen.style.display = "flex";
        welcomeScreen.classList.remove("hiding");
        appLayout.style.display = "none";
    }

    if (btnLaunchDashboard) btnLaunchDashboard.addEventListener("click", () => enterDashboard("overview"));
    if (btnSkipWelcome) btnSkipWelcome.addEventListener("click", () => enterDashboard("overview"));
    if (btnExploreWelcome) btnExploreWelcome.addEventListener("click", () => enterDashboard("about"));
    if (btnReturnWelcome) btnReturnWelcome.addEventListener("click", returnToWelcome);

    // =========================================================================
    // DOM REFERENCES
    // =========================================================================
    const sidebar = document.getElementById("sidebar");
    const menuToggle = document.getElementById("menuToggle");
    const pageTitle = document.getElementById("pageTitle");
    const pageSubtitle = document.getElementById("pageSubtitle");
    const navButtons = document.querySelectorAll(".nav-item");
    const appSections = document.querySelectorAll(".app-section");

    const systemStatusDot = document.getElementById("systemStatusDot");
    const systemStatusText = document.getElementById("systemStatusText");
    const modelStatusDetail = document.getElementById("modelStatusDetail");
    const alertCountBadge = document.getElementById("alertCountBadge");

    const scenarioSelect = document.getElementById("scenarioSelect");
    const btnSimPauseResume = document.getElementById("btnSimPauseResume");
    const simPauseIcon = document.getElementById("simPauseIcon");
    const simPauseText = document.getElementById("simPauseText");
    const btnSimReset = document.getElementById("btnSimReset");

    // Canvas
    const canvas = document.getElementById("liveTelemetryCanvas");
    const ctx = canvas ? canvas.getContext("2d") : null;

    // =========================================================================
    // NAVIGATION & SECTION SWITCHING
    // =========================================================================
    const sectionMetadata = {
        "overview": {
            title: "Overview Dashboard",
            sub: "Real-time industrial machine telemetry & predictive intelligence"
        },
        "digital-twin": {
            title: "Digital Twin Simulation",
            sub: "Interactive 2D virtual machine kinematics, thermal gradients, and state modeling"
        },
        "monitoring": {
            title: "Live Machine Telemetry",
            sub: "Continuous sensor streams, threshold monitoring, and rolling time-series trend"
        },
        "prediction": {
            title: "AI Failure Prediction",
            sub: "On-demand machine learning inference through trained Scikit-learn pipeline"
        },
        "alerts": {
            title: "Alert Centre",
            sub: "Persisted warning & critical events with ML failure vs physics rule attribution"
        },
        "maintenance": {
            title: "Maintenance History & Service Log",
            sub: "Searchable records of inspections, tool replacements, calibrations, and CSV export"
        },
        "model-perf": {
            title: "Model Performance & Validation",
            sub: "Real evaluation metrics, confusion matrix, and feature importances on AI4I 2020 dataset"
        },
        "about": {
            title: "Project Architecture & Scope",
            sub: "Mechanical engineering objectives, methodology, limitations, and future work"
        }
    };

    function switchSection(sectionId) {
        if (!sectionMetadata[sectionId]) return;

        state.activeSection = sectionId;

        // Update Nav UI
        navButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.section === sectionId);
        });

        // Update Sections
        appSections.forEach(sec => {
            sec.classList.toggle("active", sec.id === `section-${sectionId}`);
        });

        // Update Header Titles
        pageTitle.textContent = sectionMetadata[sectionId].title;
        pageSubtitle.textContent = sectionMetadata[sectionId].sub;

        // Close sidebar on mobile
        if (sidebar && sidebar.classList.contains("open")) {
            sidebar.classList.remove("open");
        }

        // Trigger section specific refreshes
        if (sectionId === "alerts") {
            loadAlerts();
        } else if (sectionId === "maintenance") {
            loadMaintenanceHistory();
        } else if (sectionId === "model-perf") {
            loadModelMetrics();
        } else if (sectionId === "monitoring") {
            resizeCanvas();
        }
    }

    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            switchSection(btn.dataset.section);
        });
    });

    document.querySelectorAll("[data-jump-to]").forEach(btn => {
        btn.addEventListener("click", () => {
            switchSection(btn.dataset.jumpTo);
        });
    });

    if (menuToggle) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }

    // =========================================================================
    // API HEALTH & BACKEND INITIALIZATION
    // =========================================================================
    async function checkBackendHealth() {
        try {
            const resp = await fetch("/api/health");
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            systemStatusDot.style.background = "#35d5a4";
            systemStatusDot.style.boxShadow = "0 0 10px #35d5a4";
            systemStatusText.textContent = "Backend: Online";

            if (data.model_loaded) {
                modelStatusDetail.textContent = "ML Pipeline: Active (Balanced RF)";
                modelStatusDetail.style.color = "#00e5ff";
            } else {
                modelStatusDetail.textContent = "ML Pipeline: Not Loaded";
                modelStatusDetail.style.color = "#ffb703";
            }

            // Sync scenario & pause state
            if (data.active_scenario) {
                state.activeScenario = data.active_scenario;
                if (scenarioSelect) scenarioSelect.value = data.active_scenario;
                updateScenarioButtonsUI(data.active_scenario);
            }
            state.isSimPaused = !data.simulator_running;
            updatePauseButtonUI();

        } catch (err) {
            console.warn("[SmartTwin AI] Backend health check failed:", err);
            systemStatusDot.style.background = "#ff4d4f";
            systemStatusDot.style.boxShadow = "0 0 10px #ff4d4f";
            systemStatusText.textContent = "Backend: Offline";
            modelStatusDetail.textContent = "Cannot reach FastAPI server";
        }
    }

    // =========================================================================
    // SIMULATOR CONTROLS & SCENARIO SYNCHRONIZATION (PHASE 7)
    // =========================================================================
    function updatePauseButtonUI() {
        if (!simPauseIcon || !simPauseText || !btnSimPauseResume) return;

        if (state.isSimPaused) {
            simPauseIcon.textContent = "▶";
            simPauseText.textContent = "Resume";
            btnSimPauseResume.classList.add("active");
            const telemStatus = document.getElementById("telemetryStatusText");
            if (telemStatus) telemStatus.textContent = "TELEMETRY PAUSED";
        } else {
            simPauseIcon.textContent = "⏸";
            simPauseText.textContent = "Pause";
            btnSimPauseResume.classList.remove("active");
            const telemStatus = document.getElementById("telemetryStatusText");
            if (telemStatus) telemStatus.textContent = "TELEMETRY STREAMING ACTIVE";
        }
    }

    if (btnSimPauseResume) {
        btnSimPauseResume.addEventListener("click", async () => {
            const action = state.isSimPaused ? "resume" : "pause";
            try {
                const resp = await fetch("/api/simulator/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action })
                });
                const data = await resp.json();
                state.isSimPaused = data.is_paused;
                updatePauseButtonUI();
                showToast("info", "Simulator State", state.isSimPaused ? "Simulation paused." : "Simulation resumed.");
            } catch (err) {
                console.error("Failed to toggle simulator pause state:", err);
                showToast("error", "Simulator Error", "Could not reach backend.");
            }
        });
    }

    if (btnSimReset) {
        btnSimReset.addEventListener("click", async () => {
            try {
                const resp = await fetch("/api/simulator/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "reset", scenario: "normal" })
                });
                const data = await resp.json();
                state.isSimPaused = data.is_paused;
                state.activeScenario = "normal";
                if (scenarioSelect) scenarioSelect.value = "normal";
                updateScenarioButtonsUI("normal");
                updatePauseButtonUI();
                await fetchTelemetry(false);
                showToast("success", "Simulator Reset", "Machine reset to nominal factory baseline.");
            } catch (err) {
                console.error("Failed to reset simulator:", err);
                showToast("error", "Reset Error", "Could not reset simulator.");
            }
        });
    }

    if (scenarioSelect) {
        scenarioSelect.addEventListener("change", async (e) => {
            const newScenario = e.target.value;
            setScenario(newScenario);
        });
    }

    async function setScenario(newScenario) {
        try {
            const resp = await fetch("/api/simulator/control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scenario: newScenario })
            });
            const data = await resp.json();
            state.activeScenario = data.active_scenario;
            if (scenarioSelect) scenarioSelect.value = state.activeScenario;
            updateScenarioButtonsUI(state.activeScenario);
            showToast("info", "Scenario Activated", `Active demonstration scenario: ${state.activeScenario.toUpperCase()}`);
        } catch (err) {
            console.error("Failed to set scenario:", err);
        }
    }

    function updateScenarioButtonsUI(scen) {
        document.querySelectorAll(".scenario-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.scenario === scen);
        });
    }

    document.querySelectorAll(".scenario-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setScenario(btn.dataset.scenario);
        });
    });

    document.querySelectorAll(".pill-btn[data-variant]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const variant = btn.dataset.variant;
            document.querySelectorAll(".pill-btn[data-variant]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.machineType = variant;
            await fetch("/api/simulator/control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ machine_type: variant })
            });
            const variantLabel = document.getElementById("twinCurrentVariant");
            if (variantLabel) {
                variantLabel.textContent = `Type ${variant} (${variant === 'L' ? 'Low' : (variant === 'M' ? 'Medium' : 'High')})`;
            }
            showToast("info", "Quality Variant", `Machine variant set to Type ${variant}`);
        });
    });

    // =========================================================================
    // TELEMETRY ENGINE & UI UPDATER (PHASE 6: UNIFIED STATUS LOGIC)
    // =========================================================================
    async function fetchTelemetry(step = true) {
        if (state.isFetchingTelemetry) return;
        state.isFetchingTelemetry = true;

        try {
            const resp = await fetch(`/api/simulator/readings?step=${step}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            if (data.success && data.current) {
                updateOverviewUI(data.current);
                updateDigitalTwinUI(data.current);
                updateNumericalTelemetryUI(data.current);

                if (data.history && data.history.length > 0) {
                    state.telemetryHistory = data.history;
                } else {
                    state.telemetryHistory.push(data.current);
                    if (state.telemetryHistory.length > 50) state.telemetryHistory.shift();
                }

                drawLiveTelemetryChart();
            }
        } catch (err) {
            console.warn("[SmartTwin AI] Telemetry fetch error:", err);
        } finally {
            state.isFetchingTelemetry = false;
        }
    }

    function updateOverviewUI(curr) {
        // Health Score & Unified Condition
        const healthVal = document.getElementById("overviewHealthVal");
        const healthBar = document.getElementById("overviewHealthBar");
        const healthBadge = document.getElementById("overviewHealthBadge");
        if (healthVal) healthVal.textContent = Math.round(curr.health_score);
        if (healthBar) healthBar.style.width = `${Math.min(100, Math.max(0, curr.health_score))}%`;

        const compositeStatus = curr.overall_status || "OPTIMAL";

        if (healthBadge) {
            if (compositeStatus === "OPTIMAL") {
                healthBadge.className = "badge badge-success";
                healthBadge.textContent = "OPTIMAL";
                if (healthBar) healthBar.style.background = "#35d5a4";
            } else if (compositeStatus === "WARNING") {
                healthBadge.className = "badge badge-warning";
                healthBadge.textContent = "WARNING";
                if (healthBar) healthBar.style.background = "#ffb703";
            } else {
                healthBadge.className = "badge badge-danger";
                healthBadge.textContent = "CRITICAL";
                if (healthBar) healthBar.style.background = "#ff4d4f";
            }
        }

        // ML Failure Probability
        const failVal = document.getElementById("overviewFailVal");
        const failBadge = document.getElementById("overviewFailBadge");
        const mlPred = curr.ml_prediction || {};
        const failProb = mlPred.failure_probability_percentage !== undefined ? mlPred.failure_probability_percentage : 0.0;

        if (failVal) failVal.textContent = failProb.toFixed(1);
        if (failBadge) {
            if (failProb < 20.0) {
                failBadge.className = "badge badge-info";
                failBadge.textContent = "LOW RISK";
            } else if (failProb < 50.0) {
                failBadge.className = "badge badge-warning";
                failBadge.textContent = "MODERATE RISK";
            } else {
                failBadge.className = "badge badge-danger";
                failBadge.textContent = "HIGH FAILURE RISK";
            }
        }

        // RPM & Torque
        const rpmVal = document.getElementById("overviewRpmVal");
        const torqueVal = document.getElementById("overviewTorqueVal");
        if (rpmVal) rpmVal.textContent = Math.round(curr.rotational_speed);
        if (torqueVal) torqueVal.textContent = curr.torque.toFixed(1);

        // Temperatures, Tool Wear, Vibration
        const airTemp = document.getElementById("overviewAirTemp");
        const airTempK = document.getElementById("overviewAirTempK");
        const procTemp = document.getElementById("overviewProcTemp");
        const procTempK = document.getElementById("overviewProcTempK");
        const wearVal = document.getElementById("overviewToolWear");
        const vibVal = document.getElementById("overviewVibration");

        if (airTemp) airTemp.textContent = curr.air_temperature_c.toFixed(1);
        if (airTempK) airTempK.textContent = `(${curr.air_temperature_k.toFixed(1)} K)`;
        if (procTemp) procTemp.textContent = curr.process_temperature_c.toFixed(1);
        if (procTempK) procTempK.textContent = `(${curr.process_temperature_k.toFixed(1)} K)`;
        if (wearVal) wearVal.textContent = curr.tool_wear.toFixed(1);
        if (vibVal) vibVal.textContent = curr.vibration.toFixed(2);
    }

    function updateDigitalTwinUI(curr) {
        const mainRotor = document.getElementById("mainRotorGroup");
        const previewRotor = document.getElementById("previewRotor");
        const rpm = curr.rotational_speed || 1500;
        const durationSec = Math.max(0.4, (60 / rpm) * 35).toFixed(2);

        if (mainRotor) mainRotor.style.animationDuration = `${durationSec}s`;
        if (previewRotor) previewRotor.style.animationDuration = `${durationSec}s`;

        // SVG Callouts
        const calloutTemp = document.getElementById("twinTempCallout");
        const calloutRpm = document.getElementById("twinRpmCallout");
        const calloutTorque = document.getElementById("twinTorqueCallout");
        const calloutWear = document.getElementById("twinWearCallout");

        if (calloutTemp) calloutTemp.textContent = `${curr.process_temperature_c.toFixed(1)} °C`;
        if (calloutRpm) calloutRpm.textContent = `${Math.round(curr.rotational_speed)} RPM`;
        if (calloutTorque) calloutTorque.textContent = `${curr.torque.toFixed(1)} Nm`;
        if (calloutWear) calloutWear.textContent = `${Math.round(curr.tool_wear)} min`;

        // Thermal Overlay
        const heatStop1 = document.getElementById("heatStop1");
        const heatStop2 = document.getElementById("heatStop2");
        if (curr.process_temperature_c > 42.0) {
            if (heatStop1) heatStop1.setAttribute("stop-color", "#ff4d4f");
            if (heatStop2) heatStop2.setAttribute("stop-color", "#ff7b7b");
        } else {
            if (heatStop1) heatStop1.setAttribute("stop-color", "#00e5ff");
            if (heatStop2) heatStop2.setAttribute("stop-color", "#087f8c");
        }

        // Status Badge
        const twinBadge = document.getElementById("twinStatusBadge");
        if (twinBadge) {
            const comp = curr.overall_status || "OPTIMAL";
            if (comp === "OPTIMAL") {
                twinBadge.textContent = "ONLINE • NORMAL";
                twinBadge.className = "badge badge-outline";
            } else if (comp === "WARNING") {
                twinBadge.textContent = "ELEVATED RISK";
                twinBadge.className = "badge badge-warning";
            } else {
                twinBadge.textContent = "CRITICAL FAULT DETECTED";
                twinBadge.className = "badge badge-danger";
            }
        }

        // Physics summary
        const deltaT = document.getElementById("twinDeltaT");
        const powerElem = document.getElementById("twinPower");
        const overstrain = document.getElementById("twinOverstrain");
        const vibElem = document.getElementById("twinVibText");

        const dt = (curr.process_temperature_k - curr.air_temperature_k).toFixed(1);
        const rads = curr.rotational_speed * (2 * Math.PI / 60);
        const pWatts = Math.round(curr.torque * rads);
        const osProduct = Math.round(curr.tool_wear * curr.torque);

        if (deltaT) deltaT.textContent = `${dt} K`;
        if (powerElem) powerElem.textContent = `${pWatts.toLocaleString()} W`;
        if (overstrain) overstrain.textContent = osProduct.toLocaleString();
        if (vibElem) vibElem.textContent = `${curr.vibration.toFixed(2)} mm/s`;

        const scenLabel = document.getElementById("twinCurrentScenario");
        if (scenLabel) scenLabel.textContent = curr.operating_mode ? curr.operating_mode.toUpperCase() : "NORMAL";

        const diagSub = document.getElementById("twinDiagnosticSummary");
        if (diagSub) {
            if (curr.ml_diagnostics && curr.ml_diagnostics.suspected_modes && curr.ml_diagnostics.suspected_modes.length > 0) {
                diagSub.textContent = curr.ml_diagnostics.suspected_modes[0].reason;
                diagSub.style.color = "#ffb703";
            } else {
                diagSub.textContent = "Parameters within normal operating bounds.";
                diagSub.style.color = "#94a3b8";
            }
        }
    }

    function updateNumericalTelemetryUI(curr) {
        const numAirK = document.getElementById("numAirK");
        const numAirC = document.getElementById("numAirC");
        const numProcK = document.getElementById("numProcK");
        const numProcC = document.getElementById("numProcC");
        const numRpm = document.getElementById("numRpm");
        const numAngular = document.getElementById("numAngular");
        const numTorque = document.getElementById("numTorque");
        const numPowerCalc = document.getElementById("numPowerCalc");
        const numWear = document.getElementById("numWear");
        const numVib = document.getElementById("numVib");

        if (numAirK) numAirK.textContent = `${curr.air_temperature_k.toFixed(1)} K`;
        if (numAirC) numAirC.textContent = `${curr.air_temperature_c.toFixed(1)} °C`;
        if (numProcK) numProcK.textContent = `${curr.process_temperature_k.toFixed(1)} K`;
        if (numProcC) numProcC.textContent = `${curr.process_temperature_c.toFixed(1)} °C`;
        if (numRpm) numRpm.textContent = `${Math.round(curr.rotational_speed)} RPM`;
        if (numAngular) numAngular.textContent = `${(curr.rotational_speed * 2 * Math.PI / 60).toFixed(1)} rad/s`;
        if (numTorque) numTorque.textContent = `${curr.torque.toFixed(1)} Nm`;

        const powerKw = ((curr.torque * curr.rotational_speed * 2 * Math.PI / 60) / 1000).toFixed(1);
        if (numPowerCalc) numPowerCalc.textContent = `${powerKw} kW Power`;
        if (numWear) numWear.textContent = `${curr.tool_wear.toFixed(1)} min`;
        if (numVib) numVib.textContent = `${curr.vibration.toFixed(2)} mm/s`;
    }

    // =========================================================================
    // MULTI-CHANNEL TELEMETRY CANVAS CHART (PHASE 9)
    // =========================================================================
    function resizeCanvas() {
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawLiveTelemetryChart();
    }

    window.addEventListener("resize", resizeCanvas);

    function drawLiveTelemetryChart() {
        if (!canvas || !ctx) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h) return;

        ctx.clearRect(0, 0, w, h);

        const padding = { top: 20, right: 20, bottom: 30, left: 40 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        // Draw horizontal grid lines
        const gridSteps = 5;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= gridSteps; i++) {
            const y = padding.top + (plotH / gridSteps) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            ctx.fillStyle = "#64748b";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "right";
            const percentLabel = `${100 - i * 20}%`;
            ctx.fillText(percentLabel, padding.left - 8, y + 3);
        }

        const history = state.telemetryHistory;
        if (history.length < 2) return;

        const maxPoints = 50;

        function plotChannel(extractVal, minVal, maxVal, color) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";

            history.forEach((reading, index) => {
                const x = padding.left + (index / (maxPoints - 1)) * plotW;
                const rawVal = extractVal(reading);
                const norm = Math.max(0, Math.min(1, (rawVal - minVal) / (maxVal - minVal)));
                const y = padding.top + plotH - (norm * plotH);

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();
        }

        // Process Temp: 25 - 60 C
        plotChannel(r => r.process_temperature_c, 25, 60, "#ff7b7b");
        // RPM: 1000 - 2000
        plotChannel(r => r.rotational_speed, 1000, 2000, "#00e5ff");
        // Torque: 20 - 80 Nm
        plotChannel(r => r.torque, 20, 80, "#35d5a4");
        // Tool Wear: 0 - 250 min
        plotChannel(r => r.tool_wear, 0, 250, "#ffb703");
        // Vibration: 0.5 - 4.5 mm/s
        plotChannel(r => r.vibration, 0.5, 4.5, "#a78bfa");
    }

    const btnFlushHistory = document.getElementById("btnFlushHistory");
    if (btnFlushHistory) {
        btnFlushHistory.addEventListener("click", () => {
            state.telemetryHistory = [];
            drawLiveTelemetryChart();
            showToast("info", "Telemetry Buffer", "Chart history buffer cleared.");
        });
    }

    // =========================================================================
    // AI PREDICTION INFERENCE FORM & PRESETS (PHASE 2 & PHASE 3)
    // =========================================================================
    const predictionForm = document.getElementById("predictionForm");
    const inputAirTemp = document.getElementById("inputAirTemp");
    const inputProcTemp = document.getElementById("inputProcTemp");
    const inputRpm = document.getElementById("inputRpm");
    const inputTorque = document.getElementById("inputTorque");
    const inputToolWear = document.getElementById("inputToolWear");
    const inputMachineType = document.getElementById("inputMachineType");
    const predictionErrorBanner = document.getElementById("predictionErrorBanner");

    const btnUnitK = document.getElementById("btnUnitK");
    const btnUnitC = document.getElementById("btnUnitC");
    const lblAirTemp = document.getElementById("lblAirTemp");
    const lblProcTemp = document.getElementById("lblProcTemp");
    const hintAirTemp = document.getElementById("hintAirTemp");
    const hintProcTemp = document.getElementById("hintProcTemp");

    function setTemperatureUnit(unit) {
        if (state.tempUnit === unit) return;

        state.tempUnit = unit;
        btnUnitK.classList.toggle("active", unit === "K");
        btnUnitC.classList.toggle("active", unit === "C");

        const curAir = parseFloat(inputAirTemp.value);
        const curProc = parseFloat(inputProcTemp.value);

        if (unit === "C") {
            lblAirTemp.textContent = "Air Temperature [°C]:";
            lblProcTemp.textContent = "Process Temperature [°C]:";
            hintAirTemp.textContent = "Nominal: ~25.0 °C (298.2 K)";
            hintProcTemp.textContent = "Nominal: ~35.4 °C (308.6 K)";

            if (!isNaN(curAir)) inputAirTemp.value = (curAir - 273.15).toFixed(1);
            if (!isNaN(curProc)) inputProcTemp.value = (curProc - 273.15).toFixed(1);
            inputAirTemp.min = "-20"; inputAirTemp.max = "80";
            inputProcTemp.min = "-20"; inputProcTemp.max = "100";
        } else {
            lblAirTemp.textContent = "Air Temperature [K]:";
            lblProcTemp.textContent = "Process Temperature [K]:";
            hintAirTemp.textContent = "Nominal: ~298.2 K (25.0 °C)";
            hintProcTemp.textContent = "Nominal: ~308.6 K (35.4 °C)";

            if (!isNaN(curAir)) inputAirTemp.value = (curAir + 273.15).toFixed(1);
            if (!isNaN(curProc)) inputProcTemp.value = (curProc + 273.15).toFixed(1);
            inputAirTemp.min = "250"; inputAirTemp.max = "350";
            inputProcTemp.min = "250"; inputProcTemp.max = "370";
        }
    }

    if (btnUnitK) btnUnitK.addEventListener("click", () => setTemperatureUnit("K"));
    if (btnUnitC) btnUnitC.addEventListener("click", () => setTemperatureUnit("C"));

    // Phase 3: Validated Quick Test Presets
    const presets = {
        "healthy": {
            type: "M",
            airK: 298.2,
            procK: 308.6,
            rpm: 1500,
            torque: 40.0,
            wear: 25,
            label: "Normal Healthy Baseline"
        },
        "hdf": {
            type: "L",
            airK: 304.5,
            procK: 309.0, // Delta 4.5 K < 8.6 K
            rpm: 1280,
            torque: 48.0,
            wear: 60,
            label: "Thermal Dissipation Fault (HDF)"
        },
        "pwf": {
            type: "M",
            airK: 301.0,
            procK: 314.0,
            rpm: 1250,
            torque: 75.0, // Power = 9,817 W > 9,000 W
            wear: 80,
            label: "Power Overload Fault (PWF)"
        },
        "twf": {
            type: "L",
            airK: 300.5,
            procK: 315.2,
            rpm: 1480,
            torque: 58.0,
            wear: 235, // Wear > 200 min
            label: "Tool Wear Critical Fault (TWF)"
        }
    };

    document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const p = presets[btn.dataset.preset];
            if (!p) return;

            // Highlight selected preset
            document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Populate all 6 model features immediately
            inputMachineType.value = p.type;
            inputRpm.value = p.rpm;
            inputTorque.value = p.torque.toFixed(1);
            inputToolWear.value = p.wear;

            if (state.tempUnit === "C") {
                inputAirTemp.value = (p.airK - 273.15).toFixed(1);
                inputProcTemp.value = (p.procK - 273.15).toFixed(1);
            } else {
                inputAirTemp.value = p.airK.toFixed(1);
                inputProcTemp.value = p.procK.toFixed(1);
            }

            // Clear previous results to prevent stale displays
            const placeholder = document.getElementById("predictionPlaceholder");
            const details = document.getElementById("predictionDetails");
            const badge = document.getElementById("predictionStatusBadge");

            if (placeholder && details) {
                placeholder.style.display = "flex";
                placeholder.innerHTML = `
                    <div class="placeholder-icon">⚡</div>
                    <h4>Preset Loaded: ${p.label}</h4>
                    <p>Parameters populated. Click <strong>"Execute AI Prediction"</strong> to submit inputs to the trained Random Forest pipeline.</p>
                `;
                details.style.display = "none";
            }
            if (badge) {
                badge.className = "badge badge-outline";
                badge.textContent = "READY FOR INFERENCE";
            }
            if (predictionErrorBanner) {
                predictionErrorBanner.style.display = "none";
            }

            showToast("info", "Preset Loaded", `${p.label} values loaded into form.`);
        });
    });

    // Form Submission & Inference
    if (predictionForm) {
        predictionForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (predictionErrorBanner) predictionErrorBanner.style.display = "none";

            const btnSubmit = document.getElementById("btnSubmitPredict");
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<span>⏳ Evaluating Machine Learning Model...</span>`;

            // Validate inputs on client
            const rpmVal = parseFloat(inputRpm.value);
            const torqueVal = parseFloat(inputTorque.value);
            const wearVal = parseFloat(inputToolWear.value);
            const airVal = parseFloat(inputAirTemp.value);
            const procVal = parseFloat(inputProcTemp.value);

            if (isNaN(rpmVal) || isNaN(torqueVal) || isNaN(wearVal) || isNaN(airVal) || isNaN(procVal)) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<span>⚡ Execute AI Prediction</span>`;
                if (predictionErrorBanner) {
                    predictionErrorBanner.textContent = "Please fill in all numerical fields with valid numbers.";
                    predictionErrorBanner.style.display = "flex";
                }
                showToast("error", "Validation Error", "All parameter fields must be valid numbers.");
                return;
            }

            const payload = {
                type: inputMachineType.value,
                rotational_speed_rpm: rpmVal,
                torque_nm: torqueVal,
                tool_wear_min: wearVal
            };

            if (state.tempUnit === "C") {
                payload.air_temperature_c = airVal;
                payload.process_temperature_c = procVal;
            } else {
                payload.air_temperature_k = airVal;
                payload.process_temperature_k = procVal;
            }

            try {
                const resp = await fetch("/api/predict", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!resp.ok) {
                    const errData = await resp.json().catch(() => ({}));
                    const msg = errData.detail || `Server returned HTTP ${resp.status}`;
                    throw new Error(msg);
                }

                const result = await resp.json();
                renderPredictionResults(result);
                showToast("success", "AI Inference", "Model prediction completed successfully.");

            } catch (err) {
                console.error("Prediction failed:", err);
                if (predictionErrorBanner) {
                    predictionErrorBanner.textContent = `Prediction Error: ${err.message}`;
                    predictionErrorBanner.style.display = "flex";
                }
                showToast("error", "Prediction Error", err.message);

                const badge = document.getElementById("predictionStatusBadge");
                if (badge) {
                    badge.className = "badge badge-danger";
                    badge.textContent = "INFERENCE ERROR";
                }
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<span>⚡ Execute AI Prediction</span>`;
            }
        });
    }

    function renderPredictionResults(res) {
        const placeholder = document.getElementById("predictionPlaceholder");
        const details = document.getElementById("predictionDetails");
        const badge = document.getElementById("predictionStatusBadge");

        placeholder.style.display = "none";
        details.style.display = "flex";

        const pred = res.prediction;
        const probPct = pred.failure_probability_percentage;
        const isFail = pred.failure_predicted;

        // Prob Meter
        const probVal = document.getElementById("predProbValue");
        const probFill = document.getElementById("predProbFill");
        if (probVal) probVal.textContent = `${probPct.toFixed(1)}%`;
        if (probFill) probFill.style.width = `${Math.min(100, Math.max(0, probPct))}%`;

        // Classification Box
        const decBox = document.getElementById("predDecisionBox");
        const decLabel = document.getElementById("predClassLabel");
        const decSub = document.getElementById("predClassSub");

        if (isFail || probPct >= 50.0) {
            badge.className = "badge badge-danger";
            badge.textContent = "FAILURE PREDICTED";
            decBox.className = "decision-box critical";
            decLabel.textContent = "CRITICAL - FAILURE RISK HIGH";
            decSub.textContent = "The trained AI model identifies high likelihood of machine breakdown for these operating inputs.";
        } else if (probPct >= 20.0) {
            badge.className = "badge badge-warning";
            badge.textContent = "ELEVATED RISK";
            decBox.className = "decision-box warning";
            decLabel.textContent = "WARNING - ABNORMAL STATE";
            decSub.textContent = "Elevated machine stress signature detected. Predictive intervention recommended.";
        } else {
            badge.className = "badge badge-success";
            badge.textContent = "OPTIMAL OPERATION";
            decBox.className = "decision-box";
            decLabel.textContent = "OPTIMAL - HEALTHY MACHINE";
            decSub.textContent = "Operating parameters resemble safe baseline training data. Low failure probability.";
        }

        // Diagnostics
        const diagBox = document.getElementById("predFailureModeBox");
        const modes = res.diagnostics.suspected_modes || [];
        if (modes.length > 0) {
            diagBox.innerHTML = modes.map(m => `
                <div style="margin-bottom: 6px;">
                    <strong class="text-cyan">${m.mode}:</strong> ${m.reason}
                </div>
            `).join("");
        } else {
            diagBox.innerHTML = "<em>All physical diagnostic checks (HDF, PWF, TWF, OSF) indicate stable operation within nominal thresholds.</em>";
        }

        // Recommendations
        const recomBox = document.getElementById("predRecommendationBox");
        const recoms = res.recommendations || [];
        if (recoms.length > 0) {
            recomBox.innerHTML = recoms.map(r => `<div style="margin-bottom: 4px;">• ${r}</div>`).join("");
        } else {
            recomBox.textContent = "Maintain regular manufacturing schedule. No action required.";
        }

        // ML vs Rules
        const compText = document.getElementById("predComparisonText");
        if (compText && res.ml_vs_rules) {
            compText.innerHTML = `
                <div><strong>Physics Rule Status:</strong> ${res.rule_based_evaluation.status} (${res.rule_based_evaluation.summary})</div>
                <div style="margin-top: 4px;"><strong>AI Model Assessment:</strong> ${res.ml_vs_rules.explanation}</div>
            `;
        }
    }

    // =========================================================================
    // ALERT CENTRE (PHASE 10: DEDUPLICATION & LIFECYCLE)
    // =========================================================================
    let currentAlertFilterSev = "ALL";

    document.querySelectorAll("#alertSeverityFilter .pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#alertSeverityFilter .pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentAlertFilterSev = btn.dataset.sev;
            loadAlerts();
        });
    });

    const alertAckFilter = document.getElementById("alertAckFilter");
    if (alertAckFilter) {
        alertAckFilter.addEventListener("change", loadAlerts);
    }

    const btnRefreshAlerts = document.getElementById("btnRefreshAlerts");
    if (btnRefreshAlerts) {
        btnRefreshAlerts.addEventListener("click", () => {
            loadAlerts();
            showToast("info", "Alerts Refreshed", "Loaded latest alerts from database.");
        });
    }

    async function loadAlerts() {
        const tbody = document.getElementById("alertsTableBody");
        if (!tbody) return;

        let url = `/api/alerts?limit=50&severity=${currentAlertFilterSev}`;
        if (alertAckFilter) {
            const val = alertAckFilter.value;
            if (val === "active") url += "&is_active=1";
            else if (val === "unacked") url += "&acknowledged=0";
            else if (val === "acked") url += "&acknowledged=1";
        }

        try {
            const resp = await fetch(url);
            const data = await resp.json();
            const alerts = data.alerts || [];

            // Update sidebar unacknowledged badge
            const unacked = alerts.filter(a => a.acknowledged === 0 && a.is_active === 1).length;
            if (alertCountBadge) {
                alertCountBadge.textContent = unacked;
                alertCountBadge.style.display = unacked > 0 ? "inline-block" : "none";
            }

            // Update overview mini alerts
            renderOverviewAlerts(alerts.slice(0, 4));

            if (alerts.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center">No alerts matching filter criteria.</td></tr>`;
                return;
            }

            tbody.innerHTML = alerts.map(a => {
                const isAck = a.acknowledged === 1;
                const isActive = a.is_active === 1;
                const occ = a.occurrence_count || 1;
                const sevBadge = a.severity === "CRITICAL" ? "badge-danger" : "badge-warning";
                const srcBadge = a.source === "ML_MODEL" ? "badge-info" : "badge-outline";

                return `
                    <tr>
                        <td><strong>#${a.id}</strong></td>
                        <td><small>${a.timestamp}</small></td>
                        <td><span class="badge ${sevBadge}">${a.severity}</span></td>
                        <td><span class="badge ${srcBadge}">${a.source}</span></td>
                        <td>${a.message}</td>
                        <td><span class="badge badge-outline">${occ}x</span></td>
                        <td>
                            ${isActive 
                                ? `<span class="badge badge-danger">ACTIVE</span>` 
                                : `<span class="badge badge-success">RESOLVED</span>`}
                        </td>
                        <td>
                            ${!isAck ? `
                                <button class="btn btn-xs btn-outline btn-ack" data-alert-id="${a.id}" type="button">
                                    ✓ Acknowledge
                                </button>
                            ` : `<small class="text-muted">Acknowledged</small>`}
                        </td>
                    </tr>
                `;
            }).join("");

            // Attach acknowledge handlers
            document.querySelectorAll(".btn-ack").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.dataset.alertId;
                    try {
                        const ackResp = await fetch(`/api/alerts/${id}/acknowledge`, { method: "POST" });
                        if (ackResp.ok) {
                            showToast("success", "Alert Acknowledged", `Alert #${id} marked as acknowledged.`);
                            loadAlerts();
                        }
                    } catch (err) {
                        console.error("Failed to acknowledge alert:", err);
                    }
                });
            });

        } catch (err) {
            console.error("Failed to load alerts:", err);
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red">Error loading alerts from database.</td></tr>`;
        }
    }

    function renderOverviewAlerts(recent) {
        const container = document.getElementById("overviewAlertsList");
        if (!container) return;

        if (!recent || recent.length === 0) {
            container.innerHTML = `<div class="empty-state">No critical alerts currently active.</div>`;
            return;
        }

        container.innerHTML = recent.map(a => `
            <div class="alert-item-card ${a.severity.toLowerCase()}">
                <div class="alert-item-content">
                    <strong>[${a.source}] ${a.alert_type}</strong>
                    <small>${a.message}</small>
                </div>
                <span class="badge ${a.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}">${a.severity}</span>
            </div>
        `).join("");
    }

    // =========================================================================
    // MAINTENANCE HISTORY & SERVICE LOG (PHASE 11)
    // =========================================================================
    const maintSearchInput = document.getElementById("maintSearchInput");
    const maintTypeFilter = document.getElementById("maintTypeFilter");
    const maintModal = document.getElementById("maintModal");
    const btnOpenMaintModal = document.getElementById("btnOpenMaintModal");
    const btnModalClose = document.getElementById("btnModalClose");
    const btnModalCancel = document.getElementById("btnModalCancel");
    const maintForm = document.getElementById("maintForm");
    const btnSubmitMaint = document.getElementById("btnSubmitMaint");

    if (btnOpenMaintModal) {
        btnOpenMaintModal.addEventListener("click", () => {
            maintModal.classList.add("active");
        });
    }

    function closeModal() {
        if (maintModal) maintModal.classList.remove("active");
    }

    if (btnModalClose) btnModalClose.addEventListener("click", closeModal);
    if (btnModalCancel) btnModalCancel.addEventListener("click", closeModal);

    if (maintSearchInput) {
        let debounceTimer;
        maintSearchInput.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadMaintenanceHistory, 300);
        });
    }

    if (maintTypeFilter) {
        maintTypeFilter.addEventListener("change", loadMaintenanceHistory);
    }

    if (maintForm) {
        maintForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (btnSubmitMaint) {
                btnSubmitMaint.disabled = true;
                btnSubmitMaint.textContent = "Saving...";
            }

            const tech = document.getElementById("maintTech").value;
            const action = document.getElementById("maintActionType").value;
            const comp = document.getElementById("maintComponent").value;
            const desc = document.getElementById("maintDesc").value;
            const notes = document.getElementById("maintNotes").value;

            try {
                const resp = await fetch("/api/maintenance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        technician_name: tech,
                        action_type: action,
                        component: comp,
                        description: desc,
                        notes: notes,
                        is_demo: 0 // User entered record
                    })
                });

                if (resp.ok) {
                    maintForm.reset();
                    closeModal();
                    loadMaintenanceHistory();
                    showToast("success", "Maintenance Saved", "Record successfully persisted to SQLite.");
                } else {
                    showToast("error", "Save Failed", "Could not persist maintenance record.");
                }
            } catch (err) {
                console.error("Maintenance submit error:", err);
                showToast("error", "Error", "Failed to connect to backend server.");
            } finally {
                if (btnSubmitMaint) {
                    btnSubmitMaint.disabled = false;
                    btnSubmitMaint.textContent = "Save to Database";
                }
            }
        });
    }

    async function loadMaintenanceHistory() {
        const tbody = document.getElementById("maintTableBody");
        if (!tbody) return;

        const search = maintSearchInput ? maintSearchInput.value.trim() : "";
        let url = `/api/maintenance?limit=100`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        if (maintTypeFilter) {
            const val = maintTypeFilter.value;
            if (val === "user") url += "&is_demo=0";
            else if (val === "demo") url += "&is_demo=1";
        }

        try {
            const resp = await fetch(url);
            const data = await resp.json();
            const events = data.events || [];

            if (events.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center">No maintenance records found.</td></tr>`;
                return;
            }

            tbody.innerHTML = events.map(ev => {
                const isDemo = ev.is_demo === 1;
                const typeBadge = isDemo 
                    ? `<span class="badge badge-demo">DEMO SAMPLE</span>` 
                    : `<span class="badge badge-user">VERIFIED LOG</span>`;

                return `
                    <tr>
                        <td><strong>#${ev.id}</strong></td>
                        <td><small>${ev.timestamp}</small></td>
                        <td><strong>${ev.technician_name}</strong></td>
                        <td>${typeBadge}</td>
                        <td><span class="badge badge-info">${ev.action_type}</span></td>
                        <td><span class="badge badge-outline">${ev.component}</span></td>
                        <td>${ev.description}</td>
                        <td><small class="text-muted">${ev.notes || '-'}</small></td>
                    </tr>
                `;
            }).join("");

        } catch (err) {
            console.error("Failed to load maintenance records:", err);
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red">Error loading maintenance records.</td></tr>`;
        }
    }

    // =========================================================================
    // MODEL PERFORMANCE METRICS (PHASE 12)
    // =========================================================================
    async function loadModelMetrics() {
        try {
            const resp = await fetch("/api/model/metrics");
            if (!resp.ok) throw new Error("Metrics not available");
            const data = await resp.json();
            state.modelMetrics = data;

            const m = data.evaluation_metrics;
            const accElem = document.getElementById("metricAccuracy");
            const recElem = document.getElementById("metricRecall");
            const precElem = document.getElementById("metricPrecision");
            const rocAucElem = document.getElementById("metricRocAuc");

            if (accElem) accElem.textContent = (m.accuracy * 100).toFixed(1);
            if (recElem) recElem.textContent = (m.recall_failure_class * 100).toFixed(1);
            if (precElem) precElem.textContent = (m.precision_failure_class * 100).toFixed(1);
            if (rocAucElem) rocAucElem.textContent = m.roc_auc.toFixed(4);

            // Confusion Matrix
            const cm = data.confusion_matrix;
            const cmTN = document.getElementById("cmTN");
            const cmFP = document.getElementById("cmFP");
            const cmFN = document.getElementById("cmFN");
            const cmTP = document.getElementById("cmTP");

            if (cmTN) cmTN.innerHTML = `${cm.true_negatives_healthy_correct}<br><small>True Negative (TN)</small>`;
            if (cmFP) cmFP.innerHTML = `${cm.false_positives_false_alarms}<br><small>False Positive (FP - Alarm)</small>`;
            if (cmFN) cmFN.innerHTML = `${cm.false_negatives_missed_failures}<br><small>False Negative (FN - Missed!)</small>`;
            if (cmTP) cmTP.innerHTML = `${cm.true_positives_failures_detected}<br><small>True Positive (TP - Caught!)</small>`;

            // Feature Importances
            const featContainer = document.getElementById("featureImportanceBars");
            if (featContainer && data.feature_importances) {
                const feats = Object.entries(data.feature_importances);
                const maxVal = Math.max(...feats.map(f => f[1]));

                featContainer.innerHTML = feats.map(([name, val]) => {
                    const pct = ((val / maxVal) * 100).toFixed(0);
                    return `
                        <div class="feat-bar-item">
                            <div class="feat-bar-label">
                                <span>${name}</span>
                                <strong>${(val * 100).toFixed(1)}%</strong>
                            </div>
                            <div class="feat-bar-track">
                                <div class="feat-bar-fill" style="width: ${pct}%;"></div>
                            </div>
                        </div>
                    `;
                }).join("");
            }

        } catch (err) {
            console.warn("Could not load real model metrics:", err);
        }
    }

    // =========================================================================
    // SYSTEM INITIALIZATION & POLLING LOOPS
    // =========================================================================
    function startTelemetryLoop() {
        if (state.telemetryTimer) clearInterval(state.telemetryTimer);
        state.telemetryTimer = setInterval(() => {
            fetchTelemetry(true);
        }, 2000);
    }

    function stopTelemetryLoop() {
        if (state.telemetryTimer) {
            clearInterval(state.telemetryTimer);
            state.telemetryTimer = null;
        }
    }

    // Initial backend checks
    checkBackendHealth();
    fetchTelemetry(false);
    loadAlerts();
    loadModelMetrics();

    // Alert refresh interval (every 10s)
    setInterval(() => {
        if (state.activeSection === "alerts" || state.activeSection === "overview") {
            loadAlerts();
        }
    }, 10000);
});

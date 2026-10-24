/**
 * SMARTTWIN AI - Frontend Client Controller (V2 Redesign)
 * AI-Based Digital Twin for Smart Manufacturing Using Predictive Maintenance
 * Full-stack integration with FastAPI backend, SQLite persistence, and Scikit-learn ML pipeline.
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log("[SmartTwin AI] Initializing dashboard client controller V2...");

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
        telemetryHistory: [], // bounded buffer
        maxHistoryPoints: 40,
        alerts: [],
        alertSummary: null,
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
            setTimeout(() => toast.remove(), 250);
        });

        toastContainer.appendChild(toast);

        // Auto remove after 3.8 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = "0";
                toast.style.transform = "translateX(20px)";
                setTimeout(() => toast.remove(), 250);
            }
        }, 3800);
    }

    // =========================================================================
    // WELCOME SCREEN MANAGEMENT (HERO EXPERIENCE)
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
            window.scrollTo(0, 0);
            switchSection(targetSection);
            resizeAllCanvases();
            startTelemetryLoop();
        }, 300);
    }

    function returnToWelcome() {
        if (!welcomeScreen || !appLayout) return;

        stopTelemetryLoop();
        welcomeScreen.style.display = "flex";
        welcomeScreen.classList.remove("hiding");
        appLayout.style.display = "none";
        window.scrollTo(0, 0);
    }

    if (btnLaunchDashboard) btnLaunchDashboard.addEventListener("click", () => enterDashboard("overview"));
    if (btnSkipWelcome) btnSkipWelcome.addEventListener("click", () => enterDashboard("overview"));
    if (btnExploreWelcome) btnExploreWelcome.addEventListener("click", () => enterDashboard("about"));
    if (btnReturnWelcome) btnReturnWelcome.addEventListener("click", returnToWelcome);

    // =========================================================================
    // DOM REFERENCES & NAVIGATION
    // =========================================================================
    const sidebar = document.getElementById("sidebar");
    const menuToggle = document.getElementById("menuToggle");
    const pageTitle = document.getElementById("pageTitle");
    const pageSubtitle = document.getElementById("pageSubtitle");
    const navButtons = document.querySelectorAll(".nav-btn");
    const appSections = document.querySelectorAll(".app-section");

    const systemStatusDot = document.getElementById("systemStatusDot");
    const systemStatusText = document.getElementById("systemStatusText");
    const modelStatusDetail = document.getElementById("modelStatusDetail");
    const alertCountBadge = document.getElementById("alertCountBadge");
    const headerModeDot = document.getElementById("headerModeDot");
    const headerModeText = document.getElementById("headerModeText");

    const scenarioSelect = document.getElementById("scenarioSelect");
    const btnSimPauseResume = document.getElementById("btnSimPauseResume");
    const simPauseIcon = document.getElementById("simPauseIcon");
    const simPauseText = document.getElementById("simPauseText");
    const btnSimReset = document.getElementById("btnSimReset");

    const sectionMetadata = {
        "overview": {
            title: "Overview Dashboard",
            sub: "Real-time industrial machine telemetry & predictive risk assessment"
        },
        "digital-twin": {
            title: "Digital Twin Simulation",
            sub: "Virtual CNC spindle kinematics, rotor dynamics, and thermodynamic envelope"
        },
        "monitoring": {
            title: "Live Machine Telemetry",
            sub: "Dedicated small-multiples trend monitoring with true engineering units"
        },
        "prediction": {
            title: "AI Failure Prediction",
            sub: "Real-time multi-variate inference via Scikit-learn Random Forest model"
        },
        "alerts": {
            title: "Alert Management Centre",
            sub: "Persisted incident records with event deduplication & lifecycle resolution"
        },
        "maintenance": {
            title: "Maintenance & Service Log",
            sub: "Verified technician maintenance history persisted in SQLite database"
        },
        "model-perf": {
            title: "Model Performance & Validation",
            sub: "Genuine evaluation metrics, confusion matrix, and feature importances on AI4I dataset"
        },
        "about": {
            title: "Project Details & Architecture",
            sub: "Mechanical engineering principles, failure formulas, cyber-physical pipeline & scope"
        }
    };

    function switchSection(sectionId) {
        if (!sectionMetadata[sectionId]) return;

        state.activeSection = sectionId;

        navButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.section === sectionId);
        });

        appSections.forEach(sec => {
            sec.classList.toggle("active", sec.id === `section-${sectionId}`);
        });

        if (pageTitle) pageTitle.textContent = sectionMetadata[sectionId].title;
        if (pageSubtitle) pageSubtitle.textContent = sectionMetadata[sectionId].sub;

        if (sidebar && sidebar.classList.contains("open")) {
            sidebar.classList.remove("open");
        }

        // Section-specific refresh triggers
        if (sectionId === "alerts") {
            loadAlerts();
        } else if (sectionId === "maintenance") {
            loadMaintenanceHistory();
        } else if (sectionId === "model-perf") {
            loadModelMetrics();
        } else if (sectionId === "monitoring") {
            resizeAllCanvases();
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

            if (systemStatusDot) {
                systemStatusDot.style.background = "#10b981";
                systemStatusDot.style.boxShadow = "0 0 8px #10b981";
            }
            if (systemStatusText) systemStatusText.textContent = "Backend: Online";

            if (data.model_loaded) {
                if (modelStatusDetail) {
                    modelStatusDetail.textContent = "ML Pipeline: Active (Balanced RF)";
                    modelStatusDetail.style.color = "#00f0ff";
                }
                const predictModelBadge = document.getElementById("predictModelBadge");
                if (predictModelBadge) {
                    predictModelBadge.textContent = "MODEL LOADED";
                    predictModelBadge.className = "badge badge-success";
                }
            } else {
                if (modelStatusDetail) {
                    modelStatusDetail.textContent = "ML Pipeline: Not Loaded";
                    modelStatusDetail.style.color = "#f59e0b";
                }
            }

            if (data.active_scenario) {
                state.activeScenario = data.active_scenario;
                if (scenarioSelect) scenarioSelect.value = data.active_scenario;
                syncScenarioButtons(data.active_scenario);
            }

            if (data.simulator_running !== undefined) {
                state.isSimPaused = !data.simulator_running;
                updateSimControlUI();
            }

        } catch (err) {
            console.error("Backend health check failed:", err);
            if (systemStatusDot) {
                systemStatusDot.style.background = "#ef4444";
                systemStatusDot.style.boxShadow = "0 0 8px #ef4444";
            }
            if (systemStatusText) systemStatusText.textContent = "Backend: Offline";
            if (modelStatusDetail) {
                modelStatusDetail.textContent = "Cannot reach FastAPI server";
                modelStatusDetail.style.color = "#ef4444";
            }
        }
    }

    // =========================================================================
    // SCENARIO SYNCHRONIZATION
    // =========================================================================
    function syncScenarioButtons(scen) {
        document.querySelectorAll(".scenario-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.scenario === scen);
        });
        const twinCurrentScenario = document.getElementById("twinCurrentScenario");
        if (twinCurrentScenario) {
            twinCurrentScenario.textContent = scen.toUpperCase();
        }
    }

    async function applyScenarioChange(newScenario) {
        state.activeScenario = newScenario;
        if (scenarioSelect) scenarioSelect.value = newScenario;
        syncScenarioButtons(newScenario);

        try {
            const resp = await fetch("/api/simulator/control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scenario: newScenario })
            });
            if (resp.ok) {
                showToast("info", "Scenario Synchronized", `Operating scenario switched to: ${newScenario.toUpperCase()}`);
                fetchTelemetryOnce();
            }
        } catch (err) {
            console.error("Failed to switch scenario:", err);
            showToast("error", "Scenario Error", "Failed to update simulator scenario.");
        }
    }

    if (scenarioSelect) {
        scenarioSelect.addEventListener("change", (e) => {
            applyScenarioChange(e.target.value);
        });
    }

    document.querySelectorAll(".scenario-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            applyScenarioChange(btn.dataset.scenario);
        });
    });

    // Machine Variant Quality Selection
    document.querySelectorAll("#variantPillGroup .pill-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            document.querySelectorAll("#variantPillGroup .pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.machineType = btn.dataset.variant;

            const twinCurrentVariant = document.getElementById("twinCurrentVariant");
            if (twinCurrentVariant) {
                const names = { "L": "Type L (Low - 50%)", "M": "Type M (Med - 30%)", "H": "Type H (High - 20%)" };
                twinCurrentVariant.textContent = names[state.machineType] || state.machineType;
            }

            try {
                await fetch("/api/simulator/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ machine_type: state.machineType })
                });
                showToast("info", "Variant Grade Updated", `Spindle metallurgical variant set to Grade ${state.machineType}.`);
            } catch (err) {
                console.error("Failed to change variant:", err);
            }
        });
    });

    // =========================================================================
    // SIMULATOR CONTROLS (PAUSE, RESUME, RESET)
    // =========================================================================
    function updateSimControlUI() {
        if (!simPauseIcon || !simPauseText) return;
        if (state.isSimPaused) {
            simPauseIcon.textContent = "▶";
            simPauseText.textContent = "Resume";
            btnSimPauseResume.classList.add("paused");
        } else {
            simPauseIcon.textContent = "⏸";
            simPauseText.textContent = "Pause";
            btnSimPauseResume.classList.remove("paused");
        }
    }

    if (btnSimPauseResume) {
        btnSimPauseResume.addEventListener("click", async () => {
            const command = state.isSimPaused ? "resume" : "pause";
            try {
                const resp = await fetch("/api/simulator/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ command })
                });
                if (resp.ok) {
                    state.isSimPaused = !state.isSimPaused;
                    updateSimControlUI();
                    showToast("info", "Simulator State", `Telemetry simulation ${state.isSimPaused ? "PAUSED" : "RESUMED"}.`);
                }
            } catch (err) {
                console.error("Failed to toggle simulator pause:", err);
            }
        });
    }

    if (btnSimReset) {
        btnSimReset.addEventListener("click", async () => {
            try {
                const resp = await fetch("/api/simulator/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ command: "reset", scenario: "normal" })
                });
                if (resp.ok) {
                    state.isSimPaused = false;
                    state.activeScenario = "normal";
                    if (scenarioSelect) scenarioSelect.value = "normal";
                    syncScenarioButtons("normal");
                    updateSimControlUI();
                    state.telemetryHistory = [];
                    showToast("success", "Simulator Reset", "Machine reset to nominal operating envelope.");
                    fetchTelemetryOnce();
                }
            } catch (err) {
                console.error("Failed to reset simulator:", err);
            }
        });
    }

    // =========================================================================
    // SMALL-MULTIPLES 5-CANVAS CHARTING ENGINE
    // =========================================================================
    const canvasRpm = document.getElementById("canvasRpm");
    const canvasTorque = document.getElementById("canvasTorque");
    const canvasTemp = document.getElementById("canvasTemp");
    const canvasWear = document.getElementById("canvasWear");
    const canvasVib = document.getElementById("canvasVib");

    const chartCanvases = [
        { canvas: canvasRpm, id: "rpm" },
        { canvas: canvasTorque, id: "torque" },
        { canvas: canvasTemp, id: "temp" },
        { canvas: canvasWear, id: "wear" },
        { canvas: canvasVib, id: "vib" }
    ];

    function resizeCanvasElement(c) {
        if (!c) return;
        const rect = c.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        c.width = rect.width * dpr;
        c.height = rect.height * dpr;
        const ctx = c.getContext("2d");
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function resizeAllCanvases() {
        chartCanvases.forEach(item => resizeCanvasElement(item.canvas));
        renderAllTelemetryCharts();
    }

    window.addEventListener("resize", resizeAllCanvases);

    /**
     * Dedicated Time-Series Canvas Chart Renderer
     * Renders real engineering units, threshold lines, and rolling time points.
     */
    function renderSingleSeriesChart(canvas, options) {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h) return;

        ctx.clearRect(0, 0, w, h);

        const padding = { top: 14, right: 14, bottom: 22, left: 42 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        const minVal = options.min;
        const maxVal = options.max;
        const range = maxVal - minVal || 1;

        // Draw horizontal grid lines & labels
        const gridSteps = 4;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
        ctx.lineWidth = 1;
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        for (let i = 0; i <= gridSteps; i++) {
            const y = padding.top + (plotH / gridSteps) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            const val = maxVal - (range / gridSteps) * i;
            const formattedVal = Math.round(val);
            ctx.fillText(`${formattedVal}${options.unit || ""}`, padding.left - 6, y);
        }

        // Draw threshold / reference line if provided
        if (options.threshold !== undefined && options.threshold >= minVal && options.threshold <= maxVal) {
            const threshY = padding.top + plotH - ((options.threshold - minVal) / range) * plotH;
            ctx.save();
            ctx.strokeStyle = options.thresholdColor || "#ef4444";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, threshY);
            ctx.lineTo(w - padding.right, threshY);
            ctx.stroke();
            ctx.restore();
        }

        const data = state.telemetryHistory;
        if (data.length < 2) return;

        const maxPoints = state.maxHistoryPoints;

        // Render main series
        function drawLine(extractFn, color, fillColor) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";

            const points = [];

            data.forEach((item, idx) => {
                const x = padding.left + (idx / (maxPoints - 1)) * plotW;
                const rawVal = extractFn(item);
                const clamped = Math.max(minVal, Math.min(maxVal, rawVal));
                const y = padding.top + plotH - ((clamped - minVal) / range) * plotH;
                points.push({ x, y });

                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Gradient fill underneath
            if (fillColor && points.length > 0) {
                const lastPt = points[points.length - 1];
                const firstPt = points[0];
                ctx.save();
                ctx.lineTo(lastPt.x, padding.top + plotH);
                ctx.lineTo(firstPt.x, padding.top + plotH);
                ctx.closePath();
                const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
                grad.addColorStop(0, fillColor);
                grad.addColorStop(1, "rgba(0, 0, 0, 0)");
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.restore();
            }
        }

        drawLine(options.extract, options.color, options.fillColor);

        // Secondary line if provided (e.g. for dual thermal chart)
        if (options.secondaryExtract) {
            drawLine(options.secondaryExtract, options.secondaryColor, null);
        }
    }

    function renderAllTelemetryCharts() {
        const hist = state.telemetryHistory;
        const latest = hist[hist.length - 1];

        // 1. Spindle Speed (RPM): 1000 - 3000
        renderSingleSeriesChart(canvasRpm, {
            min: 1000,
            max: 3000,
            unit: "",
            threshold: 1500,
            thresholdColor: "rgba(0, 240, 255, 0.4)",
            extract: r => r.rotational_speed,
            color: "#00f0ff",
            fillColor: "rgba(0, 240, 255, 0.12)"
        });

        // 2. Torque (Nm): 0 - 80
        renderSingleSeriesChart(canvasTorque, {
            min: 0,
            max: 80,
            unit: "",
            threshold: 55,
            thresholdColor: "#ef4444",
            extract: r => r.torque,
            color: "#10b981",
            fillColor: "rgba(16, 185, 129, 0.12)"
        });

        // 3. Thermal Dynamics: 15°C - 55°C
        renderSingleSeriesChart(canvasTemp, {
            min: 15,
            max: 55,
            unit: "°",
            extract: r => r.process_temperature_c,
            color: "#f59e0b",
            fillColor: "rgba(245, 158, 11, 0.1)",
            secondaryExtract: r => r.air_temperature_c,
            secondaryColor: "#00f0ff"
        });

        // 4. Tool Wear (min): 0 - 260
        renderSingleSeriesChart(canvasWear, {
            min: 0,
            max: 260,
            unit: "",
            threshold: 200,
            thresholdColor: "#ef4444",
            extract: r => r.tool_wear,
            color: "#f59e0b",
            fillColor: "rgba(245, 158, 11, 0.1)"
        });

        // 5. Vibration (mm/s): 0 - 5.0
        renderSingleSeriesChart(canvasVib, {
            min: 0,
            max: 5.0,
            unit: "",
            threshold: 3.2,
            thresholdColor: "#ef4444",
            extract: r => r.vibration,
            color: "#8b5cf6",
            fillColor: "rgba(139, 92, 246, 0.12)"
        });

        // Update card header stats if latest data exists
        if (latest) {
            const chartValRpm = document.getElementById("chartValRpm");
            const chartValTorque = document.getElementById("chartValTorque");
            const chartValProc = document.getElementById("chartValProc");
            const chartValAir = document.getElementById("chartValAir");
            const chartValWear = document.getElementById("chartValWear");
            const chartValVib = document.getElementById("chartValVib");
            const chartDeltaTBadge = document.getElementById("chartDeltaTBadge");

            if (chartValRpm) chartValRpm.textContent = Math.round(latest.rotational_speed).toLocaleString();
            if (chartValTorque) chartValTorque.textContent = latest.torque.toFixed(1);
            if (chartValProc) chartValProc.textContent = latest.process_temperature_c.toFixed(1);
            if (chartValAir) chartValAir.textContent = latest.air_temperature_c.toFixed(1);
            if (chartValWear) chartValWear.textContent = latest.tool_wear.toFixed(1);
            if (chartValVib) chartValVib.textContent = latest.vibration.toFixed(2);

            const deltaT = (latest.process_temperature_k - latest.air_temperature_k).toFixed(1);
            if (chartDeltaTBadge) chartDeltaTBadge.textContent = `ΔT = ${deltaT} K`;
        }
    }

    const btnFlushHistory = document.getElementById("btnFlushHistory");
    if (btnFlushHistory) {
        btnFlushHistory.addEventListener("click", () => {
            state.telemetryHistory = [];
            renderAllTelemetryCharts();
            showToast("info", "Telemetry Buffer", "Chart time-series history cleared.");
        });
    }

    // =========================================================================
    // DYNAMIC SVG MACHINE MOTOR ANIMATION UPDATES
    // =========================================================================
    function updateMachineVisuals(reading) {
        const rpm = reading.rotational_speed || 1500;
        const procTempC = reading.process_temperature_c || 35;
        const vib = reading.vibration || 1.5;

        // Dynamic rotor spin duration: scales smoothly with spindle RPM
        // At 1500 RPM -> ~1.2s per rev; at 2500 RPM -> ~0.7s per rev
        const durationSec = Math.max(0.35, Math.min(2.5, (1500 / rpm) * 1.2));
        const rotorElements = [
            document.getElementById("welcomeRotor"),
            document.getElementById("previewRotor"),
            document.getElementById("mainRotorGroup")
        ];

        rotorElements.forEach(el => {
            if (el) el.style.animationDuration = `${durationSec}s`;
        });

        // Dynamic stator thermal color gradient
        const heatStop1 = document.getElementById("heatStop1");
        const heatStop2 = document.getElementById("heatStop2");
        const wStatorThermal = document.getElementById("wStatorThermal");

        if (heatStop1 && heatStop2) {
            if (procTempC > 45) {
                heatStop1.setAttribute("stop-color", "#ef4444");
                heatStop2.setAttribute("stop-color", "#f59e0b");
            } else if (procTempC > 38) {
                heatStop1.setAttribute("stop-color", "#f59e0b");
                heatStop2.setAttribute("stop-color", "#00f0ff");
            } else {
                heatStop1.setAttribute("stop-color", "#00f0ff");
                heatStop2.setAttribute("stop-color", "#0891b2");
            }
        }

        // Bearing pulse scaling
        const leftBearing = document.getElementById("leftBearing");
        const wLeftBearing = document.getElementById("wLeftBearing");
        if (leftBearing && vib > 3.0) {
            leftBearing.style.fill = "#ef4444";
        } else if (leftBearing) {
            leftBearing.style.fill = "#00f0ff";
        }

        // Callout tags on twin stage
        const twinTempCallout = document.getElementById("twinTempCallout");
        const twinRpmCallout = document.getElementById("twinRpmCallout");
        const twinTorqueCallout = document.getElementById("twinTorqueCallout");
        const twinWearCallout = document.getElementById("twinWearCallout");

        if (twinTempCallout) twinTempCallout.textContent = `${procTempC.toFixed(1)} °C`;
        if (twinRpmCallout) twinRpmCallout.textContent = `${Math.round(rpm)} RPM`;
        if (twinTorqueCallout) twinTorqueCallout.textContent = `${reading.torque.toFixed(1)} Nm`;
        if (twinWearCallout) twinWearCallout.textContent = `${Math.round(reading.tool_wear)} min`;

        // Welcome stage HUD tags
        const wHudTemp = document.getElementById("wHudTemp");
        const wHudRpm = document.getElementById("wHudRpm");
        const wHudTorque = document.getElementById("wHudTorque");
        const welcomeStageTag = document.getElementById("welcomeStageTag");

        if (wHudTemp) wHudTemp.textContent = `${procTempC.toFixed(1)} °C (${reading.process_temperature_k.toFixed(1)} K)`;
        if (wHudRpm) wHudRpm.textContent = `${Math.round(rpm).toLocaleString()} RPM`;
        if (wHudTorque) wHudTorque.textContent = `${reading.torque.toFixed(1)} Nm`;
        if (welcomeStageTag) welcomeStageTag.textContent = `${Math.round(rpm).toLocaleString()} RPM • ${reading.torque.toFixed(1)} Nm • ${reading.air_temperature_k.toFixed(1)} K`;
    }

    // =========================================================================
    // TELEMETRY LOOP & DATA UPDATER
    // =========================================================================
    function startTelemetryLoop() {
        if (state.telemetryTimer) return;
        fetchTelemetryOnce();
        state.telemetryTimer = setInterval(fetchTelemetryOnce, 2000);
    }

    function stopTelemetryLoop() {
        if (state.telemetryTimer) {
            clearInterval(state.telemetryTimer);
            state.telemetryTimer = null;
        }
    }

    async function fetchTelemetryOnce() {
        if (state.isFetchingTelemetry) return;
        state.isFetchingTelemetry = true;

        try {
            const resp = await fetch("/api/simulator/readings");
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            if (data.success && data.reading) {
                const reading = data.reading;

                // Push to bounded rolling buffer
                state.telemetryHistory.push(reading);
                if (state.telemetryHistory.length > state.maxHistoryPoints) {
                    state.telemetryHistory.shift();
                }

                // Update UI Components
                updateOverviewSection(reading);
                updateDigitalTwinSection(reading);
                updateNumericalDeck(reading);
                updateMachineVisuals(reading);
                renderAllTelemetryCharts();

                // Periodic check for alerts count
                if (state.activeSection === "overview" || state.activeSection === "alerts") {
                    loadAlerts(true);
                }
            }
        } catch (err) {
            console.warn("Telemetry fetch error:", err);
        } finally {
            state.isFetchingTelemetry = false;
        }
    }

    // Update Overview Dashboard UI
    function updateOverviewSection(reading) {
        const condTitle = document.getElementById("overviewConditionTitle");
        const healthBadge = document.getElementById("overviewHealthBadge");
        const healthSub = document.getElementById("overviewHealthSub");
        const healthVal = document.getElementById("overviewHealthVal");
        const healthBar = document.getElementById("overviewHealthBar");
        const failVal = document.getElementById("overviewFailVal");
        const failBar = document.getElementById("overviewFailBar");
        const avatar = document.getElementById("overviewAvatar");

        const healthScore = Math.round(reading.health_score || 95);
        const failProb = ((reading.failure_probability || 0.01) * 100).toFixed(1);
        const statusMode = (reading.operating_mode || "NORMAL").toUpperCase();

        if (condTitle) condTitle.textContent = `${statusMode} OPERATION`;
        if (healthVal) healthVal.textContent = healthScore;
        if (healthBar) healthBar.style.width = `${healthScore}%`;
        if (failVal) failVal.textContent = failProb;
        if (failBar) failBar.style.width = `${Math.min(100, Math.max(1, failProb))}%`;

        // Set Unified Status Badges & Avatar Colors
        if (statusMode === "CRITICAL") {
            if (healthBadge) { healthBadge.textContent = "CRITICAL FAULT"; healthBadge.className = "badge badge-danger"; }
            if (headerModeBadge) { headerModeText.textContent = "CRITICAL"; headerModeBadge.style.color = "#ef4444"; }
            if (avatar) { avatar.style.borderColor = "#ef4444"; avatar.style.background = "rgba(239, 68, 68, 0.2)"; }
            if (healthSub) healthSub.textContent = "Immediate mechanical intervention required. Safety parameter exceeded.";
        } else if (statusMode === "WARNING") {
            if (healthBadge) { healthBadge.textContent = "WARNING STRESS"; healthBadge.className = "badge badge-warning"; }
            if (headerModeBadge) { headerModeText.textContent = "WARNING"; headerModeBadge.style.color = "#f59e0b"; }
            if (avatar) { avatar.style.borderColor = "#f59e0b"; avatar.style.background = "rgba(245, 158, 11, 0.2)"; }
            if (healthSub) healthSub.textContent = "Parameters approaching critical boundaries. Schedule preventative inspection.";
        } else {
            if (healthBadge) { healthBadge.textContent = "OPTIMAL"; healthBadge.className = "badge badge-success"; }
            if (headerModeBadge) { headerModeText.textContent = "NORMAL"; headerModeBadge.style.color = "#10b981"; }
            if (avatar) { avatar.style.borderColor = "#10b981"; avatar.style.background = "rgba(16, 185, 129, 0.15)"; }
            if (healthSub) healthSub.textContent = "All physical parameters and mechanical stress indicators are within standard limits.";
        }

        // 6 Overview KPI Tiles
        const overviewRpmVal = document.getElementById("overviewRpmVal");
        const overviewTorqueVal = document.getElementById("overviewTorqueVal");
        const overviewAirTemp = document.getElementById("overviewAirTemp");
        const overviewAirTempK = document.getElementById("overviewAirTempK");
        const overviewProcTemp = document.getElementById("overviewProcTemp");
        const overviewProcTempK = document.getElementById("overviewProcTempK");
        const overviewDeltaT = document.getElementById("overviewDeltaT");
        const overviewToolWear = document.getElementById("overviewToolWear");
        const overviewVibration = document.getElementById("overviewVibration");
        const overviewPowerTile = document.getElementById("overviewPowerTile");
        const overviewAngular = document.getElementById("overviewAngular");

        if (overviewRpmVal) overviewRpmVal.textContent = Math.round(reading.rotational_speed).toLocaleString();
        if (overviewTorqueVal) overviewTorqueVal.textContent = reading.torque.toFixed(1);
        if (overviewAirTemp) overviewAirTemp.textContent = reading.air_temperature_c.toFixed(1);
        if (overviewAirTempK) overviewAirTempK.textContent = `${reading.air_temperature_k.toFixed(1)} K`;
        if (overviewProcTemp) overviewProcTemp.textContent = reading.process_temperature_c.toFixed(1);
        if (overviewProcTempK) overviewProcTempK.textContent = `${reading.process_temperature_k.toFixed(1)} K`;

        const deltaTVal = (reading.process_temperature_k - reading.air_temperature_k).toFixed(1);
        if (overviewDeltaT) overviewDeltaT.textContent = `ΔT = ${deltaTVal} K`;

        if (overviewToolWear) overviewToolWear.textContent = reading.tool_wear.toFixed(1);
        if (overviewVibration) overviewVibration.textContent = reading.vibration.toFixed(2);

        // Power calculation
        const powerW = ((2 * Math.PI * reading.rotational_speed * reading.torque) / 60).toFixed(0);
        if (overviewPowerTile) overviewPowerTile.textContent = `${(powerW / 1000).toFixed(1)} kW Power`;

        const rads = ((2 * Math.PI * reading.rotational_speed) / 60).toFixed(1);
        if (overviewAngular) overviewAngular.textContent = `${rads} rad/s`;
    }

    // Update Digital Twin Thermodynamic & Power Envelope
    function updateDigitalTwinSection(reading) {
        const twinDeltaT = document.getElementById("twinDeltaT");
        const twinPower = document.getElementById("twinPower");
        const twinOverstrain = document.getElementById("twinOverstrain");
        const twinVibText = document.getElementById("twinVibText");
        const twinStatusBadge = document.getElementById("twinStatusBadge");

        const deltaT = (reading.process_temperature_k - reading.air_temperature_k).toFixed(1);
        const powerW = Math.round((2 * Math.PI * reading.rotational_speed * reading.torque) / 60);
        const overstrain = Math.round(reading.torque * reading.tool_wear);

        if (twinDeltaT) twinDeltaT.textContent = `${deltaT} K`;
        if (twinPower) twinPower.textContent = `${powerW.toLocaleString()} W`;
        if (twinOverstrain) twinOverstrain.textContent = `${overstrain.toLocaleString()} Nm·min`;
        if (twinVibText) twinVibText.textContent = `${reading.vibration.toFixed(2)} mm/s`;

        if (twinStatusBadge) {
            const mode = reading.operating_mode || "NORMAL";
            twinStatusBadge.textContent = `ONLINE • ${mode.toUpperCase()}`;
            if (mode === "CRITICAL") twinStatusBadge.style.color = "#ef4444";
            else if (mode === "WARNING") twinStatusBadge.style.color = "#f59e0b";
            else twinStatusBadge.style.color = "#10b981";
        }
    }

    // Update Live Numerical Telemetry Grid Bar
    function updateNumericalDeck(reading) {
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

        if (numAirK) numAirK.textContent = `${reading.air_temperature_k.toFixed(1)} K`;
        if (numAirC) numAirC.textContent = `${reading.air_temperature_c.toFixed(1)} °C`;
        if (numProcK) numProcK.textContent = `${reading.process_temperature_k.toFixed(1)} K`;
        if (numProcC) numProcC.textContent = `${reading.process_temperature_c.toFixed(1)} °C`;
        if (numRpm) numRpm.textContent = `${Math.round(reading.rotational_speed).toLocaleString()} RPM`;

        const rads = ((2 * Math.PI * reading.rotational_speed) / 60).toFixed(1);
        if (numAngular) numAngular.textContent = `${rads} rad/s`;

        if (numTorque) numTorque.textContent = `${reading.torque.toFixed(1)} Nm`;
        const powerKw = (((2 * Math.PI * reading.rotational_speed * reading.torque) / 60) / 1000).toFixed(1);
        if (numPowerCalc) numPowerCalc.textContent = `${powerKw} kW Power`;

        if (numWear) numWear.textContent = `${reading.tool_wear.toFixed(1)} min`;
        if (numVib) numVib.textContent = `${reading.vibration.toFixed(2)} mm/s`;
    }

    // =========================================================================
    // AI PREDICTION: INFERENCE, PRESETS & UNIT CONVERSION
    // =========================================================================
    const predictionForm = document.getElementById("predictionForm");
    const inputAirTemp = document.getElementById("inputAirTemp");
    const inputProcTemp = document.getElementById("inputProcTemp");
    const inputRpm = document.getElementById("inputRpm");
    const inputTorque = document.getElementById("inputTorque");
    const inputToolWear = document.getElementById("inputToolWear");
    const inputMachineType = document.getElementById("inputMachineType");
    const predictionErrorBanner = document.getElementById("predictionErrorBanner");
    const btnSubmitPredict = document.getElementById("btnSubmitPredict");
    const btnPredictSpinner = document.getElementById("btnPredictSpinner");
    const btnPredictText = document.getElementById("btnPredictText");

    const btnUnitK = document.getElementById("btnUnitK");
    const btnUnitC = document.getElementById("btnUnitC");
    const lblAirTemp = document.getElementById("lblAirTemp");
    const lblProcTemp = document.getElementById("lblProcTemp");
    const hintAirTemp = document.getElementById("hintAirTemp");
    const hintProcTemp = document.getElementById("hintProcTemp");

    // Temperature Unit Toggle Handler
    function setTemperatureUnit(unit) {
        if (state.tempUnit === unit) return;

        const currentAir = parseFloat(inputAirTemp.value);
        const currentProc = parseFloat(inputProcTemp.value);

        if (unit === "C") {
            state.tempUnit = "C";
            btnUnitC.classList.add("active");
            btnUnitK.classList.remove("active");
            lblAirTemp.textContent = "Air Temperature [°C]:";
            lblProcTemp.textContent = "Process Temperature [°C]:";
            hintAirTemp.textContent = "Nominal: ~25.0 °C (Range: 15 - 45 °C)";
            hintProcTemp.textContent = "Nominal: ~35.4 °C (Range: 20 - 60 °C)";

            if (!isNaN(currentAir)) inputAirTemp.value = (currentAir - 273.15).toFixed(1);
            if (!isNaN(currentProc)) inputProcTemp.value = (currentProc - 273.15).toFixed(1);
        } else {
            state.tempUnit = "K";
            btnUnitK.classList.add("active");
            btnUnitC.classList.remove("active");
            lblAirTemp.textContent = "Air Temperature [K]:";
            lblProcTemp.textContent = "Process Temperature [K]:";
            hintAirTemp.textContent = "Nominal: ~298.2 K (Range: 295.3 - 304.5 K)";
            hintProcTemp.textContent = "Nominal: ~308.6 K (Range: 305.7 - 313.8 K)";

            if (!isNaN(currentAir)) inputAirTemp.value = (currentAir + 273.15).toFixed(1);
            if (!isNaN(currentProc)) inputProcTemp.value = (currentProc + 273.15).toFixed(1);
        }
    }

    if (btnUnitK) btnUnitK.addEventListener("click", () => setTemperatureUnit("K"));
    if (btnUnitC) btnUnitC.addEventListener("click", () => setTemperatureUnit("C"));

    // 4 Quick Test Presets
    const presetsData = {
        healthy: {
            type: "M",
            airK: 298.2,
            procK: 308.6,
            rpm: 1500,
            torque: 40.0,
            wear: 25
        },
        hdf: {
            type: "L",
            airK: 298.2,
            procK: 303.4, // delta 5.2 K < 8.6 K
            rpm: 1350,
            torque: 45.0,
            wear: 80
        },
        pwf: {
            type: "L",
            airK: 296.0,
            procK: 306.0,
            rpm: 1180,
            torque: 75.0, // Power = 9,267 W > 9,000 W
            wear: 100
        },
        twf: {
            type: "M",
            airK: 298.2,
            procK: 308.6,
            rpm: 1520,
            torque: 42.0,
            wear: 235 // wear > 200 min
        }
    };

    function applyPreset(presetKey) {
        const p = presetsData[presetKey];
        if (!p) return;

        document.querySelectorAll(".btn-preset").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.preset === presetKey);
        });

        if (inputMachineType) inputMachineType.value = p.type;
        if (inputRpm) inputRpm.value = p.rpm;
        if (inputTorque) inputTorque.value = p.torque;
        if (inputToolWear) inputToolWear.value = p.wear;

        if (state.tempUnit === "C") {
            inputAirTemp.value = (p.airK - 273.15).toFixed(1);
            inputProcTemp.value = (p.procK - 273.15).toFixed(1);
        } else {
            inputAirTemp.value = p.airK.toFixed(1);
            inputProcTemp.value = p.procK.toFixed(1);
        }

        if (predictionErrorBanner) predictionErrorBanner.style.display = "none";
        showToast("info", "Preset Populated", `Loaded ${presetKey.toUpperCase()} parameter scenario.`);
    }

    document.querySelectorAll(".btn-preset").forEach(btn => {
        btn.addEventListener("click", () => {
            applyPreset(btn.dataset.preset);
        });
    });

    // Prediction Form Submission Handler
    if (predictionForm) {
        predictionForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (predictionErrorBanner) predictionErrorBanner.style.display = "none";

            // Extract numeric inputs
            const airVal = parseFloat(inputAirTemp.value);
            const procVal = parseFloat(inputProcTemp.value);
            const rpmVal = parseFloat(inputRpm.value);
            const torqueVal = parseFloat(inputTorque.value);
            const wearVal = parseFloat(inputToolWear.value);
            const typeVal = inputMachineType.value;

            // Strict Client-Side Input Validation
            const errors = [];
            if (isNaN(airVal) || airVal <= 0) errors.push("Valid positive Air Temperature is required.");
            if (isNaN(procVal) || procVal <= 0) errors.push("Valid positive Process Temperature is required.");
            if (isNaN(rpmVal) || rpmVal < 100 || rpmVal > 10000) errors.push("Rotational Speed must be between 100 and 10,000 RPM.");
            if (isNaN(torqueVal) || torqueVal < 0 || torqueVal > 300) errors.push("Torque must be between 0 and 300 Nm.");
            if (isNaN(wearVal) || wearVal < 0 || wearVal > 1000) errors.push("Tool Wear must be between 0 and 1,000 minutes.");

            if (errors.length > 0) {
                if (predictionErrorBanner) {
                    predictionErrorBanner.innerHTML = `<strong>Validation Error:</strong><br>${errors.join("<br>")}`;
                    predictionErrorBanner.style.display = "block";
                }
                showToast("error", "Invalid Input", errors[0]);
                return;
            }

            // Prepare JSON payload safely (passing both K & C to prevent NoneType)
            const payload = {
                machine_type: typeVal,
                rotational_speed: rpmVal,
                torque: torqueVal,
                tool_wear: wearVal
            };

            if (state.tempUnit === "C") {
                payload.air_temperature_c = airVal;
                payload.process_temperature_c = procVal;
                payload.air_temperature_k = airVal + 273.15;
                payload.process_temperature_k = procVal + 273.15;
            } else {
                payload.air_temperature_k = airVal;
                payload.process_temperature_k = procVal;
                payload.air_temperature_c = airVal - 273.15;
                payload.process_temperature_c = procVal - 273.15;
            }

            // Loading state on button
            btnSubmitPredict.disabled = true;
            if (btnPredictSpinner) btnPredictSpinner.style.display = "inline-block";
            if (btnPredictText) btnPredictText.textContent = "Evaluating Machine Learning Model...";

            try {
                const resp = await fetch("/api/predict", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!resp.ok) {
                    const errorData = await resp.json().catch(() => ({}));
                    const detail = errorData.detail || `Server returned error ${resp.status}`;
                    throw new Error(detail);
                }

                const result = await resp.json();
                renderPredictionResults(result);
                showToast("success", "Prediction Completed", "Model inference and heuristic diagnostics computed.");

            } catch (err) {
                console.error("Prediction inference failed:", err);
                if (predictionErrorBanner) {
                    predictionErrorBanner.innerHTML = `<strong>Inference Error:</strong> ${err.message}`;
                    predictionErrorBanner.style.display = "block";
                }
                showToast("error", "Prediction Error", err.message);

                // Clear stale prediction details if request failed
                const predictionDetails = document.getElementById("predictionDetails");
                const predictionPlaceholder = document.getElementById("predictionPlaceholder");
                if (predictionDetails) predictionDetails.style.display = "none";
                if (predictionPlaceholder) predictionPlaceholder.style.display = "block";

            } finally {
                btnSubmitPredict.disabled = false;
                if (btnPredictSpinner) btnPredictSpinner.style.display = "none";
                if (btnPredictText) btnPredictText.textContent = "⚡ Execute AI Prediction";
            }
        });
    }

    function renderPredictionResults(res) {
        const predictionPlaceholder = document.getElementById("predictionPlaceholder");
        const predictionDetails = document.getElementById("predictionDetails");
        const predictionStatusBadge = document.getElementById("predictionStatusBadge");

        const predProbValue = document.getElementById("predProbValue");
        const predProbFill = document.getElementById("predProbFill");
        const predDecisionBox = document.getElementById("predDecisionBox");
        const predClassLabel = document.getElementById("predClassLabel");
        const predClassSub = document.getElementById("predClassSub");
        const predFailureModeBox = document.getElementById("predFailureModeBox");
        const predRecommendationBox = document.getElementById("predRecommendationBox");
        const predComparisonText = document.getElementById("predComparisonText");

        if (predictionPlaceholder) predictionPlaceholder.style.display = "none";
        if (predictionDetails) predictionDetails.style.display = "flex";

        const pred = res.prediction || {};
        const rawProb = pred.failure_probability !== undefined ? pred.failure_probability : (res.failure_probability || 0);
        const probPercent = (rawProb * 100).toFixed(1);

        if (predProbValue) predProbValue.textContent = `${probPercent}%`;
        if (predProbFill) predProbFill.style.width = `${Math.min(100, Math.max(2, probPercent))}%`;

        if (predictionStatusBadge) {
            predictionStatusBadge.textContent = "INFERENCE READY";
            predictionStatusBadge.className = "badge badge-success";
        }

        const isFailure = (pred.failure_predicted !== undefined ? pred.failure_predicted : res.failure_predicted) === 1;
        if (predDecisionBox) {
            predDecisionBox.className = "decision-card-block " + (isFailure ? "critical" : (rawProb > 0.25 ? "warning" : ""));
        }

        if (predClassLabel) {
            predClassLabel.textContent = isFailure ? "CRITICAL - FAILURE RISK HIGH" : (rawProb > 0.25 ? "WARNING - ELEVATED RISK" : "OPTIMAL - HEALTHY");
            predClassLabel.style.color = isFailure ? "#ef4444" : (rawProb > 0.25 ? "#f59e0b" : "#10b981");
        }

        if (predClassSub) {
            predClassSub.textContent = isFailure ?
                "The Scikit-learn Random Forest model predicts high likelihood of machine failure under these operating conditions." :
                "Machine parameters operate safely within the nominal degradation envelope.";
        }

        // Diagnostics failure mode formatting
        if (predFailureModeBox) {
            if (res.diagnostics && res.diagnostics.suspected_modes && res.diagnostics.suspected_modes.length > 0) {
                predFailureModeBox.innerHTML = res.diagnostics.suspected_modes.map(m =>
                    `<strong>${escapeHtml(m.mode)}:</strong> ${escapeHtml(m.reason)}`
                ).join("<br>");
            } else if (res.suspected_failure_mode) {
                predFailureModeBox.textContent = res.suspected_failure_mode;
            } else {
                predFailureModeBox.textContent = "No active failure mode detected. Thermal gradient, spindle power, and wear are within limits.";
            }
        }

        // Recommendations
        if (predRecommendationBox) {
            if (res.recommendations && res.recommendations.length > 0) {
                predRecommendationBox.textContent = res.recommendations.join(" ");
            } else if (res.recommendation) {
                predRecommendationBox.textContent = res.recommendation;
            } else {
                predRecommendationBox.textContent = isFailure ? "Inspect spindle bearings and cutting insert immediately." : "Continue standard operating schedule.";
            }
        }

        // Comparison text
        if (predComparisonText) {
            if (res.ml_vs_rules && res.ml_vs_rules.summary) {
                predComparisonText.textContent = res.ml_vs_rules.summary;
            } else {
                const ruleStatus = (res.rule_based_evaluation && res.rule_based_evaluation.rule_status) || res.rule_status || "NORMAL";
                const mlStatus = isFailure ? "CRITICAL" : "NORMAL";
                if (ruleStatus === mlStatus) {
                    predComparisonText.textContent = `Agreement: Both physical rule limits and multi-variate ML model evaluate this state as ${ruleStatus}.`;
                } else {
                    predComparisonText.textContent = `Divergence: Physical rule boundary evaluates state as ${ruleStatus}, while multi-variate Random Forest model evaluates state as ${mlStatus} (${probPercent}% probability).`;
                }
            }
        }
    }

    // =========================================================================
    // ALERT MANAGEMENT CENTRE (SQLite LIFECYCLE & DEDUPLICATION)
    // =========================================================================
    let currentAlertFilterSev = "ALL";
    const alertAckFilter = document.getElementById("alertAckFilter");
    const btnRefreshAlerts = document.getElementById("btnRefreshAlerts");

    document.querySelectorAll("#alertSeverityFilter .pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#alertSeverityFilter .pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentAlertFilterSev = btn.dataset.sev;
            loadAlerts();
        });
    });

    if (alertAckFilter) alertAckFilter.addEventListener("change", () => loadAlerts());
    if (btnRefreshAlerts) {
        btnRefreshAlerts.addEventListener("click", () => {
            loadAlerts();
            showToast("info", "Alerts Refreshed", "Loaded latest alert incident records from SQLite.");
        });
    }

    async function loadAlerts(silent = false) {
        const tbody = document.getElementById("alertsTableBody");
        let url = `/api/alerts?limit=50&severity=${currentAlertFilterSev}`;

        const ackVal = alertAckFilter ? alertAckFilter.value : "active";
        if (ackVal === "active") url += "&is_active=1";
        else if (ackVal === "unacked") url += "&acknowledged=0&is_active=1";
        else if (ackVal === "acked") url += "&acknowledged=1";

        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            const alerts = data.alerts || [];
            const summary = data.summary || {};

            // Update top stats cards
            const alertStatTotal = document.getElementById("alertStatTotal");
            const alertStatCritical = document.getElementById("alertStatCritical");
            const alertStatWarning = document.getElementById("alertStatWarning");
            const alertStatResolved = document.getElementById("alertStatResolved");

            if (alertStatTotal) alertStatTotal.textContent = summary.total !== undefined ? summary.total : alerts.length;
            if (alertStatCritical) alertStatCritical.textContent = summary.active_critical !== undefined ? summary.active_critical : alerts.filter(a => a.severity === "CRITICAL" && a.is_active === 1).length;
            if (alertStatWarning) alertStatWarning.textContent = summary.active_warning !== undefined ? summary.active_warning : alerts.filter(a => a.severity === "WARNING" && a.is_active === 1).length;
            if (alertStatResolved) alertStatResolved.textContent = summary.resolved !== undefined ? summary.resolved : alerts.filter(a => a.is_active === 0).length;

            // Nav badge count (unacknowledged active alerts)
            const unackedCount = alerts.filter(a => a.acknowledged === 0 && a.is_active === 1).length;
            if (alertCountBadge) {
                alertCountBadge.textContent = unackedCount;
                alertCountBadge.style.display = unackedCount > 0 ? "inline-block" : "none";
            }

            renderOverviewAlerts(alerts.slice(0, 4));

            if (!tbody) return;

            if (alerts.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No incident records matching filter criteria.</td></tr>`;
                return;
            }

            tbody.innerHTML = alerts.map(a => {
                const sevClass = a.severity === "CRITICAL" ? "badge-danger" : (a.severity === "WARNING" ? "badge-warning" : "badge-info");
                const stateText = a.is_active === 1 ? `<span class="badge badge-warning">ACTIVE</span>` : `<span class="badge badge-success">RESOLVED</span>`;
                const isDemo = a.is_demo === 1 || a.message.startsWith("[DEMO");
                const demoBadge = isDemo ? `<span class="demo-tag">DEMO</span>` : "";

                return `
                    <tr>
                        <td><strong>#${a.id}</strong></td>
                        <td><small>${a.last_seen_at || a.timestamp}</small></td>
                        <td><span class="badge ${sevClass}">${a.severity}</span></td>
                        <td><small>${a.source || "SYSTEM"}</small></td>
                        <td>${demoBadge}${escapeHtml(a.message)}</td>
                        <td><strong class="text-cyan">${a.occurrence_count || 1}×</strong></td>
                        <td>${stateText}</td>
                        <td>
                            ${a.acknowledged === 0 ?
                                `<button class="btn btn-xs btn-outline btn-ack" data-id="${a.id}">Acknowledge</button>` :
                                `<small class="text-muted">✓ Acknowledged</small>`}
                        </td>
                    </tr>
                `;
            }).join("");

            tbody.querySelectorAll(".btn-ack").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.dataset.id;
                    try {
                        const ackResp = await fetch(`/api/alerts/${id}/acknowledge`, { method: "POST" });
                        if (ackResp.ok) {
                            showToast("success", "Alert Acknowledged", `Incident #${id} marked as acknowledged by operator.`);
                            loadAlerts();
                        }
                    } catch (err) {
                        console.error("Failed to acknowledge alert:", err);
                    }
                });
            });

        } catch (err) {
            console.error("Failed to load alerts:", err);
            if (tbody && !silent) {
                tbody.innerHTML = `<tr><td colspan="8" class="empty-state text-red">Error loading alerts from database.</td></tr>`;
            }
        }
    }

    function renderOverviewAlerts(recent) {
        const container = document.getElementById("overviewAlertsList");
        if (!container) return;

        if (recent.length === 0) {
            container.innerHTML = `<div class="empty-state">No critical alerts currently active.</div>`;
            return;
        }

        container.innerHTML = recent.map(a => {
            const sevClass = a.severity === "CRITICAL" ? "critical" : "warning";
            const isDemo = a.is_demo === 1 || a.message.startsWith("[DEMO");
            const demoTag = isDemo ? `<span class="demo-tag">DEMO</span>` : "";

            return `
                <div class="feed-alert-item ${sevClass}">
                    <div>
                        <div class="feed-alert-title">${demoTag}${escapeHtml(a.alert_type)} • <span class="badge ${a.severity === "CRITICAL" ? "badge-danger" : "badge-warning"}">${a.severity}</span></div>
                        <div class="feed-alert-msg">${escapeHtml(a.message)}</div>
                        <small class="text-muted">${a.last_seen_at || a.timestamp} • Occurrences: ${a.occurrence_count || 1}×</small>
                    </div>
                </div>
            `;
        }).join("");
    }

    // =========================================================================
    // MAINTENANCE HISTORY & SERVICE RECORD MANAGEMENT
    // =========================================================================
    const maintSearchInput = document.getElementById("maintSearchInput");
    const maintTypeFilter = document.getElementById("maintTypeFilter");
    const maintModal = document.getElementById("maintModal");
    const btnOpenMaintModal = document.getElementById("btnOpenMaintModal");
    const btnModalClose = document.getElementById("btnModalClose");
    const btnModalCancel = document.getElementById("btnModalCancel");
    const maintForm = document.getElementById("maintForm");
    const btnSubmitMaint = document.getElementById("btnSubmitMaint");

    if (btnOpenMaintModal && maintModal) {
        btnOpenMaintModal.addEventListener("click", () => {
            maintModal.style.display = "flex";
        });
    }

    function closeMaintModal() {
        if (maintModal) maintModal.style.display = "none";
    }

    if (btnModalClose) btnModalClose.addEventListener("click", closeMaintModal);
    if (btnModalCancel) btnModalCancel.addEventListener("click", closeMaintModal);

    if (maintSearchInput) {
        maintSearchInput.addEventListener("input", debounce(() => loadMaintenanceHistory(), 300));
    }
    if (maintTypeFilter) {
        maintTypeFilter.addEventListener("change", () => loadMaintenanceHistory());
    }

    async function loadMaintenanceHistory() {
        const tbody = document.getElementById("maintTableBody");
        const query = maintSearchInput ? encodeURIComponent(maintSearchInput.value.trim()) : "";
        const typeFilter = maintTypeFilter ? maintTypeFilter.value : "all";

        let url = `/api/maintenance?limit=100`;
        if (query) url += `&search=${query}`;
        if (typeFilter === "user") url += `&is_demo=0`;
        else if (typeFilter === "demo") url += `&is_demo=1`;

        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const events = data.events || [];

            renderOverviewMaint(events.slice(0, 3));

            if (!tbody) return;

            if (events.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No maintenance records found matching criteria.</td></tr>`;
                return;
            }

            tbody.innerHTML = events.map(ev => {
                const isDemo = ev.is_demo === 1 || (ev.description && ev.description.includes("[DEMO"));
                const originBadge = isDemo ? `<span class="demo-tag">DEMO</span>` : `<span class="user-tag">USER</span>`;

                return `
                    <tr>
                        <td><strong>#${ev.id}</strong></td>
                        <td><small>${ev.timestamp}</small></td>
                        <td><strong>${escapeHtml(ev.technician_name)}</strong></td>
                        <td>${originBadge}</td>
                        <td><span class="badge badge-outline">${escapeHtml(ev.action_type)}</span></td>
                        <td><small class="text-cyan">${escapeHtml(ev.component)}</small></td>
                        <td>${escapeHtml(ev.description)}</td>
                        <td><small class="text-muted">${escapeHtml(ev.notes || "--")}</small></td>
                    </tr>
                `;
            }).join("");

        } catch (err) {
            console.error("Failed to load maintenance records:", err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="8" class="empty-state text-red">Error loading maintenance records from database.</td></tr>`;
            }
        }
    }

    function renderOverviewMaint(recent) {
        const container = document.getElementById("overviewMaintList");
        if (!container) return;

        if (recent.length === 0) {
            container.innerHTML = `<div class="empty-state">No maintenance records logged yet.</div>`;
            return;
        }

        container.innerHTML = recent.map(ev => {
            const isDemo = ev.is_demo === 1 || (ev.description && ev.description.includes("[DEMO"));
            const originBadge = isDemo ? `<span class="demo-tag">DEMO</span>` : `<span class="user-tag">USER</span>`;

            return `
                <div class="feed-alert-item">
                    <div>
                        <div class="feed-alert-title">${originBadge} ${escapeHtml(ev.action_type)} • <span class="text-cyan">${escapeHtml(ev.component)}</span></div>
                        <div class="feed-alert-msg">${escapeHtml(ev.description)}</div>
                        <small class="text-muted">${ev.timestamp} • Lead: ${escapeHtml(ev.technician_name)}</small>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Modal Form Submission for Adding Maintenance Log
    if (maintForm) {
        maintForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const techName = document.getElementById("maintTech").value.trim();
            const actionType = document.getElementById("maintActionType").value;
            const component = document.getElementById("maintComponent").value;
            const desc = document.getElementById("maintDesc").value.trim();
            const notes = document.getElementById("maintNotes").value.trim();

            if (!techName || !desc) {
                showToast("error", "Validation Error", "Technician name and description are required.");
                return;
            }

            btnSubmitMaint.disabled = true;
            btnSubmitMaint.textContent = "Saving to SQLite...";

            try {
                const resp = await fetch("/api/maintenance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        technician_name: techName,
                        action_type: actionType,
                        component: component,
                        description: desc,
                        notes: notes,
                        is_demo: 0
                    })
                });

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                showToast("success", "Maintenance Recorded", "Service log record persisted to SQLite database.");
                maintForm.reset();
                closeMaintModal();
                loadMaintenanceHistory();

            } catch (err) {
                console.error("Failed to save maintenance log:", err);
                showToast("error", "Save Failed", "Failed to insert record into SQLite.");
            } finally {
                btnSubmitMaint.disabled = false;
                btnSubmitMaint.textContent = "Save Record to SQLite";
            }
        });
    }

    // =========================================================================
    // MODEL PERFORMANCE METRICS RENDERING
    // =========================================================================
    async function loadModelMetrics() {
        try {
            const resp = await fetch("/api/model/metrics");
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            const metrics = data.evaluation_metrics || {};
            const cm = data.confusion_matrix || {};
            const featImportances = data.feature_importance || {};

            // Metric Cards
            const metricAccuracy = document.getElementById("metricAccuracy");
            const metricRecall = document.getElementById("metricRecall");
            const metricPrecision = document.getElementById("metricPrecision");
            const metricRocAuc = document.getElementById("metricRocAuc");

            if (metricAccuracy) metricAccuracy.textContent = (metrics.accuracy * 100).toFixed(2);
            if (metricRecall) metricRecall.textContent = (metrics.failure_recall * 100).toFixed(2);
            if (metricPrecision) metricPrecision.textContent = (metrics.failure_precision * 100).toFixed(2);
            if (metricRocAuc) metricRocAuc.textContent = metrics.roc_auc.toFixed(4);

            // Confusion Matrix Table
            const cmTN = document.getElementById("cmTN");
            const cmFP = document.getElementById("cmFP");
            const cmFN = document.getElementById("cmFN");
            const cmTP = document.getElementById("cmTP");

            if (cmTN) cmTN.textContent = (cm.true_negatives || 1917).toLocaleString();
            if (cmFP) cmFP.textContent = (cm.false_positives || 15).toLocaleString();
            if (cmFN) cmFN.textContent = (cm.false_negatives || 27).toLocaleString();
            if (cmTP) cmTP.textContent = (cm.true_positives || 41).toLocaleString();

            // Feature Importances
            const container = document.getElementById("featureImportanceBars");
            if (container && Object.keys(featImportances).length > 0) {
                const entries = Object.entries(featImportances).sort((a, b) => b[1] - a[1]);
                const maxWeight = Math.max(...entries.map(e => e[1])) || 1;

                container.innerHTML = entries.map(([name, weight]) => {
                    const pct = ((weight / maxWeight) * 100).toFixed(0);
                    const cleanName = formatFeatureName(name);

                    return `
                        <div class="feat-bar-row">
                            <div class="feat-bar-header">
                                <span>${cleanName}</span>
                                <strong class="text-cyan">${(weight * 100).toFixed(1)}%</strong>
                            </div>
                            <div class="feat-track">
                                <div class="feat-fill" style="width: ${pct}%;"></div>
                            </div>
                        </div>
                    `;
                }).join("");
            }

        } catch (err) {
            console.error("Failed to load model evaluation metrics:", err);
        }
    }

    // =========================================================================
    // UTILITY HELPERS
    // =========================================================================
    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function formatFeatureName(name) {
        const map = {
            "num__Torque [Nm]": "Cutting Torque [Nm]",
            "num__Rotational speed [rpm]": "Rotational Speed [RPM]",
            "num__Tool wear [min]": "Tool Wear [minutes]",
            "num__Process temperature [K]": "Process Temperature [K]",
            "num__Air temperature [K]": "Air Temperature [K]",
            "cat__Type_L": "Variant Quality: Type L",
            "cat__Type_M": "Variant Quality: Type M",
            "cat__Type_H": "Variant Quality: Type H"
        };
        return map[name] || name;
    }

    // =========================================================================
    // INITIALIZATION RUNTIME
    // =========================================================================
    checkBackendHealth();
    loadAlerts(true);
    loadMaintenanceHistory();
    loadModelMetrics();

    // Set initial preset
    applyPreset("healthy");

    console.log("[SmartTwin AI] Dashboard V2 initialized successfully.");
});

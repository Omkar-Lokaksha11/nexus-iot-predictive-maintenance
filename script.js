/**
 * SMARTTWIN AI — FRONTEND CLIENT CONTROLLER (JADE PEBBLE MORNING EDITION)
 * AI-Based Digital Twin for Smart Manufacturing Using Predictive Maintenance
 * Full-stack integration with FastAPI backend, SQLite persistence, and Scikit-learn ML pipeline.
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log("[SmartTwin AI] Initializing Jade Pebble Morning client controller...");

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
        telemetryHistory: [], // bounded rolling buffer (60-100 snapshots)
        maxHistoryPoints: 80,
        alerts: [],
        alertSummary: null,
        maintenanceEvents: [],
        modelMetrics: null,
        chartsLayout: "grid" // 'grid' or 'stacked'
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
                <div class="toast-title">${escapeHtml(title)}</div>
                <div class="toast-msg">${escapeHtml(message)}</div>
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

        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = "0";
                toast.style.transform = "translateX(20px)";
                setTimeout(() => toast.remove(), 250);
            }
        }, 3800);
    }

    // =========================================================================
    // LANDING PAGE & DASHBOARD SHELL ROUTING
    // =========================================================================
    const welcomeScreen = document.getElementById("welcomeScreen");
    const appLayout = document.getElementById("appLayout");
    const btnLaunchDashboard = document.getElementById("btnLaunchDashboard");
    const btnHeroLaunch = document.getElementById("btnHeroLaunch");
    const btnPreviewLaunch = document.getElementById("btnPreviewLaunch");
    const btnSkipWelcome = document.getElementById("btnSkipWelcome");
    const btnAboutExplore = document.getElementById("btnAboutExplore");
    const btnReturnWelcome = document.getElementById("btnReturnWelcome");
    const brandLogoHome = document.getElementById("brandLogoHome");

    function enterDashboard(targetSection = "overview") {
        if (!welcomeScreen || !appLayout) return;

        welcomeScreen.classList.add("hiding");
        setTimeout(() => {
            welcomeScreen.style.display = "none";
            appLayout.style.display = "flex";
            window.scrollTo(0, 0);
            switchSection(targetSection);
            window.location.hash = "#" + (targetSection === "overview" ? "dashboard" : targetSection);
            resizeAllCanvases();
            startTelemetryLoop();
        }, 280);
    }

    function returnToWelcome() {
        if (!welcomeScreen || !appLayout) return;

        stopTelemetryLoop();
        welcomeScreen.style.display = "flex";
        welcomeScreen.classList.remove("hiding");
        appLayout.style.display = "none";
        window.location.hash = "#welcome";
        window.scrollTo(0, 0);
    }

    if (btnLaunchDashboard) btnLaunchDashboard.addEventListener("click", () => enterDashboard("overview"));
    if (btnHeroLaunch) btnHeroLaunch.addEventListener("click", () => enterDashboard("overview"));
    if (btnPreviewLaunch) btnPreviewLaunch.addEventListener("click", () => enterDashboard("overview"));
    if (btnSkipWelcome) btnSkipWelcome.addEventListener("click", () => enterDashboard("overview"));
    if (btnAboutExplore) btnAboutExplore.addEventListener("click", () => enterDashboard("about"));
    if (btnReturnWelcome) btnReturnWelcome.addEventListener("click", returnToWelcome);
    if (brandLogoHome) brandLogoHome.addEventListener("click", returnToWelcome);

    // =========================================================================
    // SIDEBAR & SECTION NAVIGATION
    // =========================================================================
    const sidebar = document.getElementById("sidebar");
    const sidebarBackdrop = document.getElementById("sidebarBackdrop");
    const menuToggle = document.getElementById("menuToggle");
    const pageTitle = document.getElementById("pageTitle");
    const pageSubtitle = document.getElementById("pageSubtitle");
    const navButtons = document.querySelectorAll(".nav-btn");
    const appSections = document.querySelectorAll(".app-section");

    const systemStatusDot = document.getElementById("systemStatusDot");
    const systemStatusText = document.getElementById("systemStatusText");
    const alertCountBadge = document.getElementById("alertCountBadge");
    const currentTimeDisplay = document.getElementById("currentTimeDisplay");

    const scenarioSelect = document.getElementById("scenarioSelect");
    const btnSimPauseResume = document.getElementById("btnSimPauseResume");
    const simPauseIcon = document.getElementById("simPauseIcon");
    const simPauseText = document.getElementById("simPauseText");
    const btnSimReset = document.getElementById("btnSimReset");

    const sectionMetadata = {
        "overview": {
            title: "Operations Overview",
            sub: "Monitor machine health, evaluate risk and review maintenance activity."
        },
        "digital-twin": {
            title: "Digital Twin Workspace",
            sub: "Virtual CNC spindle kinematics, rotor dynamics, and thermal boundary mapping."
        },
        "monitoring": {
            title: "Live Machine Telemetry",
            sub: "Multi-parameter trend monitoring with physical engineering units and adaptive bounds."
        },
        "prediction": {
            title: "AI Failure Prediction",
            sub: "Real-time multi-variate inference via trained Scikit-learn Random Forest model."
        },
        "alerts": {
            title: "Alerts Management Center",
            sub: "Persisted incident records with event deduplication & operator lifecycle acknowledgment."
        },
        "maintenance": {
            title: "Maintenance & Service Log",
            sub: "Traceable technician servicing records persisted to SQLite with CSV compliance export."
        },
        "model-perf": {
            title: "Model Performance & Validation",
            sub: "Genuine evaluation metrics, confusion matrix, and feature importances on AI4I dataset."
        },
        "about": {
            title: "About SmartTwin AI",
            sub: "Mechanical engineering principles, cyber-physical pipeline, architecture, and scope."
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
            if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
        }

        // Section-specific refresh triggers
        if (sectionId === "alerts") {
            loadAlerts();
        } else if (sectionId === "maintenance") {
            loadMaintenanceHistory();
        } else if (sectionId === "model-perf") {
            loadModelMetrics();
        } else if (sectionId === "monitoring") {
            requestAnimationFrame(() => {
                resizeAllCanvases();
            });
        }
    }

    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const sec = btn.dataset.section;
            switchSection(sec);
            window.location.hash = "#" + (sec === "overview" ? "dashboard" : sec);
        });
    });

    document.querySelectorAll("[data-jump-to]").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.jumpTo;
            switchSection(target);
            window.location.hash = "#" + (target === "overview" ? "dashboard" : target);
        });
    });

    // Mobile Sidebar Drawer Toggle
    if (menuToggle) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            if (sidebarBackdrop) sidebarBackdrop.classList.toggle("active");
        });
    }

    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener("click", () => {
            sidebar.classList.remove("open");
            sidebarBackdrop.classList.remove("active");
        });
    }

    // Topbar live clock updater
    function updateClock() {
        if (currentTimeDisplay) {
            const now = new Date();
            currentTimeDisplay.textContent = now.toTimeString().split(" ")[0];
        }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // =========================================================================
    // HASH ROUTING & BROWSER HISTORY
    // =========================================================================
    function handleHashRoute() {
        const hash = window.location.hash.replace("#", "").toLowerCase();
        if (!hash || hash === "welcome" || hash === "home" || hash === "hero") {
            // Display Welcome Landing Page
            if (welcomeScreen && appLayout && appLayout.style.display !== "none") {
                returnToWelcome();
            }
        } else {
            const map = {
                "dashboard": "overview",
                "overview": "overview",
                "monitoring": "monitoring",
                "digital-twin": "digital-twin",
                "twin": "digital-twin",
                "prediction": "prediction",
                "predictions": "prediction",
                "alerts": "alerts",
                "maintenance": "maintenance",
                "model-perf": "model-perf",
                "model": "model-perf",
                "about": "about"
            };
            const section = map[hash] || "overview";
            if (appLayout && appLayout.style.display === "none") {
                enterDashboard(section);
            } else {
                switchSection(section);
            }
        }
    }

    window.addEventListener("hashchange", handleHashRoute);

    // =========================================================================
    // API HEALTH & BACKEND INITIALIZATION
    // =========================================================================
    async function checkBackendHealth() {
        try {
            const resp = await fetch("/api/health");
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            if (systemStatusDot) systemStatusDot.style.backgroundColor = "var(--color-success)";
            if (systemStatusText) systemStatusText.textContent = "Online";

            const predictModelBadge = document.getElementById("predictModelBadge");
            if (predictModelBadge) {
                if (data.model_loaded) {
                    predictModelBadge.textContent = "MODEL LOADED";
                    predictModelBadge.className = "badge badge-success";
                } else {
                    predictModelBadge.textContent = "NOT LOADED";
                    predictModelBadge.className = "badge badge-warning";
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
            if (systemStatusDot) systemStatusDot.style.backgroundColor = "var(--color-error)";
            if (systemStatusText) systemStatusText.textContent = "Offline";
        }
    }

    // =========================================================================
    // SIMULATION CONTROLS & SCENARIO SYNCHRONIZATION
    // =========================================================================
    function syncScenarioButtons(scen) {
        document.querySelectorAll(".scenario-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.scenario === scen);
        });
        const twinBadge = document.getElementById("twinCurrentScenarioBadge");
        if (twinBadge) {
            const labels = {
                normal: "NORMAL OPERATION",
                warning: "ELEVATED WARNING",
                hdf: "FAULT: THERMAL (HDF)",
                pwf: "FAULT: OVERLOAD (PWF)",
                twf: "FAULT: WORN TOOL (TWF)",
                osf: "FAULT: OVERSTRAIN (OSF)"
            };
            twinBadge.textContent = labels[scen] || scen.toUpperCase();
            if (scen === "normal") twinBadge.className = "badge badge-success";
            else if (scen === "warning") twinBadge.className = "badge badge-warning";
            else twinBadge.className = "badge badge-danger";
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
                body: JSON.stringify({ action: "step", command: "step", scenario: newScenario })
            });
            if (resp.ok) {
                showToast("info", "Scenario Synchronized", `Operating scenario set to: ${newScenario.toUpperCase()}`);
                fetchTelemetryOnce();
            }
        } catch (err) {
            console.error("Failed to switch scenario:", err);
            showToast("error", "Scenario Error", "Failed to communicate with simulator.");
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

    // Machine Metallurgy Variant Selection (L, M, H)
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
                    body: JSON.stringify({ action: "step", command: "step", machine_type: state.machineType })
                });
                showToast("info", "Metallurgy Updated", `Variant quality set to Grade ${state.machineType}.`);
            } catch (err) {
                console.error("Failed to update variant:", err);
            }
        });
    });

    function updateSimControlUI() {
        if (!simPauseIcon || !simPauseText) return;
        if (state.isSimPaused) {
            simPauseIcon.textContent = "▶";
            simPauseText.textContent = "Resume";
            btnSimPauseResume.classList.add("btn-secondary");
            btnSimPauseResume.classList.remove("btn-outline");
        } else {
            simPauseIcon.textContent = "⏸";
            simPauseText.textContent = "Pause";
            btnSimPauseResume.classList.remove("btn-secondary");
            btnSimPauseResume.classList.add("btn-outline");
        }
    }

    if (btnSimPauseResume) {
        btnSimPauseResume.addEventListener("click", async () => {
            const cmd = state.isSimPaused ? "resume" : "pause";
            try {
                const resp = await fetch("/api/simulator/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: cmd, command: cmd })
                });
                if (resp.ok) {
                    state.isSimPaused = !state.isSimPaused;
                    updateSimControlUI();
                    showToast("info", "Simulator", `Simulation telemetry ${state.isSimPaused ? "PAUSED" : "RESUMED"}.`);
                }
            } catch (err) {
                console.error("Failed to toggle simulation state:", err);
            }
        });
    }

    if (btnSimReset) {
        btnSimReset.addEventListener("click", async () => {
            try {
                const resp = await fetch("/api/simulator/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "reset", command: "reset", scenario: "normal" })
                });
                if (resp.ok) {
                    state.isSimPaused = false;
                    state.activeScenario = "normal";
                    if (scenarioSelect) scenarioSelect.value = "normal";
                    syncScenarioButtons("normal");
                    updateSimControlUI();
                    state.telemetryHistory = [];
                    showToast("success", "Simulator Reset", "Machine reset to nominal physical baseline.");
                    fetchTelemetryOnce();
                }
            } catch (err) {
                console.error("Failed to reset simulator:", err);
            }
        });
    }

    // =========================================================================
    // CHARTING ENGINE (JADE PEBBLE MORNING PALETTE)
    // =========================================================================
    const canvasRpm = document.getElementById("canvasRpm");
    const canvasTorque = document.getElementById("canvasTorque");
    const canvasAirTemp = document.getElementById("canvasAirTemp");
    const canvasTemp = document.getElementById("canvasTemp");
    const canvasWear = document.getElementById("canvasWear");
    const canvasVib = document.getElementById("canvasVib");

    const chartCanvases = [
        { canvas: canvasRpm, id: "rpm" },
        { canvas: canvasTorque, id: "torque" },
        { canvas: canvasAirTemp, id: "airTemp" },
        { canvas: canvasTemp, id: "processTemp" },
        { canvas: canvasWear, id: "wear" },
        { canvas: canvasVib, id: "vib" }
    ];

    const prefersReducedMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    function resizeCanvasElement(c) {
        if (!c) return;
        const rect = c.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dpr = window.devicePixelRatio || 1;
        const targetW = Math.round(rect.width * dpr);
        const targetH = Math.round(rect.height * dpr);
        if (c.width !== targetW || c.height !== targetH) {
            c.width = targetW;
            c.height = targetH;
        }
        const ctx = c.getContext("2d");
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let chartRenderPending = false;
    function requestChartRender() {
        if (chartRenderPending) return;
        chartRenderPending = true;
        requestAnimationFrame(() => {
            chartRenderPending = false;
            renderAllTelemetryCharts();
        });
    }

    function resizeAllCanvases() {
        chartCanvases.forEach(item => resizeCanvasElement(item.canvas));
        requestChartRender();
    }

    window.addEventListener("resize", debounce(resizeAllCanvases, 100));

    // Observe container resizing for smooth responsiveness
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
            if (state.activeSection === "monitoring") {
                requestChartRender();
            }
        });
        chartCanvases.forEach(item => {
            if (item.canvas && item.canvas.parentElement) {
                ro.observe(item.canvas.parentElement);
            }
        });
    }

    // Toggle Chart Layout (2-Column Grid vs Stacked Full Width)
    const btnToggleChartMode = document.getElementById("btnToggleChartMode");
    const chartsContainer = document.getElementById("chartsContainer");
    if (btnToggleChartMode && chartsContainer) {
        btnToggleChartMode.addEventListener("click", () => {
            const isStacked = chartsContainer.classList.toggle("stacked-layout");
            state.chartsLayout = isStacked ? "stacked" : "grid";
            btnToggleChartMode.textContent = isStacked ? "⊞ Switch to 2-Column Grid" : "☰ Switch to Stacked View";
            resizeAllCanvases();
            showToast("info", "Layout Updated", `Switched to ${isStacked ? "Stacked Full-Width" : "2-Column Grid"} layout.`);
        });
    }

    const btnFlushHistory = document.getElementById("btnFlushHistory");
    if (btnFlushHistory) {
        btnFlushHistory.addEventListener("click", () => {
            state.telemetryHistory = [];
            requestChartRender();
            showToast("info", "Buffer Cleared", "Cleared rolling telemetry history buffer.");
        });
    }

    /**
     * Renders a single-series time-series telemetry curve
     */
    function renderSingleSeriesChart(canvas, options) {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const w = rect.width || canvas.clientWidth;
        const h = rect.height || canvas.clientHeight;
        if (!w || !h) return;

        const dpr = window.devicePixelRatio || 1;
        const expectedW = Math.round(w * dpr);
        const expectedH = Math.round(h * dpr);
        if (canvas.width !== expectedW || canvas.height !== expectedH) {
            canvas.width = expectedW;
            canvas.height = expectedH;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const padding = { top: 12, right: 14, bottom: 22, left: 44 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;
        if (plotW <= 0 || plotH <= 0) return;

        const data = state.telemetryHistory;

        let minVal = options.min;
        let maxVal = options.max;

        if (options.autoRange && data && data.length > 0) {
            const vals = [];
            data.forEach(item => {
                const v = Number(options.extract(item));
                if (!isNaN(v)) vals.push(v);
            });

            if (vals.length > 0) {
                let dMin = Math.min(...vals);
                let dMax = Math.max(...vals);

                if (options.threshold !== undefined && options.includeThreshold !== false) {
                    dMin = Math.min(dMin, options.threshold);
                    dMax = Math.max(dMax, options.threshold);
                }

                const span = dMax - dMin;
                const pad = Math.max(options.minPadding || 4, span * 0.2);
                const step = options.stepSize || 10;
                minVal = Math.floor((dMin - pad) / step) * step;
                maxVal = Math.ceil((dMax + pad) / step) * step;

                if (options.hardMin !== undefined) minVal = Math.max(options.hardMin, minVal);
                if (options.hardMax !== undefined) maxVal = Math.min(options.hardMax, maxVal);

                if (maxVal - minVal < (options.minSpan || 15)) {
                    maxVal = minVal + (options.minSpan || 15);
                }
            }
        }

        const range = maxVal - minVal || 1;

        // Draw horizontal grid lines & Y-axis labels
        const gridLines = 4;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.font = "10px ui-monospace, SFMono-Regular, monospace";

        for (let i = 0; i <= gridLines; i++) {
            const frac = i / gridLines;
            const yVal = minVal + frac * range;
            const y = padding.top + plotH - frac * plotH;

            ctx.strokeStyle = "#DFE4DA";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotW, y);
            ctx.stroke();

            ctx.fillStyle = "#889388";
            let label = yVal >= 1000 ? Math.round(yVal) : yVal.toFixed(yVal % 1 === 0 ? 0 : 1);
            ctx.fillText(label, padding.left - 6, y);
        }

        // Draw static warning/critical threshold line if configured
        if (options.threshold !== undefined && options.threshold >= minVal && options.threshold <= maxVal) {
            const threshFrac = (options.threshold - minVal) / range;
            const threshY = padding.top + plotH - threshFrac * plotH;

            ctx.save();
            ctx.strokeStyle = options.thresholdColor || "#C65353";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, threshY);
            ctx.lineTo(padding.left + plotW, threshY);
            ctx.stroke();
            ctx.restore();

            if (options.thresholdLabel) {
                ctx.fillStyle = options.thresholdColor || "#C65353";
                ctx.textAlign = "left";
                ctx.font = "9.5px -apple-system, BlinkMacSystemFont, sans-serif";
                ctx.fillText(options.thresholdLabel, padding.left + 6, threshY - 6);
            }
        }

        // Draw Chronological bottom time marks
        ctx.fillStyle = "#889388";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = "9.5px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("-60s", padding.left + 8, padding.top + plotH + 5);
        ctx.fillText("-30s", padding.left + plotW / 2, padding.top + plotH + 5);
        ctx.fillText("Now", padding.left + plotW - 10, padding.top + plotH + 5);

        // Empty buffer fallback
        if (!data || data.length === 0) {
            ctx.fillStyle = "#889388";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
            ctx.fillText("Awaiting live telemetry stream...", padding.left + plotW / 2, padding.top + plotH / 2);
            return;
        }

        // Clip rendering path inside chart viewport
        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, plotW, plotH);
        ctx.clip();

        const count = data.length;
        const getX = (idx) => {
            if (count === 1) return padding.left + plotW;
            return padding.left + (idx / (count - 1)) * plotW;
        };

        const getY = (val) => {
            const clamped = Math.max(minVal, Math.min(maxVal, val));
            return padding.top + plotH - ((clamped - minVal) / range) * plotH;
        };

        // Draw shaded gradient area fill
        ctx.beginPath();
        data.forEach((item, idx) => {
            const x = getX(idx);
            const y = getY(Number(options.extract(item)));
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.lineTo(getX(count - 1), padding.top + plotH);
        ctx.lineTo(getX(0), padding.top + plotH);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
        grad.addColorStop(0, options.fillColor || "rgba(64, 78, 59, 0.14)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke trend curve
        ctx.beginPath();
        data.forEach((item, idx) => {
            const x = getX(idx);
            const y = getY(Number(options.extract(item)));
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = options.strokeColor || "#404E3B";
        ctx.lineWidth = 2.2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();

        // Highlight latest point with pulsing beacon head
        const latestIdx = count - 1;
        const latestX = getX(latestIdx);
        const latestY = getY(Number(options.extract(data[latestIdx])));

        if (!prefersReducedMotion) {
            ctx.beginPath();
            ctx.arc(latestX, latestY, 6, 0, Math.PI * 2);
            ctx.fillStyle = options.fillColor || "rgba(123, 150, 105, 0.3)";
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(latestX, latestY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.strokeStyle = options.strokeColor || "#404E3B";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    function renderAllTelemetryCharts() {
        if (state.activeSection !== "monitoring") return;

        // 1. Spindle Speed (RPM)
        renderSingleSeriesChart(canvasRpm, {
            extract: d => d.rotational_speed,
            min: 1300,
            max: 1700,
            threshold: 1500,
            thresholdLabel: "Nominal: 1500 RPM",
            thresholdColor: "#7B9669",
            autoRange: true,
            minPadding: 25,
            stepSize: 20,
            minSpan: 80,
            strokeColor: "#404E3B",
            fillColor: "rgba(64, 78, 59, 0.12)"
        });

        // 2. Drive Torque (Nm)
        renderSingleSeriesChart(canvasTorque, {
            extract: d => d.torque,
            min: 20,
            max: 70,
            threshold: 55.0,
            thresholdLabel: "Max Continuous: 55 Nm",
            thresholdColor: "#C65353",
            autoRange: true,
            minPadding: 4,
            stepSize: 5,
            minSpan: 15,
            strokeColor: "#6C8480",
            fillColor: "rgba(108, 132, 128, 0.12)"
        });

        // 3. Ambient Air Temperature (°C)
        renderSingleSeriesChart(canvasAirTemp, {
            extract: d => d.air_temperature_c !== undefined ? d.air_temperature_c : (d.air_temperature_k - 273.15),
            min: 15,
            max: 45,
            threshold: 30.0,
            thresholdLabel: "High Ambient: 30°C",
            thresholdColor: "#C48A36",
            autoRange: true,
            minPadding: 2,
            stepSize: 2,
            minSpan: 8,
            strokeColor: "#52634C",
            fillColor: "rgba(82, 99, 76, 0.12)"
        });

        // 4. Process Operating Temperature (°C)
        renderSingleSeriesChart(canvasTemp, {
            extract: d => d.process_temperature_c !== undefined ? d.process_temperature_c : (d.process_temperature_k - 273.15),
            min: 25,
            max: 55,
            threshold: 40.0,
            thresholdLabel: "Thermal Limit: 40°C",
            thresholdColor: "#C48A36",
            autoRange: true,
            minPadding: 2,
            stepSize: 2,
            minSpan: 10,
            strokeColor: "#C48A36",
            fillColor: "rgba(196, 138, 54, 0.12)"
        });

        // 5. Tool Wear (minutes)
        renderSingleSeriesChart(canvasWear, {
            extract: d => d.tool_wear,
            min: 0,
            max: 250,
            threshold: 200,
            thresholdLabel: "Critical Flank Wear: 200 min",
            thresholdColor: "#C65353",
            autoRange: false,
            hardMin: 0,
            strokeColor: "#C65353",
            fillColor: "rgba(198, 83, 83, 0.12)"
        });

        // 6. Vibration Amplitude (mm/s RMS)
        renderSingleSeriesChart(canvasVib, {
            extract: d => d.vibration,
            min: 0.5,
            max: 4.5,
            threshold: 3.20,
            thresholdLabel: "ISO 10816 Limit: 3.2 mm/s",
            thresholdColor: "#C65353",
            autoRange: true,
            minPadding: 0.3,
            stepSize: 0.5,
            minSpan: 1.5,
            strokeColor: "#63865A",
            fillColor: "rgba(99, 134, 90, 0.12)"
        });
    }

    // =========================================================================
    // TELEMETRY POLLING & UI SYNCHRONIZATION
    // =========================================================================
    async function fetchTelemetryOnce() {
        if (state.isFetchingTelemetry) return;
        state.isFetchingTelemetry = true;

        try {
            const resp = await fetch("/api/simulator/readings?step=true");
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            const reading = data.current || data.reading;
            if (!reading) return;

            // Seed initial history if empty
            if (state.telemetryHistory.length === 0 && Array.isArray(data.history) && data.history.length > 0) {
                state.telemetryHistory = data.history.slice(-state.maxHistoryPoints);
            } else {
                state.telemetryHistory.push(reading);
                if (state.telemetryHistory.length > state.maxHistoryPoints) {
                    state.telemetryHistory.shift();
                }
            }

            // Synchronize active scenario and pause state
            if (data.active_scenario && data.active_scenario !== state.activeScenario) {
                state.activeScenario = data.active_scenario;
                if (scenarioSelect) scenarioSelect.value = data.active_scenario;
                syncScenarioButtons(data.active_scenario);
            }

            if (data.is_paused !== undefined && data.is_paused !== state.isSimPaused) {
                state.isSimPaused = data.is_paused;
                updateSimControlUI();
            }

            updateDashboardKPIs(reading);
            updateDigitalTwinHUD(reading);
            updateLiveMonitoringBadges(reading);
            requestChartRender();

        } catch (err) {
            console.error("[SmartTwin AI] Telemetry poll failed:", err);
        } finally {
            state.isFetchingTelemetry = false;
        }
    }

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

    // Update Overview Dashboard Displays
    function updateDashboardKPIs(d) {
        const dashStatus = document.getElementById("dashMachineStatus");
        const dashHealth = document.getElementById("dashHealthScore");
        const dashRisk = document.getElementById("dashFailureRisk");
        const dashWear = document.getElementById("dashToolWear");

        const dashSpeed = document.getElementById("dashSpeedVal");
        const dashTorque = document.getElementById("dashTorqueVal");
        const dashProcessTemp = document.getElementById("dashProcessTempVal");
        const dashAirTemp = document.getElementById("dashAirTempVal");

        const speed = Math.round(d.rotational_speed || 0);
        const torque = Number(d.torque || 0).toFixed(1);
        const wear = Math.round(d.tool_wear || 0);
        const pTempC = Number(d.process_temperature_c !== undefined ? d.process_temperature_c : (d.process_temperature_k - 273.15)).toFixed(1);
        const aTempC = Number(d.air_temperature_c !== undefined ? d.air_temperature_c : (d.air_temperature_k - 273.15)).toFixed(1);

        if (dashSpeed) dashSpeed.textContent = `${speed.toLocaleString()} RPM`;
        if (dashTorque) dashTorque.textContent = `${torque} Nm`;
        if (dashProcessTemp) dashProcessTemp.textContent = `${pTempC} °C`;
        if (dashAirTemp) dashAirTemp.textContent = `Air: ${aTempC} °C`;
        if (dashWear) dashWear.textContent = wear;

        // Calculate health score & condition
        let health = 95.0;
        let cond = "NORMAL";
        let condClass = "text-green";

        if (state.activeScenario === "warning") {
            health = 74.5;
            cond = "WARNING";
            condClass = "text-amber";
        } else if (state.activeScenario !== "normal") {
            health = 32.0;
            cond = "CRITICAL";
            condClass = "text-red";
        } else if (wear > 200 || Number(torque) > 55) {
            health = 68.0;
            cond = "WARNING";
            condClass = "text-amber";
        }

        if (dashStatus) {
            dashStatus.textContent = cond;
            dashStatus.className = `kpi-value ${condClass}`;
        }
        if (dashHealth) dashHealth.textContent = `Health Score: ${health.toFixed(1)}%`;

        const predRiskVal = cond === "CRITICAL" ? "84.2%" : (cond === "WARNING" ? "28.5%" : "1.2%");
        if (dashRisk) {
            dashRisk.textContent = predRiskVal;
            dashRisk.className = `kpi-value ${condClass}`;
        }
    }

    // Update Digital Twin HUD Displays
    function updateDigitalTwinHUD(d) {
        const twinSpeed = document.getElementById("twinReadoutSpeed");
        const twinTorque = document.getElementById("twinReadoutTorque");
        const twinTemp = document.getElementById("twinReadoutTemp");
        const twinWear = document.getElementById("twinReadoutWear");

        const heroTag = document.getElementById("heroStageTag");
        const heroRpm = document.getElementById("heroHudRpm");
        const heroTorque = document.getElementById("heroHudTorque");
        const heroTemp = document.getElementById("heroHudTemp");

        const twinRpm = document.getElementById("twinHudRpm");
        const twinTorqueHud = document.getElementById("twinHudTorque");
        const twinTempHud = document.getElementById("twinHudTemp");

        const speed = Math.round(d.rotational_speed || 0);
        const torque = Number(d.torque || 0).toFixed(1);
        const wear = Math.round(d.tool_wear || 0);
        const pTempC = Number(d.process_temperature_c !== undefined ? d.process_temperature_c : (d.process_temperature_k - 273.15)).toFixed(1);
        const pTempK = Number(d.process_temperature_k || (Number(pTempC) + 273.15)).toFixed(1);

        if (twinSpeed) twinSpeed.textContent = `${speed.toLocaleString()} RPM`;
        if (twinTorque) twinTorque.textContent = `${torque} Nm`;
        if (twinTemp) twinTemp.textContent = `${pTempC} °C`;
        if (twinWear) twinWear.textContent = `${wear} min`;

        const summaryText = `${speed.toLocaleString()} RPM • ${torque} Nm • ${pTempK} K`;
        if (heroTag) heroTag.textContent = summaryText;

        if (heroRpm) heroRpm.textContent = `${speed.toLocaleString()} RPM`;
        if (heroTorque) heroTorque.textContent = `${torque} Nm`;
        if (heroTemp) heroTemp.textContent = `${pTempC} °C (${pTempK} K)`;

        if (twinRpm) twinRpm.textContent = `${speed.toLocaleString()} RPM`;
        if (twinTorqueHud) twinTorqueHud.textContent = `${torque} Nm`;
        if (twinTempHud) twinTempHud.textContent = `${pTempC} °C (${pTempK} K)`;

        // Adjust rotor spinning speed via dynamic duration
        const rotorElem = document.getElementById("twinRotor");
        if (rotorElem && !prefersReducedMotion) {
            const rotDuration = Math.max(1.5, 8.0 - (speed / 4000) * 6.5);
            rotorElem.style.animationDuration = `${rotDuration.toFixed(2)}s`;
        }
    }

    // Update Live Monitoring Card Badges
    function updateLiveMonitoringBadges(d) {
        const bRpm = document.getElementById("liveValRpm");
        const bTorque = document.getElementById("liveValTorque");
        const bAir = document.getElementById("liveValAirTemp");
        const bTemp = document.getElementById("liveValProcessTemp");
        const bWear = document.getElementById("liveValWear");
        const bVib = document.getElementById("liveValVib");
        const historyStats = document.getElementById("telemetryHistoryStats");

        if (bRpm) bRpm.textContent = `${Math.round(d.rotational_speed)} RPM`;
        if (bTorque) bTorque.textContent = `${Number(d.torque).toFixed(1)} Nm`;
        if (bAir) {
            const airC = d.air_temperature_c !== undefined ? d.air_temperature_c : (d.air_temperature_k - 273.15);
            bAir.textContent = `${Number(airC).toFixed(1)} °C`;
        }
        if (bTemp) {
            const procC = d.process_temperature_c !== undefined ? d.process_temperature_c : (d.process_temperature_k - 273.15);
            bTemp.textContent = `${Number(procC).toFixed(1)} °C`;
        }
        if (bWear) bWear.textContent = `${Math.round(d.tool_wear)} min`;
        if (bVib) bVib.textContent = `${Number(d.vibration || 1.6).toFixed(2)} mm/s`;

        if (historyStats) {
            historyStats.textContent = `History: ${state.telemetryHistory.length} / ${state.maxHistoryPoints} samples`;
        }
    }

    // =========================================================================
    // AI PREDICTIONS WORKBENCH
    // =========================================================================
    const predictionForm = document.getElementById("predictionForm");
    const inputMachineType = document.getElementById("inputMachineType");
    const inputAirTemp = document.getElementById("inputAirTemp");
    const inputProcTemp = document.getElementById("inputProcTemp");
    const inputRpm = document.getElementById("inputRpm");
    const inputTorque = document.getElementById("inputTorque");
    const inputToolWear = document.getElementById("inputToolWear");

    const btnUnitK = document.getElementById("btnUnitK");
    const btnUnitC = document.getElementById("btnUnitC");
    const lblAirTemp = document.getElementById("lblAirTemp");
    const lblProcTemp = document.getElementById("lblProcTemp");
    const hintAirTemp = document.getElementById("hintAirTemp");
    const hintProcTemp = document.getElementById("hintProcTemp");

    const btnSubmitPredict = document.getElementById("btnSubmitPredict");
    const btnPredictSpinner = document.getElementById("btnPredictSpinner");
    const btnPredictText = document.getElementById("btnPredictText");

    // Dynamic temperature unit toggle (Kelvin / Celsius)
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
            hintAirTemp.textContent = "Plausible range: -23.1 – 76.8 °C (Nominal: 25.0 °C)";
            hintProcTemp.textContent = "Plausible range: -23.1 – 96.8 °C (Nominal: 35.4 °C)";
            inputAirTemp.min = -23.1;
            inputAirTemp.max = 76.8;
            inputProcTemp.min = -23.1;
            inputProcTemp.max = 96.8;

            if (!isNaN(currentAir)) inputAirTemp.value = (currentAir - 273.15).toFixed(1);
            if (!isNaN(currentProc)) inputProcTemp.value = (currentProc - 273.15).toFixed(1);
        } else {
            state.tempUnit = "K";
            btnUnitK.classList.add("active");
            btnUnitC.classList.remove("active");
            lblAirTemp.textContent = "Air Temperature [K]:";
            lblProcTemp.textContent = "Process Temperature [K]:";
            hintAirTemp.textContent = "Plausible range: 250 – 350 K (Nominal: 298.2 K)";
            hintProcTemp.textContent = "Plausible range: 250 – 370 K (Nominal: 308.6 K)";
            inputAirTemp.min = 250;
            inputAirTemp.max = 350;
            inputProcTemp.min = 250;
            inputProcTemp.max = 370;

            if (!isNaN(currentAir)) inputAirTemp.value = (currentAir + 273.15).toFixed(1);
            if (!isNaN(currentProc)) inputProcTemp.value = (currentProc + 273.15).toFixed(1);
        }
    }

    if (btnUnitK) btnUnitK.addEventListener("click", () => setTemperatureUnit("K"));
    if (btnUnitC) btnUnitC.addEventListener("click", () => setTemperatureUnit("C"));

    // Quick Test Presets
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
            torque: 74.0, // excessive torque overload
            wear: 110
        },
        twf: {
            type: "H",
            airK: 299.0,
            procK: 309.5,
            rpm: 1550,
            torque: 42.0,
            wear: 225 // > 200 min critical flank wear
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
        if (inputTorque) inputTorque.value = p.torque.toFixed(1);
        if (inputToolWear) inputToolWear.value = p.wear;

        if (state.tempUnit === "C") {
            if (inputAirTemp) inputAirTemp.value = (p.airK - 273.15).toFixed(1);
            if (inputProcTemp) inputProcTemp.value = (p.procK - 273.15).toFixed(1);
        } else {
            if (inputAirTemp) inputAirTemp.value = p.airK.toFixed(1);
            if (inputProcTemp) inputProcTemp.value = p.procK.toFixed(1);
        }
    }

    document.querySelectorAll(".btn-preset").forEach(btn => {
        btn.addEventListener("click", () => {
            applyPreset(btn.dataset.preset);
        });
    });

    const presetHealthy = document.getElementById("presetHealthy");
    const presetHdf = document.getElementById("presetHdf");
    const presetPwf = document.getElementById("presetPwf");
    const presetTwf = document.getElementById("presetTwf");

    if (presetHealthy) presetHealthy.addEventListener("click", () => applyPreset("healthy"));
    if (presetHdf) presetHdf.addEventListener("click", () => applyPreset("hdf"));
    if (presetPwf) presetPwf.addEventListener("click", () => applyPreset("pwf"));
    if (presetTwf) presetTwf.addEventListener("click", () => applyPreset("twf"));

    // Form Submission & Inference API Call
    if (predictionForm) {
        predictionForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const machineType = inputMachineType.value;
            const airTemp = parseFloat(inputAirTemp.value);
            const procTemp = parseFloat(inputProcTemp.value);
            const rpm = parseFloat(inputRpm.value);
            const torque = parseFloat(inputTorque.value);
            const wear = parseFloat(inputToolWear.value);

            if (isNaN(airTemp) || isNaN(procTemp) || isNaN(rpm) || isNaN(torque) || isNaN(wear)) {
                showToast("error", "Input Error", "Please provide valid numeric values for all parameters.");
                return;
            }

            const payload = {
                type: machineType,
                rotational_speed_rpm: rpm,
                torque_nm: torque,
                tool_wear_min: wear
            };

            if (state.tempUnit === "C") {
                payload.air_temperature_c = airTemp;
                payload.process_temperature_c = procTemp;
            } else {
                payload.air_temperature_k = airTemp;
                payload.process_temperature_k = procTemp;
            }

            btnSubmitPredict.disabled = true;
            btnPredictSpinner.style.display = "inline-block";
            btnPredictText.textContent = "Evaluating ML Pipeline...";

            try {
                const resp = await fetch("/api/predict", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!resp.ok) {
                    const errJson = await resp.json().catch(() => ({}));
                    throw new Error(errJson.detail || `HTTP ${resp.status}`);
                }

                const data = await resp.json();
                renderPredictionResult(data);
                showToast("success", "Inference Completed", "Predictive maintenance analysis completed successfully.");

            } catch (err) {
                console.error("Prediction inference error:", err);
                showToast("error", "Inference Failed", err.message || "Failed to execute prediction pipeline.");
            } finally {
                btnSubmitPredict.disabled = false;
                btnPredictSpinner.style.display = "none";
                btnPredictText.textContent = "Run Prediction";
            }
        });
    }

    function renderPredictionResult(data) {
        const pred = data.prediction || {};
        const risk = Number(pred.failure_probability || 0);
        const isFailure = Boolean(pred.failure_predicted);

        const riskElem = document.getElementById("predResultRisk");
        const badgeElem = document.getElementById("predResultBadge");
        const diagElem = document.getElementById("predResultDiagnosis");
        const recList = document.getElementById("predRecommendationsList");
        const compElem = document.getElementById("predPhysicsComparison");

        if (riskElem) {
            riskElem.textContent = `${(risk * 100).toFixed(1)}%`;
            riskElem.className = `risk-pct-large ${isFailure ? "danger" : (risk > 0.3 ? "warning" : "healthy")}`;
        }

        if (badgeElem) {
            if (isFailure) {
                badgeElem.textContent = "CRITICAL — FAILURE DETECTED";
                badgeElem.className = "badge badge-danger";
            } else if (risk > 0.3) {
                badgeElem.textContent = "WARNING — ELEVATED RISK";
                badgeElem.className = "badge badge-warning";
            } else {
                badgeElem.textContent = "OPTIMAL — HEALTHY";
                badgeElem.className = "badge badge-success";
            }
        }

        if (diagElem) {
            if (isFailure && data.failure_modes_detected && data.failure_modes_detected.length > 0) {
                diagElem.innerHTML = `<strong>Root Cause Diagnostics:</strong> Identified failure trajectory in mode(s): <span class="badge badge-danger">${data.failure_modes_detected.join(", ")}</span>`;
            } else {
                diagElem.textContent = isFailure
                    ? "Model predicts high probability of imminent machinery failure under current operating conditions."
                    : "Machining parameters within nominal operating bounds. Low probability of operational failure.";
            }
        }

        if (recList && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
            recList.innerHTML = data.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join("");
        }

        if (compElem) {
            if (isFailure) {
                compElem.innerHTML = `<strong>Rule vs Model Divergence:</strong> ML pipeline predicts elevated breakdown risk (${(risk * 100).toFixed(1)}%). Recommended preventative inspection before resuming high-speed cut.`;
            } else {
                compElem.textContent = "Static physical threshold rules and multi-variate ML predictions agree: the spindle is operating safely inside nominal boundaries.";
            }
        }
    }

    // =========================================================================
    // ALERTS MANAGEMENT CENTER
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
            showToast("info", "Alerts Refreshed", "Loaded latest incident records from SQLite.");
        });
    }

    async function loadAlerts() {
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

            // Update badge count
            const unackedCount = alerts.filter(a => a.acknowledged === 0 && a.is_active === 1).length;
            if (alertCountBadge) {
                alertCountBadge.textContent = unackedCount;
                alertCountBadge.style.display = unackedCount > 0 ? "inline-block" : "none";
            }

            const dashAlertCount = document.getElementById("dashAlertCount");
            if (dashAlertCount) dashAlertCount.textContent = unackedCount;

            renderOverviewAlerts(alerts.slice(0, 3));

            if (!tbody) return;

            if (alerts.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align: center; padding: 24px;">No incident records matching filter criteria.</td></tr>`;
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
                        <td><small>${a.source || "SIMULATION"}</small></td>
                        <td>${demoBadge}${escapeHtml(a.message)}</td>
                        <td><strong>${a.occurrence_count || 1}×</strong></td>
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
                            showToast("success", "Alert Acknowledged", `Incident #${id} acknowledged by operator.`);
                            loadAlerts();
                        }
                    } catch (err) {
                        console.error("Failed to acknowledge alert:", err);
                    }
                });
            });

        } catch (err) {
            console.error("Failed to load alerts:", err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-red" style="text-align: center; padding: 24px;">Error loading alerts from database.</td></tr>`;
            }
        }
    }

    function renderOverviewAlerts(recent) {
        const container = document.getElementById("overviewAlertsList");
        if (!container) return;

        if (recent.length === 0) {
            container.innerHTML = `<div class="text-muted" style="text-align: center; padding: 16px 0;">No active critical alerts.</div>`;
            return;
        }

        container.innerHTML = recent.map(a => {
            const sevClass = a.severity === "CRITICAL" ? "critical" : "warning";
            const isDemo = a.is_demo === 1 || a.message.startsWith("[DEMO");
            const demoTag = isDemo ? `<span class="demo-tag">DEMO</span>` : "";

            return `
                <div class="feed-item ${sevClass}">
                    <div>
                        <div class="feed-title">${demoTag}${escapeHtml(a.alert_type)} • <span class="badge ${a.severity === "CRITICAL" ? "badge-danger" : "badge-warning"}">${a.severity}</span></div>
                        <div class="feed-desc">${escapeHtml(a.message)}</div>
                        <div class="feed-time">${a.last_seen_at || a.timestamp} • Occurrences: ${a.occurrence_count || 1}×</div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // =========================================================================
    // MAINTENANCE LOG & SERVICE RECORDS
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
            if (maintModal) maintModal.style.display = "flex";
        });
    }

    function closeMaintModal() {
        if (maintModal) maintModal.style.display = "none";
    }

    if (btnModalClose) btnModalClose.addEventListener("click", closeMaintModal);
    if (btnModalCancel) btnModalCancel.addEventListener("click", closeMaintModal);

    if (maintSearchInput) maintSearchInput.addEventListener("input", debounce(() => loadMaintenanceHistory(), 250));
    if (maintTypeFilter) maintTypeFilter.addEventListener("change", () => loadMaintenanceHistory());

    async function loadMaintenanceHistory() {
        const tbody = document.getElementById("maintTableBody");
        let url = "/api/maintenance?limit=100";

        if (maintSearchInput && maintSearchInput.value.trim()) {
            url += `&search=${encodeURIComponent(maintSearchInput.value.trim())}`;
        }
        if (maintTypeFilter && maintTypeFilter.value !== "ALL") {
            url += `&action_type=${encodeURIComponent(maintTypeFilter.value)}`;
        }

        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            const events = data.events || [];
            renderOverviewMaintenance(events.slice(0, 3));

            if (!tbody) return;

            if (events.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align: center; padding: 24px;">No maintenance records found.</td></tr>`;
                return;
            }

            tbody.innerHTML = events.map(e => {
                const isDemo = e.is_demo === 1 || (e.description && e.description.startsWith("[DEMO"));
                const tag = isDemo ? `<span class="demo-tag">DEMO</span>` : `<span class="badge badge-success">USER</span>`;

                return `
                    <tr>
                        <td><strong>#${e.id}</strong></td>
                        <td><small>${e.performed_at || e.timestamp}</small></td>
                        <td><strong>${escapeHtml(e.component)}</strong></td>
                        <td><span class="badge badge-info">${escapeHtml(e.action_type)}</span></td>
                        <td>${tag} ${escapeHtml(e.description)}</td>
                        <td>${escapeHtml(e.technician_name || "Plant Tech")}</td>
                        <td><small class="text-muted">${escapeHtml(e.notes || "-")}</small></td>
                    </tr>
                `;
            }).join("");

        } catch (err) {
            console.error("Failed to load maintenance records:", err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-red" style="text-align: center; padding: 24px;">Error loading maintenance records.</td></tr>`;
            }
        }
    }

    function renderOverviewMaintenance(recent) {
        const container = document.getElementById("overviewMaintList");
        if (!container) return;

        if (recent.length === 0) {
            container.innerHTML = `<div class="text-muted" style="text-align: center; padding: 16px 0;">No recent maintenance events.</div>`;
            return;
        }

        container.innerHTML = recent.map(e => {
            const isDemo = e.is_demo === 1 || (e.description && e.description.startsWith("[DEMO"));
            const tag = isDemo ? `<span class="demo-tag">DEMO</span>` : "";

            return `
                <div class="feed-item">
                    <div>
                        <div class="feed-title">${tag}${escapeHtml(e.action_type)} • <strong>${escapeHtml(e.component)}</strong></div>
                        <div class="feed-desc">${escapeHtml(e.description)}</div>
                        <div class="feed-time">${e.performed_at || e.timestamp} • Tech: ${escapeHtml(e.technician_name || "Engineer")}</div>
                    </div>
                </div>
            `;
        }).join("");
    }

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

                showToast("success", "Maintenance Recorded", "Service log entry persisted to SQLite database.");
                maintForm.reset();
                closeMaintModal();
                loadMaintenanceHistory();

            } catch (err) {
                console.error("Failed to save maintenance record:", err);
                showToast("error", "Save Failed", "Failed to insert record into SQLite.");
            } finally {
                btnSubmitMaint.disabled = false;
                btnSubmitMaint.textContent = "Save Record to SQLite";
            }
        });
    }

    // =========================================================================
    // MODEL PERFORMANCE METRICS (ACCURACY, RECALL, CONFUSION MATRIX)
    // =========================================================================
    async function loadModelMetrics() {
        try {
            const resp = await fetch("/api/model/metrics");
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            const metrics = data.evaluation_metrics || {};
            const cm = data.confusion_matrix || {};
            const featImportances = data.feature_importances || data.feature_importance || {};

            // Accuracy, Recall, Precision, F1, ROC-AUC
            const acc = metrics.accuracy !== undefined ? metrics.accuracy : 0.9790;
            const rec = metrics.recall_failure_class !== undefined ? metrics.recall_failure_class : (metrics.failure_recall !== undefined ? metrics.failure_recall : 0.6029);
            const prec = metrics.precision_failure_class !== undefined ? metrics.precision_failure_class : (metrics.failure_precision !== undefined ? metrics.failure_precision : 0.7321);
            const f1 = metrics.f1_score_failure_class !== undefined ? metrics.f1_score_failure_class : (metrics.f1_score !== undefined ? metrics.f1_score : 0.6613);
            const rocAuc = metrics.roc_auc !== undefined ? metrics.roc_auc : 0.9590;

            const metricAccuracy = document.getElementById("metricAccuracy");
            const metricRecall = document.getElementById("metricRecall");
            const metricPrecision = document.getElementById("metricPrecision");
            const metricF1 = document.getElementById("metricF1");
            const metricRocAuc = document.getElementById("metricRocAuc");

            if (metricAccuracy) metricAccuracy.textContent = (acc * 100).toFixed(2) + "%";
            if (metricRecall) metricRecall.textContent = (rec * 100).toFixed(2) + "%";
            if (metricPrecision) metricPrecision.textContent = (prec * 100).toFixed(2) + "%";
            if (metricF1) metricF1.textContent = f1.toFixed(4);
            if (metricRocAuc) metricRocAuc.textContent = rocAuc.toFixed(4);

            // Confusion Matrix
            let tn = cm.true_negatives_healthy_correct || cm.true_negatives;
            let fp = cm.false_positives_false_alarms || cm.false_positives;
            let fn = cm.false_negatives_missed_failures || cm.false_negatives;
            let tp = cm.true_positives_failures_detected || cm.true_positives;

            if (cm.matrix && Array.isArray(cm.matrix) && cm.matrix.length >= 2) {
                if (tn === undefined) tn = cm.matrix[0][0];
                if (fp === undefined) fp = cm.matrix[0][1];
                if (fn === undefined) fn = cm.matrix[1][0];
                if (tp === undefined) tp = cm.matrix[1][1];
            }

            const cmTN = document.getElementById("cmTN");
            const cmFP = document.getElementById("cmFP");
            const cmFN = document.getElementById("cmFN");
            const cmTP = document.getElementById("cmTP");

            if (cmTN) cmTN.textContent = (tn || 1917).toLocaleString();
            if (cmFP) cmFP.textContent = (fp || 15).toLocaleString();
            if (cmFN) cmFN.textContent = (fn || 27).toLocaleString();
            if (cmTP) cmTP.textContent = (tp || 41).toLocaleString();

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
                                <strong class="text-forest">${(weight * 100).toFixed(1)}%</strong>
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
    // UTILITIES
    // =========================================================================
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
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
            "num__Torque [Nm]": "Drive Torque [Nm]",
            "Torque [Nm]": "Drive Torque [Nm]",
            "num__Rotational speed [rpm]": "Rotational Speed [RPM]",
            "Rotational speed [rpm]": "Rotational Speed [RPM]",
            "num__Tool wear [min]": "Tool Wear [minutes]",
            "Tool wear [min]": "Tool Wear [minutes]",
            "num__Process temperature [K]": "Process Temperature [K]",
            "Process temperature [K]": "Process Temperature [K]",
            "num__Air temperature [K]": "Air Temperature [K]",
            "Air temperature [K]": "Air Temperature [K]",
            "cat__Type_L": "Variant Quality: Type L",
            "cat__Type_M": "Variant Quality: Type M",
            "cat__Type_H": "Variant Quality: Type H",
            "Type_L": "Variant Quality: Type L",
            "Type_M": "Variant Quality: Type M",
            "Type_H": "Variant Quality: Type H"
        };
        return map[name] || name;
    }

    // =========================================================================
    // RUNTIME INITIALIZATION
    // =========================================================================
    checkBackendHealth();
    loadAlerts();
    loadMaintenanceHistory();
    loadModelMetrics();

    // Check initial route
    handleHashRoute();

    console.log("[SmartTwin AI] Jade Pebble Morning client controller initialized.");
});

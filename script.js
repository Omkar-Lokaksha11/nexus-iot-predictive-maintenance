/**
 * SMARTTWIN AI — FRONTEND CLIENT CONTROLLER (TROPICAL HEAT EDITION)
 * AI-Based Digital Twin for Smart Manufacturing Using Predictive Maintenance
 * Full-stack integration with FastAPI backend, SQLite persistence, and Scikit-learn ML pipeline.
 * Palette: Turquoise (#00CEC8), Cream (#FCEFC3), Peach (#FF9C5F), Orange-red (#EB4203).
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log("[SmartTwin AI] Initializing Tropical Heat client controller...");

    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================
    const state = {
        activeSection: "overview",
        isSimPaused: false,
        activeScenario: "normal",
        machineType: "M",
        tempUnit: "C", // 'C' or 'K'
        isFetchingTelemetry: false,
        telemetryTimer: null,
        telemetryHistory: [], // bounded rolling buffer (80 points)
        maxHistoryPoints: 80,
        alerts: [],
        alertSummary: null,
        activeAlertId: null,
        currentAlertData: null,
        maintenanceEvents: [],
        modelMetrics: null,
        chartsLayout: "grid", // 'grid' or 'stacked'
        toolWearViewMode: "detail" // 'detail' (focused recent autoRange) or 'full' (0–250 min)
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
        }, 4000);
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
    const btnLandingMobileMenu = document.getElementById("btnLandingMobileMenu");

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
            sub: "Monitor machine parameters, evaluate predicted risk and manage maintenance activity."
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
            sub: "Enterprise incident management: team assignment, field action records, and verified sign-off."
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

        // Section-specific triggers
        if (sectionId === "alerts") {
            loadAlerts();
        } else if (sectionId === "maintenance") {
            loadMaintenanceHistory();
        } else if (sectionId === "model-perf") {
            loadModelMetrics();
        } else if (sectionId === "monitoring") {
            requestAnimationFrame(() => {
                resizeAllCanvases();
                setTimeout(resizeAllCanvases, 40);
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

    // Metallurgy Variant Selection (L, M, H)
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
                    body: JSON.stringify({ action: "step", machine_type: state.machineType })
                });
                showToast("info", "Variant Updated", `Machine metallurgy set to Type ${state.machineType}.`);
            } catch (err) {
                console.error("Failed to update machine type:", err);
            }
        });
    });

    function updateSimControlUI() {
        if (!simPauseIcon || !simPauseText) return;
        if (state.isSimPaused) {
            simPauseIcon.textContent = "▶";
            simPauseText.textContent = "Resume";
            if (btnSimPauseResume) btnSimPauseResume.classList.add("btn-primary");
        } else {
            simPauseIcon.textContent = "⏸";
            simPauseText.textContent = "Pause";
            if (btnSimPauseResume) btnSimPauseResume.classList.remove("btn-primary");
        }
    }

    if (btnSimPauseResume) {
        btnSimPauseResume.addEventListener("click", async () => {
            const nextAction = state.isSimPaused ? "resume" : "pause";
            try {
                const resp = await fetch("/api/simulator/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: nextAction, command: nextAction })
                });
                if (resp.ok) {
                    state.isSimPaused = !state.isSimPaused;
                    updateSimControlUI();
                    showToast("info", "Simulation State", `Simulator ${state.isSimPaused ? "Paused" : "Resumed"}.`);
                }
            } catch (err) {
                console.error("Failed to toggle simulator pause state:", err);
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
                    state.activeScenario = "normal";
                    state.isSimPaused = false;
                    state.telemetryHistory = [];
                    updateSimControlUI();
                    syncScenarioButtons("normal");
                    showToast("success", "Simulator Reset", "Machine reset to factory baseline nominal values.");
                    fetchTelemetryOnce();
                }
            } catch (err) {
                console.error("Failed to reset simulator:", err);
            }
        });
    }

    // =========================================================================
    // CHARTING ENGINE (TROPICAL HEAT PALETTE)
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

    // Toggle Cutting Tool Wear View Mode (Recent Detail vs Full Scale)
    const btnWearDetail = document.getElementById("btnWearDetail");
    const btnWearFull = document.getElementById("btnWearFull");
    if (btnWearDetail && btnWearFull) {
        btnWearDetail.addEventListener("click", () => {
            state.toolWearViewMode = "detail";
            btnWearDetail.classList.add("active");
            btnWearFull.classList.remove("active");
            requestChartRender();
        });
        btnWearFull.addEventListener("click", () => {
            state.toolWearViewMode = "full";
            btnWearFull.classList.add("active");
            btnWearDetail.classList.remove("active");
            requestChartRender();
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

        const padding = { top: 14, right: 14, bottom: 22, left: 46 };
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

            ctx.strokeStyle = "#E8E1D6";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotW, y);
            ctx.stroke();

            ctx.fillStyle = "#828282";
            let label = yVal >= 1000 ? Math.round(yVal) : yVal.toFixed(yVal % 1 === 0 ? 0 : 1);
            ctx.fillText(label, padding.left - 6, y);
        }

        // Static warning threshold line or offscreen reference badge
        if (options.threshold !== undefined) {
            if (options.threshold >= minVal && options.threshold <= maxVal) {
                const threshFrac = (options.threshold - minVal) / range;
                const threshY = padding.top + plotH - threshFrac * plotH;

                ctx.save();
                ctx.strokeStyle = options.thresholdColor || "#EB4203";
                ctx.lineWidth = 1.2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(padding.left, threshY);
                ctx.lineTo(padding.left + plotW, threshY);
                ctx.stroke();
                ctx.restore();

                if (options.thresholdLabel) {
                    ctx.fillStyle = options.thresholdColor || "#EB4203";
                    ctx.textAlign = "left";
                    ctx.font = "9.5px -apple-system, BlinkMacSystemFont, sans-serif";
                    ctx.fillText(options.thresholdLabel, padding.left + 6, threshY - 6);
                }
            } else if (options.showOffscreenBadge && options.threshold > maxVal) {
                // Clear, honest indicator when threshold is outside current detail zoom
                ctx.save();
                const badgeText = options.offscreenBadgeText || `Reference Threshold: ${options.threshold} min (Above current range)`;
                ctx.font = "9.5px -apple-system, BlinkMacSystemFont, sans-serif";
                const tw = ctx.measureText(badgeText).width;
                const bx = padding.left + plotW - tw - 12;
                const by = padding.top + 4;
                ctx.fillStyle = "rgba(235, 66, 3, 0.08)";
                ctx.strokeStyle = "rgba(235, 66, 3, 0.35)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(bx, by, tw + 8, 16, 4);
                else ctx.rect(bx, by, tw + 8, 16);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = "#EB4203";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText(badgeText, bx + 4, by + 8);
                ctx.restore();
            }
        }

        // Chronological time marks
        ctx.fillStyle = "#828282";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = "9.5px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("-80s", padding.left + 8, padding.top + plotH + 5);
        ctx.fillText("-40s", padding.left + plotW / 2, padding.top + plotH + 5);
        ctx.fillText("Now", padding.left + plotW - 10, padding.top + plotH + 5);

        // Empty buffer fallback
        if (!data || data.length === 0) {
            ctx.fillStyle = "#828282";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
            ctx.fillText("Awaiting live telemetry stream...", padding.left + plotW / 2, padding.top + plotH / 2);
            return;
        }

        // Clip inside chart viewport
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
        grad.addColorStop(0, options.fillColor || "rgba(0, 206, 200, 0.15)");
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
        ctx.strokeStyle = options.strokeColor || "#087F7A";
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
            ctx.fillStyle = options.fillColor || "rgba(0, 206, 200, 0.3)";
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(latestX, latestY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.strokeStyle = options.strokeColor || "#087F7A";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    function renderAllTelemetryCharts() {
        if (state.activeSection !== "monitoring") return;

        // 1. Spindle Speed (RPM) — Tropical Heat Muted Teal / Turquoise
        renderSingleSeriesChart(canvasRpm, {
            extract: d => d.rotational_speed,
            min: 1300,
            max: 1700,
            threshold: 1500,
            thresholdLabel: "Nominal: 1500 RPM",
            thresholdColor: "#087F7A",
            autoRange: true,
            minPadding: 25,
            stepSize: 20,
            minSpan: 80,
            strokeColor: "#087F7A",
            fillColor: "rgba(0, 206, 200, 0.16)"
        });

        // 2. Drive Torque (Nm) — Tropical Heat Orange-Red
        renderSingleSeriesChart(canvasTorque, {
            extract: d => d.torque,
            min: 20,
            max: 70,
            threshold: 55.0,
            thresholdLabel: "Continuous Limit: 55 Nm",
            thresholdColor: "#EB4203",
            autoRange: true,
            minPadding: 4,
            stepSize: 5,
            minSpan: 15,
            strokeColor: "#EB4203",
            fillColor: "rgba(235, 66, 3, 0.14)"
        });

        // 3. Ambient Air Temperature (°C) — Tropical Heat Turquoise
        renderSingleSeriesChart(canvasAirTemp, {
            extract: d => d.air_temperature_c !== undefined ? d.air_temperature_c : (d.air_temperature_k - 273.15),
            min: 15,
            max: 45,
            threshold: 30.0,
            thresholdLabel: "High Ambient: 30°C",
            thresholdColor: "#00CEC8",
            autoRange: true,
            minPadding: 2,
            stepSize: 2,
            minSpan: 8,
            strokeColor: "#00CEC8",
            fillColor: "rgba(0, 206, 200, 0.12)"
        });

        // 4. Process Operating Temperature (°C) — Tropical Heat Peach
        renderSingleSeriesChart(canvasTemp, {
            extract: d => d.process_temperature_c !== undefined ? d.process_temperature_c : (d.process_temperature_k - 273.15),
            min: 25,
            max: 55,
            threshold: 40.0,
            thresholdLabel: "Thermal Boundary: 40°C",
            thresholdColor: "#FF9C5F",
            autoRange: true,
            minPadding: 2,
            stepSize: 2,
            minSpan: 10,
            strokeColor: "#FF9C5F",
            fillColor: "rgba(255, 156, 95, 0.16)"
        });

        // 5. Cutting Tool Wear Progression (minutes) — Tropical Heat Orange-Red
        if (state.toolWearViewMode === "detail") {
            renderSingleSeriesChart(canvasWear, {
                extract: d => d.tool_wear,
                min: 0,
                max: 50,
                threshold: 200,
                thresholdLabel: "Tool Wear Risk Reference: 200 min — simulation threshold",
                thresholdColor: "#EB4203",
                autoRange: true,
                includeThreshold: false,
                minPadding: 0.8,
                stepSize: 1.0,
                minSpan: 5.0,
                hardMin: 0,
                showOffscreenBadge: true,
                offscreenBadgeText: "Risk Ref: 200 min (Above detail range)",
                strokeColor: "#EB4203",
                fillColor: "rgba(235, 66, 3, 0.16)"
            });
        } else {
            renderSingleSeriesChart(canvasWear, {
                extract: d => d.tool_wear,
                min: 0,
                max: 250,
                threshold: 200,
                thresholdLabel: "Tool Wear Risk Reference: 200 min — simulation threshold",
                thresholdColor: "#EB4203",
                autoRange: false,
                hardMin: 0,
                hardMax: 250,
                strokeColor: "#EB4203",
                fillColor: "rgba(235, 66, 3, 0.16)"
            });
        }

        // 6. Vibration Amplitude (mm/s RMS) — Tropical Heat Muted Teal / Deep Turquoise
        renderSingleSeriesChart(canvasVib, {
            extract: d => d.vibration,
            min: 0.5,
            max: 4.5,
            threshold: 3.20,
            thresholdLabel: "Configured Vibration Alert Limit: 3.2 mm/s RMS",
            thresholdColor: "#EB4203",
            autoRange: true,
            minPadding: 0.25,
            stepSize: 0.5,
            minSpan: 1.5,
            strokeColor: "#087F7A",
            fillColor: "rgba(8, 127, 122, 0.15)"
        });
    }

    // =========================================================================
    // TELEMETRY POLLING & DASHBOARD KPIS
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

            // Sync active scenario and pause state
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

    function updateDashboardKPIs(d) {
        const dashStatus = document.getElementById("dashMachineStatus");
        const dashHealth = document.getElementById("dashHealthScore");
        const dashRisk = document.getElementById("dashFailureRisk");
        const dashSpeedKpi = document.getElementById("dashSpeedKpi");
        const dashTempKpi = document.getElementById("dashTempKpi");
        const dashAirSubKpi = document.getElementById("dashAirSubKpi");
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
        const vib = Number(d.vibration || 1.48).toFixed(2);

        if (dashSpeedKpi) dashSpeedKpi.textContent = speed.toLocaleString();
        if (dashTempKpi) dashTempKpi.textContent = pTempC;
        if (dashAirSubKpi) dashAirSubKpi.textContent = `Air: ${aTempC} °C`;
        if (dashWear) dashWear.textContent = wear;

        if (dashSpeed) dashSpeed.textContent = `${speed.toLocaleString()} RPM`;
        if (dashTorque) dashTorque.textContent = `${torque} Nm`;
        if (dashProcessTemp) dashProcessTemp.textContent = `${pTempC} °C`;
        if (dashAirTemp) dashAirTemp.textContent = `Air: ${aTempC} °C`;

        // Update Hero Machine Photograph Overlays
        const heroTagSpeed = document.getElementById("heroTagSpeed");
        const heroTagTorque = document.getElementById("heroTagTorque");
        const heroTagTemp = document.getElementById("heroTagTemp");
        const heroTagVib = document.getElementById("heroTagVib");

        if (heroTagSpeed) heroTagSpeed.textContent = `${speed.toLocaleString()} RPM`;
        if (heroTagTorque) heroTagTorque.textContent = `${torque} Nm`;
        if (heroTagTemp) heroTagTemp.textContent = `${pTempC} °C`;
        if (heroTagVib) heroTagVib.textContent = `${vib} mm/s`;

        // Update Preview Cards
        const prevSpeed = document.getElementById("prevToolWear");
        if (prevSpeed) prevSpeed.textContent = `${wear} min`;

        // Health Score & Status
        let health = Number(d.health_score || 95.0);
        let cond = d.overall_status || "NORMAL";
        let condClass = cond === "CRITICAL" ? "text-red" : (cond === "WARNING" ? "text-amber" : "text-green");

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

    function updateDigitalTwinHUD(d) {
        const speed = Math.round(d.rotational_speed || 0);
        const torque = Number(d.torque || 0).toFixed(1);
        const wear = Math.round(d.tool_wear || 0);
        const pTempC = Number(d.process_temperature_c !== undefined ? d.process_temperature_c : (d.process_temperature_k - 273.15)).toFixed(1);
        const pTempK = Number(d.process_temperature_k || 308.6).toFixed(1);
        const vib = Number(d.vibration || 1.48).toFixed(2);

        const twinReadoutSpeed = document.getElementById("twinReadoutSpeed");
        const twinReadoutTorque = document.getElementById("twinReadoutTorque");
        const twinReadoutTemp = document.getElementById("twinReadoutTemp");
        const twinReadoutWear = document.getElementById("twinReadoutWear");
        const twinReadoutVib = document.getElementById("twinReadoutVib");

        if (twinReadoutSpeed) twinReadoutSpeed.textContent = `${speed.toLocaleString()} RPM`;
        if (twinReadoutTorque) twinReadoutTorque.textContent = `${torque} Nm`;
        if (twinReadoutTemp) twinReadoutTemp.textContent = `${pTempC} °C (${pTempK} K)`;
        if (twinReadoutWear) twinReadoutWear.textContent = `${wear} min`;
        if (twinReadoutVib) twinReadoutVib.textContent = `${vib} mm/s`;

        const hudRpmText = document.getElementById("hudRpmText");
        const hudTorqueText = document.getElementById("hudTorqueText");
        const hudTempText = document.getElementById("hudTempText");

        if (hudRpmText) hudRpmText.textContent = `${speed} RPM`;
        if (hudTorqueText) hudTorqueText.textContent = `${torque} Nm`;
        if (hudTempText) hudTempText.textContent = `${pTempC} °C`;
    }

    function updateLiveMonitoringBadges(d) {
        const liveRpm = document.getElementById("liveValRpm");
        const liveTorque = document.getElementById("liveValTorque");
        const liveAir = document.getElementById("liveValAirTemp");
        const liveProcess = document.getElementById("liveValProcessTemp");
        const liveWear = document.getElementById("liveValWear");
        const liveVib = document.getElementById("liveValVib");

        const pTempC = Number(d.process_temperature_c !== undefined ? d.process_temperature_c : (d.process_temperature_k - 273.15)).toFixed(1);
        const aTempC = Number(d.air_temperature_c !== undefined ? d.air_temperature_c : (d.air_temperature_k - 273.15)).toFixed(1);

        if (liveRpm) liveRpm.textContent = `${Math.round(d.rotational_speed)} RPM`;
        if (liveTorque) liveTorque.textContent = `${Number(d.torque).toFixed(1)} Nm`;
        if (liveAir) liveAir.textContent = `${aTempC} °C`;
        if (liveProcess) liveProcess.textContent = `${pTempC} °C`;
        if (liveWear) {
            const wearVal = Number(d.tool_wear !== undefined ? d.tool_wear : 0);
            liveWear.textContent = `${wearVal.toFixed(1)} min`;
        }
        const wearMetaStats = document.getElementById("wearMetaStats");
        if (wearMetaStats) {
            const rate = d.tool_wear_rate !== undefined ? Number(d.tool_wear_rate) : 0.15;
            wearMetaStats.textContent = `Rate: +${rate.toFixed(2)} min/step | Scale: 1 step ≈ 1 min`;
        }
        if (liveVib) liveVib.textContent = `${Number(d.vibration || 1.48).toFixed(2)} mm/s`;
    }

    // =========================================================================
    // AI PREDICTIONS WORKBENCH & PRESETS
    // =========================================================================
    const predictionForm = document.getElementById("predictionForm");
    const btnRunPrediction = document.getElementById("btnRunPrediction");
    const predResultBox = document.getElementById("predResultBox");
    const predMeterFill = document.getElementById("predMeterFill");
    const predResultStatusBadge = document.getElementById("predResultStatusBadge");
    const predResultProbability = document.getElementById("predResultProbability");
    const predResultDiagnosis = document.getElementById("predResultDiagnosis");
    const predResultPrescription = document.getElementById("predResultPrescription");
    const predTimestampBadge = document.getElementById("predTimestampBadge");

    const presets = {
        nominal: { type: "M", airK: 298.2, procK: 308.6, rpm: 1480, torque: 40.0, wear: 35 },
        hdf: { type: "M", airK: 304.5, procK: 313.2, rpm: 1380, torque: 52.0, wear: 80 },
        pwf: { type: "L", airK: 299.0, procK: 309.0, rpm: 1150, torque: 76.5, wear: 110 },
        twf: { type: "H", airK: 298.5, procK: 309.2, rpm: 1520, torque: 42.0, wear: 225 },
        osf: { type: "L", airK: 298.0, procK: 308.5, rpm: 1360, torque: 64.0, wear: 210 }
    };

    document.querySelectorAll(".preset-chip").forEach(btn => {
        btn.addEventListener("click", () => {
            const key = btn.dataset.preset;
            const p = presets[key];
            if (!p) return;

            document.getElementById("predTypeSelect").value = p.type;
            document.getElementById("predAirTemp").value = p.airK;
            document.getElementById("predProcessTemp").value = p.procK;
            document.getElementById("predSpeed").value = p.rpm;
            document.getElementById("predTorque").value = p.torque;
            document.getElementById("predWear").value = p.wear;

            showToast("info", "Preset Applied", `Loaded ${btn.textContent} operating conditions.`);
            if (predictionForm) {
                btnRunPrediction.click();
            }
        });
    });

    if (predictionForm) {
        predictionForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const payload = {
                type: document.getElementById("predTypeSelect").value,
                air_temperature_k: parseFloat(document.getElementById("predAirTemp").value),
                process_temperature_k: parseFloat(document.getElementById("predProcessTemp").value),
                rotational_speed_rpm: parseFloat(document.getElementById("predSpeed").value),
                torque_nm: parseFloat(document.getElementById("predTorque").value),
                tool_wear_min: parseFloat(document.getElementById("predWear").value)
            };

            btnRunPrediction.disabled = true;
            btnRunPrediction.innerHTML = `<span class="btn-spinner"></span> <span>Running ML Pipeline...</span>`;

            try {
                const resp = await fetch("/api/predict", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!resp.ok) {
                    const errData = await resp.json().catch(() => ({}));
                    throw new Error(errData.detail || `Server returned HTTP ${resp.status}`);
                }

                const data = await resp.json();
                renderPredictionResult(data);
                showToast("success", "Inference Completed", "Evaluated parameters via Scikit-learn Random Forest.");

            } catch (err) {
                console.error("Prediction submission failed:", err);
                showToast("error", "Prediction Error", err.message || "Failed to submit prediction request.");
            } finally {
                btnRunPrediction.disabled = false;
                btnRunPrediction.innerHTML = `<span>Run AI Failure Prediction</span> <span aria-hidden="true">⚡</span>`;
            }
        });
    }

    function renderPredictionResult(data) {
        const pred = data.prediction || {};
        const diag = data.diagnostics || {};
        const prob = Number(pred.failure_probability || 0);
        const pct = (prob * 100).toFixed(1);
        const isFailure = Boolean(pred.failure_predicted);

        if (predMeterFill) predMeterFill.style.width = `${Math.min(100, Math.max(2, pct))}%`;

        if (predResultStatusBadge) {
            if (isFailure || prob >= 0.50) {
                predResultStatusBadge.textContent = "CRITICAL — FAILURE DETECTED";
                predResultStatusBadge.className = "badge badge-danger";
            } else if (prob >= 0.20) {
                predResultStatusBadge.textContent = "WARNING — ELEVATED RISK";
                predResultStatusBadge.className = "badge badge-warning";
            } else {
                predResultStatusBadge.textContent = "OPTIMAL — HEALTHY";
                predResultStatusBadge.className = "badge badge-success";
            }
        }

        if (predResultProbability) {
            predResultProbability.innerHTML = `Failure Probability: <strong>${pct}%</strong>`;
        }

        if (predResultDiagnosis) {
            if (diag.suspected_modes && diag.suspected_modes.length > 0) {
                predResultDiagnosis.innerHTML = `<strong>Suspected Breakdown Trajectory:</strong> ${escapeHtml(diag.suspected_modes[0].mode)} — ${escapeHtml(diag.suspected_modes[0].reason)}`;
            } else if (isFailure) {
                predResultDiagnosis.textContent = "Multi-variate degradation pattern detected across speed, torque, and thermal variables.";
            } else {
                predResultDiagnosis.textContent = "Machining parameters within nominal operating bounds. No abnormal degradation detected.";
            }
        }

        if (predResultPrescription) {
            if (data.recommendations && data.recommendations.length > 0) {
                predResultPrescription.textContent = data.recommendations[0];
            } else {
                predResultPrescription.textContent = isFailure
                    ? "Schedule immediate tooling inspection and verify coolant radiator flow before catastrophic tool break."
                    : "Machining parameters verified within factory envelope. Continue standard operational production.";
            }
        }

        if (predTimestampBadge) {
            const now = new Date();
            predTimestampBadge.textContent = `Evaluated at ${now.toTimeString().split(" ")[0]}`;
        }
    }

    // =========================================================================
    // PART 11 — ALERT CENTER: COMPLETE ASSIGNMENT AND RESOLUTION WORKFLOW
    // =========================================================================
    let currentAlertFilterSev = "ALL";
    const alertStatusFilter = document.getElementById("alertStatusFilter");
    const alertTeamFilter = document.getElementById("alertTeamFilter");
    const alertSearchInput = document.getElementById("alertSearchInput");
    const btnRefreshAlerts = document.getElementById("btnRefreshAlerts");

    // Modal elements
    const alertManageModal = document.getElementById("alertManageModal");
    const alertModalTitle = document.getElementById("alertModalTitle");
    const alertModalSevBadge = document.getElementById("alertModalSevBadge");
    const alertModalStatusBadge = document.getElementById("alertModalStatusBadge");
    const alertModalCloseBtn = document.getElementById("alertModalCloseBtn");
    const btnModalClose = document.getElementById("btnModalClose");

    // Severity Filter Buttons
    document.querySelectorAll("#alertSeverityFilter .pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#alertSeverityFilter .pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentAlertFilterSev = btn.dataset.sev;
            loadAlerts();
        });
    });

    if (alertStatusFilter) alertStatusFilter.addEventListener("change", () => loadAlerts());
    if (alertTeamFilter) alertTeamFilter.addEventListener("change", () => loadAlerts());
    if (alertSearchInput) alertSearchInput.addEventListener("input", debounce(() => loadAlerts(), 250));
    if (btnRefreshAlerts) {
        btnRefreshAlerts.addEventListener("click", () => {
            loadAlerts();
            showToast("info", "Alerts Refreshed", "Loaded latest incident records from SQLite.");
        });
    }

    async function loadAlerts() {
        const tbody = document.getElementById("alertsTableBody");
        let url = `/api/alerts?limit=50&severity=${currentAlertFilterSev}`;

        if (alertStatusFilter && alertStatusFilter.value !== "ALL") {
            url += `&status=${encodeURIComponent(alertStatusFilter.value)}`;
        }
        if (alertTeamFilter && alertTeamFilter.value !== "ALL") {
            url += `&team=${encodeURIComponent(alertTeamFilter.value)}`;
        }
        if (alertSearchInput && alertSearchInput.value.trim()) {
            url += `&search=${encodeURIComponent(alertSearchInput.value.trim())}`;
        }

        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            const alerts = data.alerts || [];
            const summary = data.summary || {};

            // Update Statistics Strip
            const alertStatTotal = document.getElementById("alertStatTotal");
            const alertStatCritical = document.getElementById("alertStatCritical");
            const alertStatWarning = document.getElementById("alertStatWarning");
            const alertStatInProgress = document.getElementById("alertStatInProgress");
            const alertStatResolved = document.getElementById("alertStatResolved");

            if (alertStatTotal) alertStatTotal.textContent = summary.total || alerts.length;
            if (alertStatCritical) alertStatCritical.textContent = summary.active_critical || 0;
            if (alertStatWarning) alertStatWarning.textContent = summary.active_warning || 0;
            if (alertStatInProgress) alertStatInProgress.textContent = summary.in_progress_alerts || 0;
            if (alertStatResolved) alertStatResolved.textContent = summary.resolved || 0;

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
                tbody.innerHTML = `<tr><td colspan="9" class="text-muted" style="text-align: center; padding: 24px;">No incident records matching filter criteria.</td></tr>`;
                return;
            }

            tbody.innerHTML = alerts.map(a => {
                const sevClass = a.severity === "CRITICAL" ? "badge-danger" : (a.severity === "WARNING" ? "badge-warning" : "badge-info");
                
                // Status badge styling
                let statusBadge = `<span class="badge badge-info">NEW</span>`;
                if (a.status === "ASSIGNED") statusBadge = `<span class="badge badge-peach">ASSIGNED</span>`;
                else if (a.status === "IN_PROGRESS") statusBadge = `<span class="badge badge-warning">IN PROGRESS</span>`;
                else if (a.status === "RESOLVED" || a.is_active === 0) statusBadge = `<span class="badge badge-success">RESOLVED</span>`;

                // Priority badge styling
                const prio = a.priority || "MEDIUM";
                const prioClass = prio === "CRITICAL" ? "badge-danger" : (prio === "HIGH" ? "badge-warning" : "badge-neutral");

                // Team assignment
                const assigneeDisplay = a.assigned_team 
                    ? `<strong>${escapeHtml(a.assigned_team)}</strong><br><small class="text-muted">${escapeHtml(a.assigned_person || "Unassigned lead")}</small>`
                    : `<span class="badge badge-neutral">Unassigned</span>`;

                const isDemo = a.is_demo === 1 || a.message.startsWith("[DEMO");
                const demoBadge = isDemo ? `<span class="demo-tag">DEMO</span>` : "";

                return `
                    <tr>
                        <td><strong>#${a.id}</strong></td>
                        <td><span class="badge ${sevClass}">${a.severity}</span></td>
                        <td><small>${a.source || "SIMULATION"}</small><br><strong>${escapeHtml(a.alert_type)}</strong></td>
                        <td>${demoBadge}${escapeHtml(a.message)}</td>
                        <td>${assigneeDisplay}</td>
                        <td><span class="badge ${prioClass}">${prio}</span></td>
                        <td><small>${a.last_seen_at || a.timestamp}</small></td>
                        <td>${statusBadge}</td>
                        <td>
                            <div style="display: flex; gap: 6px;">
                                <button class="btn btn-xs btn-primary btn-manage-alert" data-id="${a.id}">Manage</button>
                                ${a.acknowledged === 0 ? `<button class="btn btn-xs btn-outline btn-ack" data-id="${a.id}">Ack</button>` : ""}
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");

            // Attach Manage buttons to open modal
            tbody.querySelectorAll(".btn-manage-alert").forEach(btn => {
                btn.addEventListener("click", () => openAlertDetailsModal(btn.dataset.id));
            });

            // Attach Ack buttons
            tbody.querySelectorAll(".btn-ack").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.dataset.id;
                    try {
                        const ackResp = await fetch(`/api/alerts/${id}/acknowledge`, { method: "POST" });
                        if (ackResp.ok) {
                            showToast("success", "Alert Acknowledged", `Incident #${id} acknowledged.`);
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
                tbody.innerHTML = `<tr><td colspan="9" class="text-red" style="text-align: center; padding: 24px;">Error loading alerts from database.</td></tr>`;
            }
        }
    }

    // Modal Tabs Navigation
    const modalTabBtns = document.querySelectorAll(".modal-tab-btn");
    modalTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modalTabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const tabName = btn.dataset.tab;
            document.getElementById("tabContentOverview").style.display = tabName === "overview" ? "block" : "none";
            document.getElementById("tabContentAssign").style.display = tabName === "assign" ? "block" : "none";
            document.getElementById("tabContentAction").style.display = tabName === "action" ? "block" : "none";
            document.getElementById("tabContentResolve").style.display = tabName === "resolve" ? "block" : "none";
            document.getElementById("tabContentHistory").style.display = tabName === "history" ? "block" : "none";
        });
    });

    function closeAlertModal() {
        if (alertManageModal) alertManageModal.style.display = "none";
        state.activeAlertId = null;
    }

    if (alertModalCloseBtn) alertModalCloseBtn.addEventListener("click", closeAlertModal);
    if (btnModalClose) btnModalClose.addEventListener("click", closeAlertModal);

    // Escape key closes modal
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && alertManageModal && alertManageModal.style.display !== "none") {
            closeAlertModal();
        }
    });

    async function openAlertDetailsModal(alertId) {
        state.activeAlertId = alertId;
        if (!alertManageModal) return;

        alertManageModal.style.display = "flex";
        if (alertModalTitle) alertModalTitle.textContent = `Incident #${alertId} Details`;

        // Switch to overview tab by default
        modalTabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === "overview"));
        document.getElementById("tabContentOverview").style.display = "block";
        document.getElementById("tabContentAssign").style.display = "none";
        document.getElementById("tabContentAction").style.display = "none";
        document.getElementById("tabContentResolve").style.display = "none";
        document.getElementById("tabContentHistory").style.display = "none";

        try {
            const resp = await fetch(`/api/alerts/${alertId}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const alert = data.alert;
            state.currentAlertData = alert;

            // Badges
            if (alertModalSevBadge) {
                alertModalSevBadge.textContent = alert.severity;
                alertModalSevBadge.className = `badge ${alert.severity === "CRITICAL" ? "badge-danger" : "badge-warning"}`;
            }

            if (alertModalStatusBadge) {
                alertModalStatusBadge.textContent = alert.status || "NEW";
                let sClass = "badge-info";
                if (alert.status === "ASSIGNED") sClass = "badge-peach";
                else if (alert.status === "IN_PROGRESS") sClass = "badge-warning";
                else if (alert.status === "RESOLVED") sClass = "badge-success";
                alertModalStatusBadge.className = `badge ${sClass}`;
            }

            // Overview fields
            const modalAlertMessage = document.getElementById("modalAlertMessage");
            const modalAlertSource = document.getElementById("modalAlertSource");
            const modalAlertOccurrences = document.getElementById("modalAlertOccurrences");
            const modalAlertTimestamp = document.getElementById("modalAlertTimestamp");

            if (modalAlertMessage) modalAlertMessage.textContent = alert.message;
            if (modalAlertSource) modalAlertSource.textContent = `${alert.source} (${alert.alert_type})`;
            if (modalAlertOccurrences) modalAlertOccurrences.textContent = `${alert.occurrence_count || 1} times`;
            if (modalAlertTimestamp) modalAlertTimestamp.textContent = `${alert.timestamp} / ${alert.last_seen_at || "-"}`;

            // Snapshot Table
            const snapTbody = document.getElementById("modalSnapshotTableBody");
            if (snapTbody) {
                const snap = alert.reading_snapshot;
                if (snap && typeof snap === "object") {
                    snapTbody.innerHTML = `
                        <tr><td>Spindle Rotational Speed</td><td><strong>${Math.round(snap.rotational_speed || 0)} RPM</strong></td><td>1,500 RPM Nominal</td></tr>
                        <tr><td>Spindle Drive Torque</td><td><strong>${Number(snap.torque || 0).toFixed(1)} Nm</strong></td><td>55.0 Nm Max Continuous</td></tr>
                        <tr><td>Process Temperature</td><td><strong>${Number(snap.process_temperature_c || 35.4).toFixed(1)} °C</strong></td><td>40.0 °C Thermal Limit</td></tr>
                        <tr><td>Ambient Air Temperature</td><td><strong>${Number(snap.air_temperature_c || 25.0).toFixed(1)} °C</strong></td><td>30.0 °C Ambient Warning</td></tr>
                        <tr><td>Cutting Tool Wear</td><td><strong>${Math.round(snap.tool_wear || 0)} min</strong></td><td>200 min Critical Boundary</td></tr>
                        <tr><td>Vibration Amplitude</td><td><strong>${Number(snap.vibration || 1.48).toFixed(2)} mm/s</strong></td><td>3.20 mm/s ISO Alarm</td></tr>
                    `;
                } else {
                    snapTbody.innerHTML = `<tr><td colspan="3" class="text-muted">Telemetry snapshot unavailable.</td></tr>`;
                }
            }

            // Pre-fill Assign Form
            const assignTeamSelect = document.getElementById("assignTeamSelect");
            const assignPersonInput = document.getElementById("assignPersonInput");
            const assignPrioritySelect = document.getElementById("assignPrioritySelect");
            const assignNotesInput = document.getElementById("assignNotesInput");

            if (assignTeamSelect && alert.assigned_team) assignTeamSelect.value = alert.assigned_team;
            if (assignPersonInput && alert.assigned_person) assignPersonInput.value = alert.assigned_person;
            if (assignPrioritySelect && alert.priority) assignPrioritySelect.value = alert.priority;
            if (assignNotesInput && alert.assignment_notes) assignNotesInput.value = alert.assignment_notes;

            // Render Audit Trail History
            renderModalAuditHistory(alert.history || []);

        } catch (err) {
            console.error("Failed to load alert details:", err);
            showToast("error", "Error", "Failed to retrieve incident details from SQLite.");
        }
    }

    function renderModalAuditHistory(history) {
        const container = document.getElementById("modalHistoryTimeline");
        if (!container) return;

        if (!history || history.length === 0) {
            container.innerHTML = `<div class="text-muted">No audit trail events recorded yet.</div>`;
            return;
        }

        container.innerHTML = history.map(h => {
            let dotClass = "created";
            if (h.action_type === "ASSIGNED") dotClass = "assigned";
            else if (h.action_type === "ACTION_TAKEN") dotClass = "action";
            else if (h.action_type === "RESOLVED") dotClass = "resolved";

            return `
                <div class="timeline-event">
                    <div class="timeline-dot ${dotClass}"></div>
                    <div class="timeline-header">
                        <span class="badge ${dotClass === "resolved" ? "badge-success" : (dotClass === "action" ? "badge-danger" : "badge-info")}">${escapeHtml(h.action_type)}</span>
                        <span>${escapeHtml(h.performed_by || "Plant Lead")}</span>
                        <span class="timeline-time">${h.timestamp}</span>
                    </div>
                    <div class="timeline-body">
                        <div>${escapeHtml(h.details || "")}</div>
                        ${h.notes ? `<div style="font-size: 11.5px; color: var(--color-text-muted); margin-top: 2px;">Note: ${escapeHtml(h.notes)}</div>` : ""}
                    </div>
                </div>
            `;
        }).join("");
    }

    // Submit Assignment Form
    const formAlertAssign = document.getElementById("formAlertAssign");
    if (formAlertAssign) {
        formAlertAssign.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!state.activeAlertId) return;

            const payload = {
                assigned_team: document.getElementById("assignTeamSelect").value,
                assigned_person: document.getElementById("assignPersonInput").value.trim(),
                priority: document.getElementById("assignPrioritySelect").value,
                notes: document.getElementById("assignNotesInput").value.trim()
            };

            const btn = document.getElementById("btnSubmitAssign");
            btn.disabled = true;

            try {
                const resp = await fetch(`/api/alerts/${state.activeAlertId}/assign`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                showToast("success", "Team Assigned", `Incident #${state.activeAlertId} assigned to ${payload.assigned_team}.`);
                openAlertDetailsModal(state.activeAlertId);
                loadAlerts();

            } catch (err) {
                console.error("Assignment failed:", err);
                showToast("error", "Assignment Error", "Failed to persist assignment in SQLite.");
            } finally {
                btn.disabled = false;
            }
        });
    }

    // Submit Action Form
    const formAlertAction = document.getElementById("formAlertAction");
    if (formAlertAction) {
        formAlertAction.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!state.activeAlertId) return;

            const payload = {
                action_performed: document.getElementById("actionPerformedInput").value.trim(),
                diagnosis: document.getElementById("actionDiagnosisInput").value.trim(),
                performed_by: document.getElementById("actionTechInput").value.trim(),
                status_after: document.getElementById("actionStatusSelect").value,
                technician_notes: document.getElementById("actionNotesInput").value.trim()
            };

            const btn = document.getElementById("btnSubmitAction");
            btn.disabled = true;

            try {
                const resp = await fetch(`/api/alerts/${state.activeAlertId}/action`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                showToast("success", "Action Recorded", "Technician servicing action saved to SQLite audit log.");
                formAlertAction.reset();
                openAlertDetailsModal(state.activeAlertId);
                loadAlerts();

            } catch (err) {
                console.error("Recording action failed:", err);
                showToast("error", "Action Error", "Failed to log action in database.");
            } finally {
                btn.disabled = false;
            }
        });
    }

    // Submit Resolution Form
    const formAlertResolve = document.getElementById("formAlertResolve");
    if (formAlertResolve) {
        formAlertResolve.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!state.activeAlertId) return;

            const payload = {
                resolution_notes: document.getElementById("resolveNotesInput").value.trim(),
                resolution_category: document.getElementById("resolveCategorySelect").value,
                resolved_by: document.getElementById("resolveByInput").value.trim(),
                follow_up: document.getElementById("resolveFollowupInput").value.trim()
            };

            if (!payload.resolution_notes || !payload.resolved_by) {
                showToast("error", "Validation Error", "Resolution notes and signing technician name are required.");
                return;
            }

            const btn = document.getElementById("btnSubmitResolve");
            btn.disabled = true;

            try {
                const resp = await fetch(`/api/alerts/${state.activeAlertId}/resolve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                showToast("success", "Incident Resolved", `Incident #${state.activeAlertId} officially marked as RESOLVED.`);
                formAlertResolve.reset();
                openAlertDetailsModal(state.activeAlertId);
                loadAlerts();

            } catch (err) {
                console.error("Resolution failed:", err);
                showToast("error", "Resolution Error", "Failed to resolve incident in SQLite.");
            } finally {
                btn.disabled = false;
            }
        });
    }

    function renderOverviewAlerts(recent) {
        const container = document.getElementById("overviewAlertsList");
        if (!container) return;

        if (recent.length === 0) {
            container.innerHTML = `<div class="text-muted" style="text-align: center; padding: 16px 0;">No active critical alerts.</div>`;
            return;
        }

        container.innerHTML = recent.map(a => {
            const isDemo = a.is_demo === 1 || a.message.startsWith("[DEMO");
            const demoTag = isDemo ? `<span class="demo-tag">DEMO</span>` : "";

            return `
                <div class="feed-item">
                    <div>
                        <div style="font-weight: 700;">${demoTag}${escapeHtml(a.alert_type)} • <span class="badge ${a.severity === "CRITICAL" ? "badge-danger" : "badge-warning"}">${a.severity}</span></div>
                        <div style="color: var(--color-text-secondary); margin: 3px 0;">${escapeHtml(a.message)}</div>
                        <div style="font-size: 11px; color: var(--color-text-muted);">${a.last_seen_at || a.timestamp} • Status: ${a.status || "NEW"}</div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // =========================================================================
    // MAINTENANCE LOG & SERVICE RECORDS & CSV EXPORT
    // =========================================================================
    const maintSearchInput = document.getElementById("maintSearchInput");
    const maintTypeFilter = document.getElementById("maintTypeFilter");
    const maintModal = document.getElementById("maintModal");
    const btnOpenMaintModal = document.getElementById("btnOpenMaintModal");
    const maintModalClose = document.getElementById("maintModalClose");
    const btnCancelMaint = document.getElementById("btnCancelMaint");
    const maintForm = document.getElementById("maintForm");
    const btnSaveMaint = document.getElementById("btnSaveMaint");
    const maintBtnSpinner = document.getElementById("maintBtnSpinner");
    const maintBtnText = document.getElementById("maintBtnText");
    const btnExportCsv = document.getElementById("btnExportCsv");

    const maintTechName = document.getElementById("maintTechName");
    const maintDescription = document.getElementById("maintDescription");
    const maintNotes = document.getElementById("maintNotes");
    const techNameCount = document.getElementById("techNameCount");
    const descCount = document.getElementById("descCount");
    const notesCount = document.getElementById("notesCount");

    function updateMaintCharCounts() {
        if (maintTechName && techNameCount) {
            const len = maintTechName.value.length;
            techNameCount.textContent = `${len} / 100`;
            techNameCount.classList.toggle("limit-near", len >= 90);
        }
        if (maintDescription && descCount) {
            const len = maintDescription.value.length;
            descCount.textContent = `${len} / 500`;
            descCount.classList.toggle("limit-near", len >= 450);
        }
        if (maintNotes && notesCount) {
            const len = maintNotes.value.length;
            notesCount.textContent = `${len} / 500`;
            notesCount.classList.toggle("limit-near", len >= 450);
        }
    }

    if (maintTechName) maintTechName.addEventListener("input", updateMaintCharCounts);
    if (maintDescription) maintDescription.addEventListener("input", updateMaintCharCounts);
    if (maintNotes) maintNotes.addEventListener("input", updateMaintCharCounts);

    function openMaintModal() {
        if (!maintModal) return;
        maintModal.style.display = "flex";
        document.body.style.overflow = "hidden";
        updateMaintCharCounts();
        setTimeout(() => {
            if (maintTechName) maintTechName.focus();
        }, 50);
    }

    function closeMaintModal() {
        if (!maintModal) return;
        maintModal.style.display = "none";
        document.body.style.overflow = "";
        if (btnOpenMaintModal) btnOpenMaintModal.focus();
    }

    if (btnOpenMaintModal) {
        btnOpenMaintModal.addEventListener("click", openMaintModal);
    }

    if (maintModalClose) maintModalClose.addEventListener("click", closeMaintModal);
    if (btnCancelMaint) btnCancelMaint.addEventListener("click", closeMaintModal);

    // Outside click closes modal
    if (maintModal) {
        maintModal.addEventListener("click", (e) => {
            if (e.target === maintModal) {
                closeMaintModal();
            }
        });
    }

    // Escape key closes modal
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && maintModal && maintModal.style.display !== "none") {
            closeMaintModal();
        }
    });

    if (maintSearchInput) maintSearchInput.addEventListener("input", debounce(() => loadMaintenanceHistory(), 250));
    if (maintTypeFilter) maintTypeFilter.addEventListener("change", () => loadMaintenanceHistory());

    if (btnExportCsv) {
        btnExportCsv.addEventListener("click", () => {
            window.location.href = "/api/maintenance/export";
            showToast("info", "Export CSV", "Downloading SQLite maintenance records as CSV file.");
        });
    }

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
                tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align: center; padding: 24px;">No maintenance records found.</td></tr>`;
                return;
            }

            tbody.innerHTML = events.map(e => {
                const isDemo = e.is_demo === 1 || (e.description && e.description.startsWith("[DEMO"));
                const tag = isDemo ? `<span class="demo-tag">DEMO</span>` : `<span class="badge badge-success">USER</span>`;

                return `
                    <tr>
                        <td><strong>#${e.id}</strong></td>
                        <td><small>${e.performed_at || e.timestamp}</small></td>
                        <td>${escapeHtml(e.technician_name || "Plant Tech")}</td>
                        <td><span class="badge badge-info">${escapeHtml(e.action_type)}</span></td>
                        <td><strong>${escapeHtml(e.component)}</strong></td>
                        <td>${escapeHtml(e.description)}</td>
                        <td><small class="text-muted">${escapeHtml(e.notes || "-")}</small></td>
                        <td>${tag}</td>
                    </tr>
                `;
            }).join("");

        } catch (err) {
            console.error("Failed to load maintenance records:", err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-red" style="text-align: center; padding: 24px;">Error loading maintenance records.</td></tr>`;
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
                        <div style="font-weight: 700;">${tag}${escapeHtml(e.action_type)} • <strong>${escapeHtml(e.component)}</strong></div>
                        <div style="color: var(--color-text-secondary); margin: 3px 0;">${escapeHtml(e.description)}</div>
                        <div style="font-size: 11px; color: var(--color-text-muted);">${e.performed_at || e.timestamp} • Tech: ${escapeHtml(e.technician_name || "Engineer")}</div>
                    </div>
                </div>
            `;
        }).join("");
    }

    if (maintForm) {
        maintForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const techName = (document.getElementById("maintTechName")?.value || "").trim();
            const actionType = document.getElementById("maintActionType")?.value || "INSPECTION";
            const component = document.getElementById("maintComponent")?.value || "SPINDLE_BEARING";
            const desc = (document.getElementById("maintDescription")?.value || "").trim();
            const notes = (document.getElementById("maintNotes")?.value || "").trim();

            if (!techName || techName.length < 2) {
                showToast("warning", "Technician Required", "Technician name must be at least 2 characters.");
                document.getElementById("maintTechName")?.focus();
                return;
            }

            if (!desc || desc.length < 5) {
                showToast("warning", "Description Required", "Service description must be at least 5 characters.");
                document.getElementById("maintDescription")?.focus();
                return;
            }

            // Prevent duplicate submissions and show loading state
            if (btnSaveMaint) btnSaveMaint.disabled = true;
            if (maintBtnSpinner) maintBtnSpinner.style.display = "inline-block";
            if (maintBtnText) maintBtnText.textContent = "Saving to SQLite...";

            try {
                const resp = await fetch("/api/maintenance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        technician_name: techName,
                        action_type: actionType,
                        component: component,
                        description: desc,
                        notes: notes || null,
                        is_demo: 0
                    })
                });

                if (!resp.ok) {
                    let errMsg = `HTTP ${resp.status}`;
                    try {
                        const errData = await resp.json();
                        if (errData && errData.detail) {
                            if (Array.isArray(errData.detail)) {
                                errMsg = errData.detail.map(d => d.msg || d.loc?.join(".")).join("; ");
                            } else {
                                errMsg = String(errData.detail);
                            }
                        }
                    } catch (_) {}
                    throw new Error(errMsg);
                }

                const result = await resp.json();
                showToast("success", "Maintenance Recorded", result.message || "Service log entry persisted to SQLite database.");
                maintForm.reset();
                updateMaintCharCounts();
                closeMaintModal();
                loadMaintenanceHistory();

            } catch (err) {
                console.error("Failed to save maintenance record:", err);
                showToast("error", "Save Failed", err.message || "Failed to insert record into SQLite.");
            } finally {
                if (btnSaveMaint) btnSaveMaint.disabled = false;
                if (maintBtnSpinner) maintBtnSpinner.style.display = "none";
                if (maintBtnText) maintBtnText.textContent = "Save Maintenance Record";
            }
        });
    }

    // =========================================================================
    // MODEL PERFORMANCE METRICS (AI4I DATASET VALIDATION)
    // =========================================================================
    async function loadModelMetrics() {
        try {
            const resp = await fetch("/api/model/metrics");
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            const metrics = data.evaluation_metrics || {};
            const cm = data.confusion_matrix || {};
            const featImportances = data.feature_importances || data.feature_importance || {};

            const acc = metrics.accuracy !== undefined ? metrics.accuracy : 0.9790;
            const rec = metrics.recall_failure_class !== undefined ? metrics.recall_failure_class : 0.6029;
            const prec = metrics.precision_failure_class !== undefined ? metrics.precision_failure_class : 0.7321;
            const f1 = metrics.f1_score_failure_class !== undefined ? metrics.f1_score_failure_class : 0.6613;
            const rocAuc = metrics.roc_auc !== undefined ? metrics.roc_auc : 0.9590;

            const metricAccuracy = document.getElementById("metricAccuracy");
            const metricRecall = document.getElementById("metricRecall");
            const metricPrecision = document.getElementById("metricPrecision");
            const metricF1 = document.getElementById("metricF1");
            const metricRocAuc = document.getElementById("metricRocAuc");

            if (metricAccuracy) metricAccuracy.textContent = (acc * 100).toFixed(2) + "%";
            if (metricRecall) metricRecall.textContent = (rec * 100).toFixed(2) + "%";
            if (metricPrecision) metricPrecision.textContent = (prec * 100).toFixed(2) + "%";
            if (metricF1) metricF1.textContent = (f1 * 100).toFixed(2) + "%";
            if (metricRocAuc) metricRocAuc.textContent = rocAuc.toFixed(3);

            // Confusion Matrix
            let tn = cm.true_negatives_healthy_correct || (cm.matrix ? cm.matrix[0][0] : 1917);
            let fp = cm.false_positives_false_alarms || (cm.matrix ? cm.matrix[0][1] : 15);
            let fn = cm.false_negatives_missed_failures || (cm.matrix ? cm.matrix[1][0] : 27);
            let tp = cm.true_positives_failures_detected || (cm.matrix ? cm.matrix[1][1] : 41);

            const cmTN = document.getElementById("cmTN");
            const cmFP = document.getElementById("cmFP");
            const cmFN = document.getElementById("cmFN");
            const cmTP = document.getElementById("cmTP");

            if (cmTN) cmTN.textContent = Number(tn).toLocaleString();
            if (cmFP) cmFP.textContent = Number(fp).toLocaleString();
            if (cmFN) cmFN.textContent = Number(fn).toLocaleString();
            if (cmTP) cmTP.textContent = Number(tp).toLocaleString();

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
                                <strong class="text-orange">${(weight * 100).toFixed(1)}%</strong>
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
            "cat__Type_L": "Metallurgy: Type L (Low)",
            "cat__Type_M": "Metallurgy: Type M (Med)",
            "cat__Type_H": "Metallurgy: Type H (High)",
            "Type_L": "Metallurgy: Type L",
            "Type_M": "Metallurgy: Type M",
            "Type_H": "Metallurgy: Type H"
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

    console.log("[SmartTwin AI] Tropical Heat client controller initialized.");
});

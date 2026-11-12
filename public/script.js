/* ============================================
   NetGuard — JavaScript
   ============================================ */

console.log("NetGuard script loaded.");

// ===== ASSESSMENT FORM =====

const assessmentForm = document.getElementById("assessment-form");

if (assessmentForm) {
    assessmentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const totalQuestions = 10;
        const answers = {};
        const missing = [];

        for (let i = 1; i <= totalQuestions; i++) {
            const selected = document.querySelector(`input[name="q${i}"]:checked`);
            if (!selected) {
                missing.push(i);
            } else {
                answers[`q${i}`] = selected.value;
            }
        }

        if (missing.length > 0) {
            alert("Please answer all questions before submitting.");
            console.log("Missing questions:", missing);
            return;
        }

        const submitButton = assessmentForm.querySelector("button");
        submitButton.disabled = true;

        // The server scores the answers and saves the result
        fetch("/save-result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers })
        })
        .then(response => response.json().catch(() => ({})).then(data => {
            if (!response.ok) throw new Error(data.error || "Could not calculate your score. Please try again.");
            return data;
        }))
        .then(data => {
            showResults(data.riskLevel, data.checklist, data.score);
            showShareLink(data.id);
        })
        .catch(error => {
            console.error("Error saving to backend:", error);
            alert(error instanceof TypeError
                ? "Could not reach the server. Please check your connection and try again."
                : error.message);
        })
        .finally(() => {
            submitButton.disabled = false;
        });
    });
}

// ===== DISPLAY RESULTS =====

function showResults(riskLevel, checklist, safeAnswers) {
    const placeholder = document.getElementById("results-placeholder");
    const resultBox = document.getElementById("result-box");
    const riskLevelEl = document.getElementById("risk-level");
    const riskSummary = document.getElementById("risk-summary");
    const checklistEl = document.getElementById("checklist");

    // Hide placeholder, show result box
    placeholder.style.display = "none";
    resultBox.style.display = "block";

    // Set risk level text
    riskLevelEl.textContent = `Risk Level: ${riskLevel}`;
    riskLevelEl.className = "";
    riskLevelEl.classList.add(`risk-${riskLevel.toLowerCase()}`);

    // Set summary
    if (riskLevel === "Low") {
        riskSummary.textContent = `You scored ${safeAnswers}/10. Your Wi-Fi setup is fairly secure.`;
    } else if (riskLevel === "Medium") {
        riskSummary.textContent = `You scored ${safeAnswers}/10. Some settings could be improved.`;
    } else {
        riskSummary.textContent = `You scored ${safeAnswers}/10. Your network may be vulnerable.`;
    }

    // Build checklist
    checklistEl.innerHTML = "";
    if (checklist.length === 0) {
        checklistEl.innerHTML = "<li>Nothing to fix — your setup looks great!</li>";
    } else {
        checklist.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            checklistEl.appendChild(li);
        });
    }

    // Scroll to results
    resultBox.scrollIntoView({ behavior: "smooth" });
}

// ===== RESULT LINK (shown after the result is saved) =====

function showShareLink(id) {
    const shareBox = document.getElementById("share-box");
    const shareInput = document.getElementById("share-link");
    if (!shareBox || !shareInput || !id) return;

    shareInput.value = `${window.location.origin}/result?id=${encodeURIComponent(id)}`;
    shareBox.style.display = "block";
}

const copyLinkButton = document.getElementById("copy-link");
if (copyLinkButton) {
    copyLinkButton.addEventListener("click", function () {
        const shareInput = document.getElementById("share-link");
        const done = () => {
            copyLinkButton.textContent = "Copied!";
            setTimeout(() => { copyLinkButton.textContent = "Copy link"; }, 2000);
        };
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareInput.value).then(done).catch(() => shareInput.select());
        } else {
            shareInput.select(); // older browsers: select it so the user can copy
        }
    });
}

// ===== SAVED RESULT PAGE (/result?id=...) =====

const savedResult = document.getElementById("saved-result");
if (savedResult) {
    const id = new URLSearchParams(window.location.search).get("id");
    const statusEl = document.getElementById("saved-status");
    const summaries = {
        Low: "Your Wi-Fi setup is fairly secure.",
        Medium: "Some settings could be improved.",
        High: "Your network may be vulnerable."
    };

    const showError = message => {
        statusEl.textContent = message;
        statusEl.className = "error-text";
    };

    if (!id) {
        showError("No result link was given. Take the assessment to get your own link.");
    } else {
        fetch("/api/results/" + encodeURIComponent(id))
            .then(response => response.json().then(data => ({ ok: response.ok, data })))
            .then(({ ok, data }) => {
                if (!ok) return showError(data.error || "This result could not be found.");

                const levelEl = document.getElementById("saved-level");
                levelEl.textContent = `Risk Level: ${data.riskLevel}`;
                levelEl.className = `risk-${String(data.riskLevel).toLowerCase()}`;
                document.getElementById("saved-summary").textContent =
                    `You scored ${data.score}/${data.total}. ${summaries[data.riskLevel] || ""}`;
                document.getElementById("saved-date").textContent = `Taken on ${data.date}`;

                // checklist is null for results saved before answers were stored
                let items = data.checklist;
                if (items === null) items = ["This result was saved before NetGuard stored individual answers, so its checklist isn't available."];
                else if (items.length === 0) items = ["Nothing to fix — your setup looks great!"];

                const listEl = document.getElementById("saved-checklist");
                listEl.innerHTML = "";
                items.forEach(text => {
                    const li = document.createElement("li");
                    li.textContent = text;
                    listEl.appendChild(li);
                });

                statusEl.style.display = "none";
                savedResult.style.display = "block";
            })
            .catch(() => showError("Could not reach the server. Please try again."));
    }
}

// ===== CONTACT FORM =====

const contactForm = document.getElementById("contact-form");

if (contactForm) {
    contactForm.addEventListener("submit", function (event) {
        event.preventDefault();

        // 1. Collect the data
        const textInputs = contactForm.querySelectorAll('input[type="text"]');
        const name = textInputs[0] ? textInputs[0].value.trim() : "";
        const subject = textInputs[1] ? textInputs[1].value.trim() : "";
        const email = contactForm.querySelector('input[type="email"]').value.trim();
        const message = contactForm.querySelector("textarea").value.trim();

        if (!name || !email || !message) {
            alert("Please fill in all fields before sending.");
            return;
        }

        // 2. Package the data
        const contactData = { name, email, subject, message };
        const submitBtn = contactForm.querySelector("button");
        if (submitBtn) submitBtn.disabled = true;

        // 3. Send to backend
        fetch("/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(contactData)
        })
        .then(response => {
            return response.json().catch(() => ({})).then(data => {
                if (!response.ok) {
                    const err = new Error(data.error || "Server responded with " + response.status);
                    err.fromServer = Boolean(data.error);
                    throw err;
                }
                return data;
            });
        })
        .then(data => {
            // 4. Show success message
            const msg = document.getElementById("contact-message");
            if (msg) msg.style.display = "block";
            contactForm.reset();
            console.log("Server:", data.message);
        })
        .catch(error => {
            console.error("Contact form error:", error);
            alert(error.fromServer ? error.message : "Sorry, your message couldn't be sent. Please try again later.");
        })
        .finally(() => {
            if (submitBtn) submitBtn.disabled = false;
        });
    });
}

// ===== ADMIN DASHBOARD =====

function escapeHTML(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function adminFetch(url, options) {
    return fetch(url, options).then(response => {
        if (response.status === 401) {
            window.location.href = "/login";
            throw new Error("Not logged in");
        }
        if (!response.ok) throw new Error("Server responded with " + response.status);
        return response.json();
    });
}

const messagesContainer = document.getElementById("messages-container");
const resultsContainer = document.getElementById("results-container");
const statsContainer = document.getElementById("stats-container");

function loadMessages() {
    adminFetch("/api/messages").then(messages => {
        if (messages.length === 0) {
            messagesContainer.innerHTML = "<p>No messages yet.</p>";
            return;
        }
        let html = `<table><tr><th>Date</th><th>Name</th><th>Email</th><th>Message</th><th>Status</th><th>Actions</th></tr>`;
        messages.forEach(msg => {
            const resolved = msg.status === "resolved";
            const id = escapeHTML(msg.id);
            html += `<tr class="${resolved ? "row-resolved" : ""}">
                <td>${escapeHTML(msg.date || "—")}</td>
                <td>${escapeHTML(msg.name)}</td>
                <td>${escapeHTML(msg.email)}</td>
                <td>${escapeHTML(msg.message)}</td>
                <td>${resolved ? "Resolved" : "New"}</td>
                <td class="actions">
                    <button class="btn-small" data-action="toggle" data-id="${id}" data-status="${resolved ? "new" : "resolved"}">
                        ${resolved ? "Mark as new" : "Mark resolved"}
                    </button>
                    <button class="btn-small btn-danger" data-action="delete" data-id="${id}">Delete</button>
                </td>
            </tr>`;
        });
        html += "</table>";
        messagesContainer.innerHTML = html;
    }).catch(error => {
        if (error.message !== "Not logged in") messagesContainer.innerHTML = "<p>Could not load messages.</p>";
    });
}

if (messagesContainer) {
    loadMessages();
    messagesContainer.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const url = "/api/messages/" + encodeURIComponent(button.dataset.id);

        if (button.dataset.action === "delete") {
            if (!confirm("Delete this message?")) return;
            adminFetch(url, { method: "DELETE" }).then(loadMessages);
        }
        if (button.dataset.action === "toggle") {
            adminFetch(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: button.dataset.status })
            }).then(loadMessages);
        }
    });
}

// ----- Overview: stats cards and charts (numbers come from /api/stats) -----
const trendChart = document.getElementById("trend-chart");
const failedChart = document.getElementById("failed-chart");

// One floating tooltip shared by every chart mark with a data-tip attribute
// (admin dashboard only)
const chartTooltip = document.createElement("div");
chartTooltip.className = "chart-tooltip";
chartTooltip.setAttribute("role", "tooltip");

if (statsContainer) {
    document.body.appendChild(chartTooltip);
    document.addEventListener("mouseover", event => {
        const target = event.target.closest("[data-tip]");
        if (target) showChartTip(target); else hideChartTip();
    });
    document.addEventListener("focusin", event => {
        const target = event.target.closest("[data-tip]");
        if (target) showChartTip(target); else hideChartTip();
    });
    document.addEventListener("focusout", hideChartTip);
}

function showChartTip(target) {
    chartTooltip.textContent = target.dataset.tip;
    chartTooltip.style.display = "block";
    const box = target.getBoundingClientRect();
    const tipWidth = chartTooltip.offsetWidth;
    const left = Math.min(
        Math.max(8, box.left + box.width / 2 - tipWidth / 2),
        document.documentElement.clientWidth - tipWidth - 8
    );
    chartTooltip.style.left = `${left + window.scrollX}px`;
    chartTooltip.style.top = `${box.top + window.scrollY - chartTooltip.offsetHeight - 8}px`;
}
function hideChartTip() {
    chartTooltip.style.display = "none";
}

// "2026-11-09" -> Date at local midnight
function parseDay(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
}

// Column chart: assessments per day for the last 14 days
function renderTrendChart(days) {
    const total = days.reduce((sum, d) => sum + d.count, 0);
    const shortDate = key => parseDay(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    document.getElementById("trend-caption").textContent =
        `${shortDate(days[0].date)} – ${shortDate(days[days.length - 1].date)} · ${total} assessment${total === 1 ? "" : "s"}`;

    const max = Math.max(...days.map(d => d.count));
    const top = Math.max(1, max);
    const longDate = key => parseDay(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

    const columns = days.map(d => {
        const tip = `${longDate(d.date)}: ${d.count} assessment${d.count === 1 ? "" : "s"}`;
        const height = (d.count / top) * 100;
        // Label only the busiest day, so the chart stays uncluttered
        const label = d.count > 0 && d.count === max ? `<span class="trend-value">${d.count}</span>` : "";
        return `<div class="trend-col" tabindex="0" data-tip="${escapeHTML(tip)}" aria-label="${escapeHTML(tip)}">
                    ${label}<div class="trend-bar" style="height: ${height}%"></div>
                </div>`;
    }).join("");

    // Day-of-month under each bar (the caption above gives the months)
    const labels = days.map((d, i) =>
        `<span class="${i % 2 ? "trend-label-odd" : ""}">${parseDay(d.date).getDate()}</span>`
    ).join("");

    // Same numbers as a table for screen readers
    const tableRows = days.map(d => `<tr><td>${escapeHTML(longDate(d.date))}</td><td>${d.count}</td></tr>`).join("");

    trendChart.innerHTML = `
        <div class="trend-plot">
            <div class="trend-axis"><span>${top}</span><span>0</span></div>
            <div class="trend-area">
                <div class="trend-bars">${columns}</div>
                <div class="trend-labels" aria-hidden="true">${labels}</div>
            </div>
        </div>
        <table class="visually-hidden"><caption>Assessments per day, last 14 days</caption>
            <thead><tr><th>Day</th><th>Assessments</th></tr></thead><tbody>${tableRows}</tbody></table>`;
}

// Horizontal bars: the questions people most often answer unsafely
function renderFailedChart(questionStats) {
    const withData = questionStats.filter(q => q.answered > 0);
    if (withData.length === 0) {
        failedChart.innerHTML = '<p class="placeholder">No answers saved yet. This fills in as people take the assessment.</p>';
        return;
    }
    const top5 = withData.slice(0, 5);
    failedChart.innerHTML = `<ol class="hbar-list">${top5.map(q => {
        const tip = `${q.failed} of ${q.answered} answered unsafely (${q.failRate}%)`;
        return `<li class="hbar-row" tabindex="0" data-tip="${escapeHTML(tip)}">
            <span class="hbar-label">${escapeHTML(q.text)}</span>
            <span class="hbar-line">
                <span class="hbar-fill" style="width: ${q.failRate}%"></span>
                <span class="hbar-value">${q.failRate}%</span>
            </span>
        </li>`;
    }).join("")}</ol>`;
}

function loadStats() {
    if (!statsContainer) return;
    adminFetch("/api/stats").then(stats => {
        const a = stats.assessments;
        const card = (value, label, extraClass = "") =>
            `<div class="stat-card"><span class="stat-number ${extraClass}">${escapeHTML(value)}</span><span class="stat-label">${label}</span></div>`;

        statsContainer.innerHTML =
            card(a.total, "Assessments taken") +
            card(a.averagePercent === null ? "—" : `${a.averagePercent}%`, "Average score") +
            card(a.byLevel.Low, "Low risk", "risk-low") +
            card(a.byLevel.Medium, "Medium risk", "risk-medium") +
            card(a.byLevel.High, "High risk", "risk-high") +
            card(stats.messages.new, "New messages");

        if (trendChart) renderTrendChart(a.last14Days);
        if (failedChart) renderFailedChart(stats.questions);
    }).catch(error => {
        if (error.message !== "Not logged in") statsContainer.innerHTML = "<p>Could not load stats.</p>";
    });
}

loadStats();

if (resultsContainer) {
    adminFetch("/api/results").then(results => {
        if (results.length === 0) {
            resultsContainer.innerHTML = "<p>No assessments taken yet.</p>";
            return;
        }
        let html = "<table><tr><th>Date</th><th>Risk Level</th><th>Score</th></tr>";
        results.forEach(result => {
            const level = escapeHTML(result.riskLevel);
            html += `<tr><td>${escapeHTML(result.date)}</td><td class="risk-${level.toLowerCase()}">${level}</td><td>${escapeHTML(result.score)}/${escapeHTML(result.total || 10)}</td></tr>`;
        });
        html += "</table>";
        resultsContainer.innerHTML = html;
    }).catch(error => {
        if (error.message !== "Not logged in") resultsContainer.innerHTML = "<p>Could not load results.</p>";
    });
}

const logoutButton = document.getElementById("logout-button");
if (logoutButton) {
    logoutButton.addEventListener("click", function () {
        fetch("/logout", { method: "POST" }).finally(() => { window.location.href = "/login"; });
    });
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const password = document.getElementById("admin-password").value;
        const errorText = document.getElementById("login-error");
        errorText.style.display = "none";

        fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password })
        }).then(response => {
            if (response.ok) window.location.href = "/admin";
            else {
                errorText.textContent = "Wrong password. Please try again.";
                errorText.style.display = "block";
            }
        });
    });
}

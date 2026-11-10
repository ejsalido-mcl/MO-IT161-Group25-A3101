/* ============================================
   NetGuard — JavaScript
   ============================================ */

console.log("NetGuard script loaded.");

// ===== THEME (applied right away so the page doesn't flash) =====

const THEME_KEY = "netguard_theme";

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-bs-theme", theme);
}

(function loadSavedTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* storage blocked */ }
    applyTheme(saved === "dark" ? "dark" : "light");
})();

// ===== TOAST NOTIFICATIONS =====
// Uses Bootstrap's Toast when Bootstrap is loaded on the page.
// Pages without Bootstrap simply skip the toast (inline messages still work).

function showToast(message, type = "success") {
    if (!window.bootstrap || !window.bootstrap.Toast) return;

    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container position-fixed bottom-0 end-0 p-3";
        document.body.appendChild(container);
    }

    const toastEl = document.createElement("div");
    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    toastEl.setAttribute("role", type === "danger" ? "alert" : "status");
    toastEl.setAttribute("aria-live", type === "danger" ? "assertive" : "polite");
    toastEl.setAttribute("aria-atomic", "true");

    const row = document.createElement("div");
    row.className = "d-flex";

    const body = document.createElement("div");
    body.className = "toast-body";
    body.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn-close btn-close-white me-2 m-auto";
    closeBtn.setAttribute("data-bs-dismiss", "toast");
    closeBtn.setAttribute("aria-label", "Close");

    row.appendChild(body);
    row.appendChild(closeBtn);
    toastEl.appendChild(row);
    container.appendChild(toastEl);

    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
    new window.bootstrap.Toast(toastEl, { delay: 4000 }).show();
}

// ===== ASSESSMENT FORM =====

const assessmentForm = document.getElementById("assessment-form");
const TOTAL_QUESTIONS = 10;
let lastResult = null;

// How many of the 10 questions have an answer right now
function countAnswered() {
    let answered = 0;
    for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
        if (document.querySelector(`input[name="q${i}"]:checked`)) answered++;
    }
    return answered;
}

// Live progress bar, counter, answered/unanswered cards and the submit button
function updateProgress() {
    if (!assessmentForm) return;

    const answered = countAnswered();
    const remaining = TOTAL_QUESTIONS - answered;
    const percent = Math.round((answered / TOTAL_QUESTIONS) * 100);

    const progress = document.getElementById("progress");
    const bar = document.getElementById("progress-bar");
    const text = document.getElementById("progress-text");
    const percentText = document.getElementById("progress-percent");
    const submitBtn = document.getElementById("submit-btn");

    if (bar) bar.style.width = percent + "%";
    if (progress) {
        progress.setAttribute("aria-valuenow", String(percent));
        progress.classList.toggle("is-complete", remaining === 0);
    }
    if (text) text.textContent = `${answered} of ${TOTAL_QUESTIONS} answered`;
    if (percentText) percentText.textContent = percent + "%";

    if (submitBtn) {
        submitBtn.disabled = remaining > 0;
        submitBtn.textContent = remaining > 0
            ? `Answer ${remaining} more question${remaining === 1 ? "" : "s"}`
            : "Calculate My Risk Score";
    }

    // Mark each question card as answered / not answered yet
    assessmentForm.querySelectorAll(".question").forEach((card) => {
        const firstRadio = card.querySelector('input[type="radio"]');
        if (!firstRadio) return;
        const isAnswered = !!assessmentForm.querySelector(`input[name="${firstRadio.name}"]:checked`);
        card.classList.toggle("answered", isAnswered);
        if (isAnswered) card.classList.remove("is-missing");
    });
}

if (assessmentForm) {
    // Update the progress every time an answer changes
    assessmentForm.addEventListener("change", updateProgress);

    assessmentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        let answered = 0;
        let missing = [];
        let safeAnswers = 0;

        const safeYesQuestions = [1, 4, 5, 6, 7, 8, 9, 10];
        const safeNoQuestions = [2, 3];

        for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
            const selected = document.querySelector(`input[name="q${i}"]:checked`);
            if (!selected) {
                missing.push(i);
            } else {
                answered++;
            }
        }

        if (answered < TOTAL_QUESTIONS) {
            // Highlight the cards that still need an answer and jump to the first one
            missing.forEach((n) => {
                const input = assessmentForm.querySelector(`input[name="q${n}"]`);
                const card = input ? input.closest(".question") : null;
                if (card) card.classList.add("is-missing");
            });
            const firstMissing = assessmentForm.querySelector(".question.is-missing");
            if (firstMissing) firstMissing.scrollIntoView({ behavior: "smooth", block: "center" });
            showToast("Please answer all questions before submitting.", "danger");
            console.log("Missing questions:", missing);
            return;
        }

        safeYesQuestions.forEach((q) => {
            const selected = document.querySelector(`input[name="q${q}"]:checked`);
            if (selected && selected.value === "yes") safeAnswers++;
        });

        safeNoQuestions.forEach((q) => {
            const selected = document.querySelector(`input[name="q${q}"]:checked`);
            if (selected && selected.value === "no") safeAnswers++;
        });

        // Determine risk level
        let riskLevel;
        if (safeAnswers >= 8) {
            riskLevel = "Low";
        } else if (safeAnswers >= 5) {
            riskLevel = "Medium";
        } else {
            riskLevel = "High";
        }

        // Build checklist based on unsafe answers
        const checklist = [];

        if (!isSafe(1, "yes")) checklist.push("Use a stronger, unique Wi-Fi password.");
        if (!isSafe(2, "no")) checklist.push("Limit who knows your Wi-Fi password.");
        if (!isSafe(3, "no")) checklist.push("Change your router's default admin password.");
        if (!isSafe(4, "yes")) checklist.push("Update your router's firmware regularly.");
        if (!isSafe(5, "yes")) checklist.push("Enable WPA2 or WPA3 encryption.");
        if (!isSafe(6, "yes")) checklist.push("Consider hiding your Wi-Fi network name (SSID).");
        if (!isSafe(7, "yes")) checklist.push("Set up a separate guest network for visitors.");
        if (!isSafe(8, "yes")) checklist.push("Regularly check who is connected to your network.");
        if (!isSafe(9, "yes")) checklist.push("Place your router in a secure location.");
        if (!isSafe(10, "yes")) checklist.push("Enable a firewall on your network.");

        // Remember this result for the Download / Print buttons
        lastResult = { riskLevel, score: safeAnswers, checklist, date: new Date().toISOString() };

        // Show results
        showResults(riskLevel, checklist, safeAnswers);

        // Save to this browser's history (no personal answers, only level + score)
        try {
            NetGuardStorage.saveAssessment({ riskLevel: riskLevel, score: safeAnswers });
            renderHistory();
            showToast("Result saved to your history on this device.", "success");
        } catch (error) {
            console.error("Could not save history:", error);
        }

        // --- Send results to backend ---
        const resultData = {
            riskLevel: riskLevel,
            score: safeAnswers
        };

        fetch("/save-result", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(resultData)
        })
        .then(response => response.json())
        .then(data => {
            console.log("Backend says:", data.message);
        })
        .catch(error => {
            console.error("Error saving to backend:", error);
        });
    });
}

// ===== HELPER: Check if a question was answered safely =====

function isSafe(questionNumber, safeValue) {
    const selected = document.querySelector(`input[name="q${questionNumber}"]:checked`);
    return selected && selected.value === safeValue;
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

    // Animated score meter (colored by risk level)
    const scoreMeter = document.getElementById("score-meter");
    const scoreBar = document.getElementById("score-bar");
    if (scoreMeter && scoreBar) {
        scoreMeter.className = `progress score-meter score-${riskLevel.toLowerCase()}`;
        scoreMeter.setAttribute("aria-label", `Score ${safeAnswers} out of 10`);
        scoreBar.style.width = "0%";
        requestAnimationFrame(() => requestAnimationFrame(() => {
            scoreBar.style.width = `${safeAnswers * 10}%`;
        }));
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

// ===== CONTACT FORM =====

const contactForm = document.getElementById("contact-form");
const MESSAGE_MAX_LENGTH = 500;
let contactSending = false;

// One rule per required field: returns an error message, or "" when the value is fine
const CONTACT_RULES = {
    "contact-name": (value) =>
        value.length >= 2 ? "" : "Please enter your name (at least 2 characters).",
    "contact-email": (value) => {
        if (!value) return "Please enter your email address.";
        return NetGuardValidator.validateEmail(value) ? "" : "Please enter a valid email, like name@example.com.";
    },
    "contact-text": (value) =>
        value.length >= 10 ? "" : "Please write at least 10 characters so we can help you."
};

// Checks one field. Only touches the screen (red/green border + message) when showError is true.
function validateContactField(input, showError) {
    const rule = CONTACT_RULES[input.id];
    if (!rule) return true;

    const message = rule(input.value.trim());
    if (showError) {
        input.classList.toggle("is-invalid", message !== "");
        input.classList.toggle("is-valid", message === "");
        input.setAttribute("aria-invalid", message !== "" ? "true" : "false");
        const errorEl = document.getElementById(`${input.id}-error`);
        if (errorEl) errorEl.textContent = message;
    }
    return message === "";
}

// The Send button is only enabled when every required field is valid
function updateContactState() {
    if (!contactForm) return;
    const submitBtn = document.getElementById("contact-submit");
    const allValid = Object.keys(CONTACT_RULES).every((id) => {
        const input = document.getElementById(id);
        return !input || validateContactField(input, false);
    });
    if (submitBtn) submitBtn.disabled = !allValid || contactSending;
}

// Live "123 / 500" counter under the message box
function updateCharCount() {
    const textarea = document.getElementById("contact-text");
    const counter = document.getElementById("char-count");
    if (!textarea || !counter) return;
    const length = textarea.value.length;
    counter.textContent = `${length} / ${MESSAGE_MAX_LENGTH}`;
    counter.classList.toggle("near-limit", length >= MESSAGE_MAX_LENGTH * 0.9);
}

function resetContactForm() {
    contactForm.reset();
    contactForm.querySelectorAll("input, textarea").forEach((field) => {
        field.classList.remove("is-invalid", "is-valid");
        field.removeAttribute("aria-invalid");
        delete field.dataset.touched;
    });
    contactForm.querySelectorAll(".field-error").forEach((el) => { el.textContent = ""; });
    updateCharCount();
}

if (contactForm) {
    // Live validation: show errors after the person leaves a field, then keep them updated while typing
    Object.keys(CONTACT_RULES).forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;

        input.addEventListener("blur", () => {
            input.dataset.touched = "true";
            validateContactField(input, true);
            updateContactState();
        });

        input.addEventListener("input", () => {
            if (input.dataset.touched === "true") validateContactField(input, true);
            updateContactState();
        });
    });

    const messageBox = document.getElementById("contact-text");
    if (messageBox) messageBox.addEventListener("input", updateCharCount);

    // Typing again hides the old success / error message
    contactForm.addEventListener("input", () => {
        const successEl = document.getElementById("contact-message");
        const errorEl = document.getElementById("contact-error");
        if (successEl) successEl.style.display = "none";
        if (errorEl) errorEl.style.display = "none";
    });

    contactForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (contactSending) return;

        // 1. Show every error at once and jump to the first one
        let firstInvalid = null;
        Object.keys(CONTACT_RULES).forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.dataset.touched = "true";
            if (!validateContactField(input, true) && !firstInvalid) firstInvalid = input;
        });
        if (firstInvalid) {
            firstInvalid.focus();
            return;
        }

        // 2. Package the data
        const contactData = {
            name: document.getElementById("contact-name").value.trim(),
            email: document.getElementById("contact-email").value.trim(),
            subject: document.getElementById("contact-subject").value.trim(),
            message: document.getElementById("contact-text").value.trim()
        };

        const submitBtn = document.getElementById("contact-submit");
        const errorEl = document.getElementById("contact-error");
        const successEl = document.getElementById("contact-message");
        if (errorEl) errorEl.style.display = "none";

        contactSending = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Sending...";
        }

        // 3. Send to backend
        fetch("/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(contactData)
        })
        .then(response => {
            if (!response.ok) throw new Error("Server responded with " + response.status);
            return response.json();
        })
        .then(data => {
            // 4. Show success message
            if (successEl) successEl.style.display = "block";
            resetContactForm();
            showToast("Message sent! We'll get back to you within 24 hours.", "success");
            console.log("Server:", data.message);
        })
        .catch(error => {
            console.error("Contact form error:", error);
            if (errorEl) {
                errorEl.textContent = "Sorry, your message couldn't be sent. Please try again later.";
                errorEl.style.display = "block";
            }
            showToast("Your message couldn't be sent. Please try again later.", "danger");
        })
        .finally(() => {
            contactSending = false;
            if (submitBtn) submitBtn.textContent = "Send Message";
            updateContactState();
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

function showStats(results) {
    if (!statsContainer) return;
    const total = results.length;
    const average = total ? (results.reduce((sum, r) => sum + Number(r.score || 0), 0) / total).toFixed(1) + "/10" : "—";
    const count = level => results.filter(r => r.riskLevel === level).length;

    statsContainer.innerHTML = `
        <div class="stat-card"><span class="stat-number">${total}</span><span class="stat-label">Assessments taken</span></div>
        <div class="stat-card"><span class="stat-number">${average}</span><span class="stat-label">Average score</span></div>
        <div class="stat-card"><span class="stat-number risk-low">${count("Low")}</span><span class="stat-label">Low risk</span></div>
        <div class="stat-card"><span class="stat-number risk-medium">${count("Medium")}</span><span class="stat-label">Medium risk</span></div>
        <div class="stat-card"><span class="stat-number risk-high">${count("High")}</span><span class="stat-label">High risk</span></div>
    `;
}

if (resultsContainer) {
    adminFetch("/api/results").then(results => {
        showStats(results);
        if (results.length === 0) {
            resultsContainer.innerHTML = "<p>No assessments taken yet.</p>";
            return;
        }
        let html = "<table><tr><th>Date</th><th>Risk Level</th><th>Score</th></tr>";
        results.forEach(result => {
            const level = escapeHTML(result.riskLevel);
            html += `<tr><td>${escapeHTML(result.date)}</td><td class="risk-${level.toLowerCase()}">${level}</td><td>${escapeHTML(result.score)}/10</td></tr>`;
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
// ==========================================
// ADVANCED METHODS: Validation & Caching System
// ==========================================
const NetGuardValidator = {
    validateEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(String(email).toLowerCase());
    },
    sanitizeInput: (str) => {
        return str.replace(/[&<>"']/g, (match) => {
            const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return escapeMap[match];
        });
    }
};

const NetGuardStorage = {
    STORAGE_KEY: 'netguard_assessment_history',
    saveAssessment: (scoreData) => {
        const history = NetGuardStorage.getHistory();
        const newRecord = { id: Date.now(), date: new Date().toISOString(), ...scoreData };
        history.unshift(newRecord);
        localStorage.setItem(NetGuardStorage.STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
        return newRecord;
    },
    getHistory: () => {
        const raw = localStorage.getItem(NetGuardStorage.STORAGE_KEY);
        try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
    },
    calculateAverageRiskScore: () => {
        const history = NetGuardStorage.getHistory();
        if (history.length === 0) return 0;
        const total = history.reduce((sum, item) => sum + (item.score || 0), 0);
        return (total / history.length).toFixed(1);
    }
};

// ==========================================
// REACTIVE UI: history, download/print/retake, header controls
// ==========================================

// ----- Assessment history (stored in this browser with NetGuardStorage) -----

function renderHistory() {
    const section = document.getElementById("history-section");
    const body = document.getElementById("history-body");
    if (!section || !body) return;

    const history = NetGuardStorage.getHistory();
    section.style.display = history.length ? "" : "none";
    body.innerHTML = "";

    history.forEach((item) => {
        const level = String(item.riskLevel || "").toLowerCase();
        const row = document.createElement("tr");

        const dateCell = document.createElement("td");
        dateCell.textContent = new Date(item.date).toLocaleString();

        const levelCell = document.createElement("td");
        levelCell.textContent = item.riskLevel;
        if (["low", "medium", "high"].includes(level)) levelCell.className = `risk-${level}`;

        const scoreCell = document.createElement("td");
        scoreCell.textContent = `${item.score}/10`;

        row.appendChild(dateCell);
        row.appendChild(levelCell);
        row.appendChild(scoreCell);
        body.appendChild(row);
    });

    const summary = document.getElementById("history-average");
    if (summary && history.length) {
        summary.textContent =
            `Average score: ${NetGuardStorage.calculateAverageRiskScore()}/10 across your last ${history.length} assessment${history.length === 1 ? "" : "s"}.`;
    }
}

function clearHistory() {
    if (!confirm("Clear your saved assessment history on this device?")) return;
    try { localStorage.removeItem(NetGuardStorage.STORAGE_KEY); } catch (e) { /* storage blocked */ }
    renderHistory();
    showToast("History cleared.", "dark");
}

// ----- Result buttons: download, print, retake -----

function downloadChecklist() {
    if (!lastResult) return;

    const lines = [
        "NetGuard - Wi-Fi Security Checklist",
        `Date: ${new Date(lastResult.date).toLocaleString()}`,
        `Risk level: ${lastResult.riskLevel}`,
        `Score: ${lastResult.score}/10`,
        ""
    ];

    if (lastResult.checklist.length === 0) {
        lines.push("Nothing to fix - your setup looks great!");
    } else {
        lines.push("Recommended fixes:");
        lastResult.checklist.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `netguard-checklist-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("Checklist downloaded.", "success");
}

function resetAssessment() {
    assessmentForm.reset();
    updateProgress();
    lastResult = null;

    document.getElementById("result-box").style.display = "none";
    document.getElementById("results-placeholder").style.display = "";

    const section = document.getElementById("assessment-section");
    if (section) section.scrollIntoView({ behavior: "smooth" });
}

// ----- Header: dark mode toggle + mobile menu button (added on every page) -----

const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICON_MOON = `<svg ${ICON_ATTRS}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const ICON_SUN = `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
const ICON_MENU = `<svg ${ICON_ATTRS}><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;
const ICON_CLOSE = `<svg ${ICON_ATTRS}><path d="M6 6l12 12M18 6L6 18"/></svg>`;

function initHeaderControls() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    // --- Dark mode toggle ---
    const themeBtn = document.createElement("button");
    themeBtn.type = "button";
    themeBtn.className = "icon-btn theme-toggle";

    function refreshThemeButton() {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        const label = dark ? "Switch to light mode" : "Switch to dark mode";
        themeBtn.innerHTML = dark ? ICON_SUN : ICON_MOON;
        themeBtn.setAttribute("aria-label", label);
        themeBtn.title = label;
    }

    themeBtn.addEventListener("click", () => {
        const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage blocked */ }
        refreshThemeButton();
    });

    refreshThemeButton();
    header.appendChild(themeBtn);

    // --- Mobile menu (hamburger) ---
    const nav = header.querySelector("nav");
    if (!nav) return;
    if (!nav.id) nav.id = "site-nav";

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "icon-btn nav-toggle";
    menuBtn.setAttribute("aria-controls", nav.id);
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Open menu");
    menuBtn.innerHTML = ICON_MENU;

    function setMenu(open) {
        header.classList.toggle("nav-open", open);
        menuBtn.setAttribute("aria-expanded", String(open));
        menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        menuBtn.innerHTML = open ? ICON_CLOSE : ICON_MENU;
    }

    menuBtn.addEventListener("click", () => setMenu(!header.classList.contains("nav-open")));
    nav.addEventListener("click", (event) => { if (event.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && header.classList.contains("nav-open")) setMenu(false);
    });

    // Close the menu if the window grows back to desktop size
    const desktopQuery = window.matchMedia("(min-width: 761px)");
    if (desktopQuery.addEventListener) {
        desktopQuery.addEventListener("change", (event) => { if (event.matches) setMenu(false); });
    }

    header.appendChild(menuBtn);
    header.classList.add("has-nav-toggle");
}

// ----- Start everything -----

(function initUI() {
    initHeaderControls();

    // Always print in light mode, then go back to the chosen theme
    let themeBeforePrint = null;
    window.addEventListener("beforeprint", () => {
        themeBeforePrint = document.documentElement.getAttribute("data-theme");
        applyTheme("light");
    });
    window.addEventListener("afterprint", () => {
        if (themeBeforePrint) applyTheme(themeBeforePrint);
        themeBeforePrint = null;
    });

    if (assessmentForm) {
        updateProgress();
        renderHistory();

        const downloadBtn = document.getElementById("download-btn");
        const printBtn = document.getElementById("print-btn");
        const retakeBtn = document.getElementById("retake-btn");
        const clearBtn = document.getElementById("clear-history");

        if (downloadBtn) downloadBtn.addEventListener("click", downloadChecklist);
        if (printBtn) printBtn.addEventListener("click", () => window.print());
        if (retakeBtn) retakeBtn.addEventListener("click", resetAssessment);
        if (clearBtn) clearBtn.addEventListener("click", clearHistory);
    }

    if (contactForm) {
        updateCharCount();
        updateContactState();
    }
})();
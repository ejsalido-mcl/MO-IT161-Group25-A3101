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
        let answered = 0;
        let missing = [];
        let safeAnswers = 0;

        const safeYesQuestions = [1, 4, 5, 6, 7, 8, 9, 10];
        const safeNoQuestions = [2, 3];

        for (let i = 1; i <= totalQuestions; i++) {
            const selected = document.querySelector(`input[name="q${i}"]:checked`);
            if (!selected) {
                missing.push(i);
            } else {
                answered++;
            }
        }

        if (answered < totalQuestions) {
            alert("Please answer all questions before submitting.");
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

        // Show results
        showResults(riskLevel, checklist, safeAnswers);

        // --- NEW: Send results to backend ---
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
            if (!response.ok) throw new Error("Server responded with " + response.status);
            return response.json();
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
            alert("Sorry, your message couldn't be sent. Please try again later.");
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

/* ============================================
   NetGuard — JavaScript
   ============================================ */

console.log("NetGuard script loaded.");

// ===== ASSESSMENT FORM =====

const assessmentForm = document.querySelector("form");

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

// Escape text before putting it in the page, so a message containing
// HTML or <script> tags is shown as plain text instead of running.
function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// 1. Load Messages
const messagesContainer = document.getElementById("messages-container");

if (messagesContainer) {
    fetch("/api/messages")
        .then(response => response.json())
        .then(messages => {
            if (messages.length === 0) {
                messagesContainer.innerHTML = "<p>No messages yet.</p>";
                return;
            }

            let html = "<table><tr><th>Date</th><th>Name</th><th>Email</th><th>Subject</th><th>Message</th></tr>";
            messages.forEach(msg => {
                html += `<tr>
                            <td>${escapeHTML(msg.date || "—")}</td>
                            <td>${escapeHTML(msg.name)}</td>
                            <td>${escapeHTML(msg.email)}</td>
                            <td>${escapeHTML(msg.subject || "—")}</td>
                            <td>${escapeHTML(msg.message)}</td>
                         </tr>`;
            });
            html += "</table>";
            messagesContainer.innerHTML = html;
        })
        .catch(error => {
            console.error("Error loading messages:", error);
            messagesContainer.innerHTML = "<p>Could not load messages. Is the server running?</p>";
        });
}

// 2. Load Assessment Results
const resultsContainer = document.getElementById("results-container");

if (resultsContainer) {
    fetch("/api/results")
        .then(response => response.json())
        .then(results => {
            if (results.length === 0) {
                resultsContainer.innerHTML = "<p>No assessments taken yet.</p>";
                return;
            }

            let html = "<table><tr><th>Date</th><th>Risk Level</th><th>Score</th></tr>";
            results.forEach(result => {
                const level = escapeHTML(result.riskLevel);
                html += `<tr>
                            <td>${escapeHTML(result.date)}</td>
                            <td class="risk-${level.toLowerCase()}">${level}</td>
                            <td>${escapeHTML(result.score)}/10</td>
                         </tr>`;
            });
            html += "</table>";
            resultsContainer.innerHTML = html;
        })
        .catch(error => {
            console.error("Error loading results:", error);
            resultsContainer.innerHTML = "<p>Could not load results. Is the server running?</p>";
        });
}

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
            if (data.id) showShareLink(data.id);
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
        checklistEl.innerHTML = '<li class="list-group-item">Nothing to fix — your setup looks great!</li>';
    } else {
        checklist.forEach((item) => {
            const li = document.createElement("li");
            li.className = "list-group-item";
            li.textContent = item;
            checklistEl.appendChild(li);
        });
    }

    // Hide any link from a previous attempt until the new one is saved
    const shareBox = document.getElementById("share-box");
    if (shareBox) shareBox.style.display = "none";

    // Scroll to results
    resultBox.scrollIntoView({ behavior: "smooth" });
}

// ===== RESULT LINK (shown after the result is saved) =====

function showShareLink(id) {
    const shareBox = document.getElementById("share-box");
    const shareInput = document.getElementById("share-link");
    if (!shareBox || !shareInput) return;

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

    const showError = message => {
        statusEl.textContent = message;
        statusEl.className = "alert alert-warning";
    };

    if (!id) {
        showError("No result link was given. Take the assessment to get your own link.");
    } else {
        fetch("/api/results/" + encodeURIComponent(id))
            .then(response => response.json().then(data => ({ ok: response.ok, data })))
            .then(({ ok, data }) => {
                if (!ok) return showError(data.error || "This result could not be found.");

                const level = data.riskLevel;
                const levelEl = document.getElementById("saved-level");
                levelEl.textContent = `Risk Level: ${level}`;
                levelEl.className = `risk-${level.toLowerCase()}`;

                const summaries = {
                    Low: "Your Wi-Fi setup is fairly secure.",
                    Medium: "Some settings could be improved.",
                    High: "Your network may be vulnerable."
                };
                document.getElementById("saved-summary").textContent =
                    `You scored ${data.score}/10. ${summaries[level] || ""}`;
                document.getElementById("saved-date").textContent = `Taken on ${data.date}`;

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
        return response.json().catch(() => ({})).then(data => {
            if (!response.ok) throw new Error(data.error || "Server responded with " + response.status);
            return data;
        });
    });
}

const PAGE_SIZE = 10;

// "Showing 11–20 of 34" plus Previous / page numbers / Next
function renderPager(pagerEl, data, goToPage) {
    if (data.total === 0) {
        pagerEl.innerHTML = "";
        return;
    }
    const first = (data.page - 1) * data.limit + 1;
    const last = Math.min(data.page * data.limit, data.total);
    let html = `<div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
        <span class="small text-body-secondary">Showing ${first}–${last} of ${data.total}</span>`;

    if (data.totalPages > 1) {
        const button = (page, label, { disabled = false, active = false } = {}) => `
            <li class="page-item${disabled ? " disabled" : ""}${active ? " active" : ""}">
                <button type="button" class="page-link" data-page="${page}"${disabled ? " disabled" : ""}${active ? ' aria-current="page"' : ""}>${label}</button>
            </li>`;
        const gap = '<li class="page-item disabled"><span class="page-link">…</span></li>';

        html += '<nav aria-label="Pages"><ul class="pagination pagination-sm mb-0">';
        html += button(data.page - 1, "Previous", { disabled: data.page === 1 });
        // Always show the first and last page, plus two pages either side of the current one
        for (let p = 1; p <= data.totalPages; p++) {
            const nearCurrent = Math.abs(p - data.page) <= 2;
            if (p === 1 || p === data.totalPages || nearCurrent) {
                html += button(p, p, { active: p === data.page });
            } else if (p === data.page - 3 || p === data.page + 3) {
                html += gap;
            }
        }
        html += button(data.page + 1, "Next", { disabled: data.page === data.totalPages });
        html += "</ul></nav>";
    }
    pagerEl.innerHTML = html + "</div>";
    pagerEl.onclick = event => {
        const target = event.target.closest("button[data-page]");
        if (target && !target.disabled) goToPage(Number(target.dataset.page));
    };
}

// Wires one admin table to its filter form, pager and Export CSV link.
// Returns { reload } so other code can refresh it after a change.
function setupAdminList({ endpoint, form, container, pager, exportLink, renderRows, emptyText, noMatchText }) {
    let page = 1;

    function filterParams() {
        const params = new URLSearchParams();
        new FormData(form).forEach((value, key) => {
            const text = String(value).trim();
            if (text) params.set(key, text);
        });
        return params;
    }

    function load() {
        const params = filterParams();
        const hasFilters = params.toString() !== "";
        // Export downloads every row that matches the current filters (no paging)
        exportLink.href = `${endpoint}/export${hasFilters ? "?" + params : ""}`;

        params.set("page", page);
        params.set("limit", PAGE_SIZE);
        adminFetch(`${endpoint}?${params}`).then(data => {
            // A delete can empty the last page; step back to the new last page
            if (data.items.length === 0 && page > 1) {
                page = data.totalPages;
                return load();
            }
            container.innerHTML = data.items.length
                ? renderRows(data.items)
                : `<p class="p-3 mb-0 text-body-secondary">${hasFilters ? noMatchText : emptyText}</p>`;
            renderPager(pager, data, newPage => {
                page = newPage;
                load();
                container.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
        }).catch(error => {
            if (error.message === "Not logged in") return;
            container.innerHTML = `<p class="p-3 mb-0 text-danger">${escapeHTML(error.message)}</p>`;
            pager.innerHTML = "";
        });
    }

    // Re-run the search shortly after the admin stops typing / changes a filter
    let timer;
    const onFilterChange = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { page = 1; load(); }, 300);
    };
    form.addEventListener("input", onFilterChange);
    form.addEventListener("change", onFilterChange);
    form.addEventListener("submit", event => event.preventDefault());

    load();
    return { reload: load };
}

// ----- Overview stats (from /api/stats) -----

const statsContainer = document.getElementById("stats-container");

function loadStats() {
    if (!statsContainer) return;
    adminFetch("/api/stats").then(stats => {
        const a = stats.assessments;
        const card = (value, label, extraClass = "") => `
            <div class="col-6 col-md-4 col-lg-2">
                <div class="card stat-card h-100"><div class="card-body">
                    <span class="stat-number ${extraClass}">${escapeHTML(value)}</span>
                    <span class="stat-label">${label}</span>
                </div></div>
            </div>`;

        statsContainer.innerHTML =
            card(a.total, "Assessments taken") +
            card(a.averageScore === null ? "—" : `${a.averageScore}/10`, "Average score") +
            card(a.byLevel.Low, "Low risk", "risk-low") +
            card(a.byLevel.Medium, "Medium risk", "risk-medium") +
            card(a.byLevel.High, "High risk", "risk-high") +
            card(stats.messages.new, "New messages");
    }).catch(error => {
        if (error.message !== "Not logged in") statsContainer.innerHTML = '<p class="text-danger">Could not load stats.</p>';
    });
}

loadStats();

// ----- Received messages -----

const messagesContainer = document.getElementById("messages-container");

if (messagesContainer) {
    const messagesList = setupAdminList({
        endpoint: "/api/messages",
        form: document.getElementById("messages-filters"),
        container: messagesContainer,
        pager: document.getElementById("messages-pager"),
        exportLink: document.getElementById("messages-export"),
        emptyText: "No messages yet.",
        noMatchText: "No messages match these filters.",
        renderRows: messages => {
            let html = `<table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th>Date</th><th>Name</th><th>Email</th><th>Message</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;
            messages.forEach(msg => {
                const resolved = msg.status === "resolved";
                const id = escapeHTML(msg.id);
                const subject = msg.subject ? `<strong>${escapeHTML(msg.subject)}</strong><br>` : "";
                html += `<tr class="${resolved ? "row-resolved" : ""}">
                    <td>${escapeHTML(msg.date || "—")}</td>
                    <td>${escapeHTML(msg.name)}</td>
                    <td>${escapeHTML(msg.email)}</td>
                    <td>${subject}${escapeHTML(msg.message)}</td>
                    <td><span class="badge rounded-pill ${resolved ? "text-bg-secondary" : "text-bg-primary"}">${resolved ? "Resolved" : "New"}</span></td>
                    <td class="actions">
                        <button type="button" class="btn btn-sm btn-outline-primary" data-action="toggle" data-id="${id}" data-status="${resolved ? "new" : "resolved"}">
                            ${resolved ? "Mark as new" : "Mark resolved"}
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${id}">Delete</button>
                    </td>
                </tr>`;
            });
            return html + "</tbody></table>";
        }
    });

    const afterChange = () => {
        messagesList.reload();
        loadStats(); // the "New messages" count may have changed
    };

    messagesContainer.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const url = "/api/messages/" + encodeURIComponent(button.dataset.id);
        const failed = error => {
            if (error.message !== "Not logged in") alert("Could not update the message: " + error.message);
        };

        if (button.dataset.action === "delete") {
            if (!confirm("Delete this message?")) return;
            adminFetch(url, { method: "DELETE" }).then(afterChange).catch(failed);
        }
        if (button.dataset.action === "toggle") {
            adminFetch(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: button.dataset.status })
            }).then(afterChange).catch(failed);
        }
    });
}

// ----- Assessment history -----

const resultsContainer = document.getElementById("results-container");

if (resultsContainer) {
    setupAdminList({
        endpoint: "/api/results",
        form: document.getElementById("results-filters"),
        container: resultsContainer,
        pager: document.getElementById("results-pager"),
        exportLink: document.getElementById("results-export"),
        emptyText: "No assessments taken yet.",
        noMatchText: "No assessments match these filters.",
        renderRows: results => {
            let html = '<table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th>Date</th><th>Risk Level</th><th>Score</th></tr></thead><tbody>';
            results.forEach(result => {
                const level = escapeHTML(result.riskLevel);
                html += `<tr><td>${escapeHTML(result.date)}</td><td><span class="badge rounded-pill badge-${level.toLowerCase()}">${level}</span></td><td>${escapeHTML(result.score)}/10</td></tr>`;
            });
            return html + "</tbody></table>";
        }
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
            if (response.ok) {
                window.location.href = "/admin";
                return;
            }
            // Show the server's reason (wrong password, too many attempts, ...)
            return response.json().catch(() => ({})).then(data => {
                errorText.textContent = data.error || "Login failed. Please try again.";
                errorText.style.display = "block";
            });
        }).catch(() => {
            errorText.textContent = "Could not reach the server. Please try again.";
            errorText.style.display = "block";
        });
    });
}

/* ============================================
   NetGuard — JavaScript
   ============================================ */

console.log("NetGuard script loaded.");

// ===== RESULTS (shared by the assessment page and the saved-result page) =====

const RISK_SUMMARIES = {
    Low: "Your Wi-Fi setup is fairly secure.",
    Medium: "Some settings could be improved.",
    High: "Your network may be vulnerable."
};

// Fills a result box. data = { riskLevel, score, total, checklist }
// checklist is null for results saved before answers were stored.
function fillResult(els, data) {
    els.level.textContent = `Risk Level: ${data.riskLevel}`;
    els.level.className = `risk-${String(data.riskLevel).toLowerCase()}`;
    els.summary.textContent = `You scored ${data.score}/${data.total}. ${RISK_SUMMARIES[data.riskLevel] || ""}`;

    els.checklist.innerHTML = "";
    const addItem = (text, extraClass = "") => {
        const li = document.createElement("li");
        li.className = "list-group-item " + extraClass;
        li.textContent = text;
        els.checklist.appendChild(li);
    };
    if (data.checklist === null) {
        addItem("This result was saved before NetGuard stored individual answers, so its checklist isn't available.", "text-body-secondary");
    } else if (data.checklist.length === 0) {
        addItem("Nothing to fix — your setup looks great!");
    } else {
        data.checklist.forEach(item => addItem(item));
    }
}

// ===== ASSESSMENT FORM (questions come from the server) =====

const assessmentForm = document.getElementById("assessment-form");
const questionsContainer = document.getElementById("questions-container");

function renderQuestions(questions) {
    questionsContainer.innerHTML = questions.map((q, index) => {
        const id = escapeHTML(q.id);
        return `
            <fieldset class="card question" data-question-id="${id}">
                <div class="card-body">
                    <legend class="question-text"><span class="question-number">${index + 1}</span> ${escapeHTML(q.text)}</legend>
                    <div class="options">
                        <input type="radio" class="btn-check" name="${id}" id="${id}-yes" value="yes" autocomplete="off">
                        <label class="btn btn-outline-primary" for="${id}-yes">Yes</label>
                        <input type="radio" class="btn-check" name="${id}" id="${id}-no" value="no" autocomplete="off">
                        <label class="btn btn-outline-primary" for="${id}-no">No</label>
                    </div>
                </div>
            </fieldset>`;
    }).join("");
}

if (assessmentForm && questionsContainer) {
    const submitButton = assessmentForm.querySelector('button[type="submit"]');
    const errorBox = document.getElementById("assessment-error");
    let questions = [];

    const showFormError = message => {
        errorBox.textContent = message;
        errorBox.style.display = "block";
    };

    fetch("/api/questions")
        .then(response => {
            if (!response.ok) throw new Error("Server responded with " + response.status);
            return response.json();
        })
        .then(list => {
            questions = list;
            if (list.length === 0) {
                questionsContainer.innerHTML = '<p class="text-body-secondary">The assessment has no questions yet. Please check back later.</p>';
                return;
            }
            renderQuestions(list);
            submitButton.disabled = false;
        })
        .catch(() => {
            questionsContainer.innerHTML = '<p class="text-danger">Could not load the questions. Please reload the page.</p>';
        });

    // Clear the red outline as soon as a missed question is answered
    assessmentForm.addEventListener("change", event => {
        const fieldset = event.target.closest(".question");
        if (fieldset) fieldset.classList.remove("is-unanswered");
    });

    assessmentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const answers = {};
        let firstMissing = null;
        questionsContainer.querySelectorAll(".question").forEach(fieldset => {
            const selected = fieldset.querySelector("input:checked");
            fieldset.classList.toggle("is-unanswered", !selected);
            if (selected) answers[fieldset.dataset.questionId] = selected.value;
            else if (!firstMissing) firstMissing = fieldset;
        });

        if (firstMissing) {
            const left = questions.length - Object.keys(answers).length;
            showFormError(`Please answer all questions (${left} left).`);
            firstMissing.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        errorBox.style.display = "none";
        submitButton.disabled = true;
        submitButton.textContent = "Calculating...";

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
            showResults(data);
            showShareLink(data.id);
        })
        .catch(error => {
            showFormError(error instanceof TypeError
                ? "Could not reach the server. Please check your connection and try again."
                : error.message);
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = "Calculate My Risk Score";
        });
    });
}

// ===== DISPLAY RESULTS =====

function showResults(data) {
    const resultBox = document.getElementById("result-box");
    document.getElementById("results-placeholder").style.display = "none";
    resultBox.style.display = "block";

    fillResult({
        level: document.getElementById("risk-level"),
        summary: document.getElementById("risk-summary"),
        checklist: document.getElementById("checklist")
    }, data);

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

                fillResult({
                    level: document.getElementById("saved-level"),
                    summary: document.getElementById("saved-summary"),
                    checklist: document.getElementById("saved-checklist")
                }, data);
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
            if (response.status === 403 && data.mustChangePassword) {
                window.location.href = "/change-password";
                throw new Error("Not logged in");
            }
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

// ----- Overview stats and charts (from /api/stats) -----

const statsContainer = document.getElementById("stats-container");
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
        failedChart.innerHTML = '<p class="text-body-secondary small mb-0">No answers saved yet. This fills in as people take the assessment.</p>';
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
        const card = (value, label, extraClass = "") => `
            <div class="col-6 col-md-4 col-lg-2">
                <div class="card stat-card h-100"><div class="card-body">
                    <span class="stat-number ${extraClass}">${escapeHTML(value)}</span>
                    <span class="stat-label">${label}</span>
                </div></div>
            </div>`;

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
                html += `<tr><td>${escapeHTML(result.date)}</td><td><span class="badge rounded-pill badge-${level.toLowerCase()}">${level}</span></td><td>${escapeHTML(result.score)}/${escapeHTML(result.total || 10)}</td></tr>`;
            });
            return html + "</tbody></table>";
        }
    });
}

// ----- Assessment questions editor -----

const questionsAdmin = document.getElementById("questions-admin");

if (questionsAdmin) {
    const form = document.getElementById("question-form");
    const formTitle = document.getElementById("question-form-title");
    const textInput = document.getElementById("question-text");
    const safeInput = document.getElementById("question-safe");
    const fixInput = document.getElementById("question-fix");
    const formError = document.getElementById("question-error");
    let questionList = [];
    let editingId = null; // null = adding a new question

    function renderQuestionTable() {
        const last = questionList.length - 1;
        const rows = questionList.map((q, i) => {
            const id = escapeHTML(q.id);
            return `<tr>
                <td>${i + 1}</td>
                <td>${escapeHTML(q.text)}</td>
                <td>${q.safeAnswer === "yes" ? "Yes" : "No"}</td>
                <td>${escapeHTML(q.fix)}</td>
                <td class="actions">
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-qaction="up" data-id="${id}" ${i === 0 ? "disabled" : ""} aria-label="Move question ${i + 1} up">↑</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-qaction="down" data-id="${id}" ${i === last ? "disabled" : ""} aria-label="Move question ${i + 1} down">↓</button>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-qaction="edit" data-id="${id}">Edit</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-qaction="delete" data-id="${id}" ${questionList.length === 1 ? "disabled" : ""}>Delete</button>
                </td>
            </tr>`;
        }).join("");
        questionsAdmin.innerHTML = `<table class="table table-hover align-middle mb-0">
            <thead class="table-light"><tr><th>#</th><th>Question</th><th>Safe answer</th><th>Fix if unsafe</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody></table>`;
    }

    function loadQuestions() {
        adminFetch("/api/questions/full").then(list => {
            questionList = list;
            renderQuestionTable();
        }).catch(error => {
            if (error.message !== "Not logged in") questionsAdmin.innerHTML = `<p class="p-3 mb-0 text-danger">${escapeHTML(error.message)}</p>`;
        });
    }

    function openForm(question) {
        editingId = question ? question.id : null;
        formTitle.textContent = question ? "Edit question" : "Add question";
        textInput.value = question ? question.text : "";
        safeInput.value = question ? question.safeAnswer : "yes";
        fixInput.value = question ? question.fix : "";
        formError.style.display = "none";
        form.style.display = "block";
        textInput.focus();
    }

    function closeForm() {
        form.style.display = "none";
        editingId = null;
    }

    const afterQuestionChange = () => {
        loadQuestions();
        loadStats(); // the "most failed" chart lists question text
    };

    document.getElementById("question-add").addEventListener("click", () => openForm(null));
    document.getElementById("question-cancel").addEventListener("click", closeForm);

    form.addEventListener("submit", event => {
        event.preventDefault();
        const body = { text: textInput.value.trim(), safeAnswer: safeInput.value, fix: fixInput.value.trim() };
        if (!body.text || !body.fix) {
            formError.textContent = "Please fill in both the question and the fix.";
            formError.style.display = "block";
            return;
        }
        const url = editingId ? "/api/questions/" + encodeURIComponent(editingId) : "/api/questions";
        adminFetch(url, {
            method: editingId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }).then(() => {
            closeForm();
            afterQuestionChange();
        }).catch(error => {
            if (error.message === "Not logged in") return;
            formError.textContent = error.message;
            formError.style.display = "block";
        });
    });

    questionsAdmin.addEventListener("click", event => {
        const button = event.target.closest("button[data-qaction]");
        if (!button) return;
        const id = button.dataset.id;
        const url = "/api/questions/" + encodeURIComponent(id);
        const failed = error => {
            if (error.message !== "Not logged in") alert(error.message);
        };

        switch (button.dataset.qaction) {
            case "edit":
                openForm(questionList.find(q => q.id === id));
                break;
            case "delete":
                if (!confirm("Delete this question? Saved results keep their answers, but new assessments won't ask it.")) return;
                adminFetch(url, { method: "DELETE" }).then(() => {
                    if (editingId === id) closeForm();
                    afterQuestionChange();
                }).catch(failed);
                break;
            case "up":
            case "down":
                adminFetch(url + "/move", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ direction: button.dataset.qaction })
                }).then(loadQuestions).catch(failed);
                break;
        }
    });

    loadQuestions();
}

// ----- Who is logged in + admin accounts -----

const adminsContainer = document.getElementById("admins-container");

function formatWhen(iso) {
    return iso ? new Date(iso).toLocaleString() : "Never";
}

function loadMe() {
    const signedIn = document.getElementById("signed-in-as");
    if (!signedIn) return;
    adminFetch("/api/me").then(me => {
        signedIn.textContent = `Signed in as ${me.username}`;
    }).catch(() => {});
}

function loadAdmins() {
    if (!adminsContainer) return;
    adminFetch("/api/admins").then(admins => {
        const rows = admins.map(a => `<tr>
            <td>${escapeHTML(a.username)}${a.isYou ? ' <span class="badge rounded-pill text-bg-secondary">You</span>' : ""}
                ${a.mustChangePassword ? ' <span class="badge rounded-pill badge-medium">Hasn\'t set own password</span>' : ""}</td>
            <td>${escapeHTML(formatWhen(a.createdAt))}</td>
            <td>${escapeHTML(formatWhen(a.lastLoginAt))}</td>
            <td class="actions">${a.isYou ? "" :
                `<button type="button" class="btn btn-sm btn-outline-danger" data-admin-delete="${escapeHTML(a.id)}" data-username="${escapeHTML(a.username)}">Delete</button>`}</td>
        </tr>`).join("");
        adminsContainer.innerHTML = `<table class="table table-hover align-middle mb-0">
            <thead class="table-light"><tr><th>Username</th><th>Created</th><th>Last login</th><th></th></tr></thead>
            <tbody>${rows}</tbody></table>`;
    }).catch(error => {
        if (error.message !== "Not logged in") adminsContainer.innerHTML = `<p class="p-3 mb-0 text-danger">${escapeHTML(error.message)}</p>`;
    });
}

if (adminsContainer) {
    loadMe();
    loadAdmins();

    adminsContainer.addEventListener("click", event => {
        const button = event.target.closest("button[data-admin-delete]");
        if (!button) return;
        if (!confirm(`Delete the admin account "${button.dataset.username}"? They will be logged out immediately.`)) return;
        adminFetch("/api/admins/" + encodeURIComponent(button.dataset.adminDelete), { method: "DELETE" })
            .then(loadAdmins)
            .catch(error => { if (error.message !== "Not logged in") alert(error.message); });
    });

    const addForm = document.getElementById("add-admin-form");
    const addError = document.getElementById("add-admin-error");
    addForm.addEventListener("submit", event => {
        event.preventDefault();
        addError.style.display = "none";
        const body = {
            username: document.getElementById("new-admin-username").value.trim(),
            password: document.getElementById("new-admin-password").value
        };
        adminFetch("/api/admins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }).then(() => {
            addForm.reset();
            loadAdmins();
        }).catch(error => {
            if (error.message === "Not logged in") return;
            addError.textContent = error.message;
            addError.style.display = "block";
        });
    });

    const passwordForm = document.getElementById("change-password-form");
    const passwordMessage = document.getElementById("change-password-message");
    const showPasswordMessage = (text, ok) => {
        passwordMessage.textContent = text;
        passwordMessage.className = `alert py-2 ${ok ? "alert-success" : "alert-danger"}`;
        passwordMessage.style.display = "block";
    };
    passwordForm.addEventListener("submit", event => {
        event.preventDefault();
        const currentPassword = document.getElementById("current-password").value;
        const newPassword = document.getElementById("new-password").value;
        if (newPassword !== document.getElementById("confirm-password").value) {
            showPasswordMessage("The new passwords don't match.", false);
            return;
        }
        adminFetch("/api/me/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword })
        }).then(data => {
            passwordForm.reset();
            showPasswordMessage(data.message, true);
            loadMe();
            loadAdmins();
        }).catch(error => {
            if (error.message !== "Not logged in") showPasswordMessage(error.message, false);
        });
    });
}

// ----- Change-password page (/change-password) -----

const firstPasswordForm = document.getElementById("first-password-form");

if (firstPasswordForm) {
    const errorBox = document.getElementById("fp-error");
    const showError = message => {
        errorBox.textContent = message;
        errorBox.style.display = "block";
    };

    fetch("/api/me").then(response => {
        if (response.status === 401) {
            window.location.href = "/login";
            return null;
        }
        return response.json();
    }).then(me => {
        if (!me) return;
        document.getElementById("signed-in-as").textContent = `Signed in as ${me.username}`;
        if (!me.mustChangePassword) {
            document.getElementById("password-intro").textContent = "Choose a new password for your account.";
        }
    }).catch(() => {});

    firstPasswordForm.addEventListener("submit", event => {
        event.preventDefault();
        errorBox.style.display = "none";
        const currentPassword = document.getElementById("fp-current").value;
        const newPassword = document.getElementById("fp-new").value;
        if (!currentPassword || !newPassword) return showError("Please fill in all three fields.");
        if (newPassword !== document.getElementById("fp-confirm").value) return showError("The new passwords don't match.");

        fetch("/api/me/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword })
        })
        .then(response => response.json().catch(() => ({})).then(data => {
            if (response.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!response.ok) return showError(data.error || "Could not change the password.");
            window.location.href = "/admin";
        }))
        .catch(() => showError("Could not reach the server. Please try again."));
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
        const username = document.getElementById("admin-username").value.trim();
        const password = document.getElementById("admin-password").value;
        const errorText = document.getElementById("login-error");
        errorText.style.display = "none";

        fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        }).then(response => {
            return response.json().catch(() => ({})).then(data => {
                if (response.ok) {
                    // First login with a starting password: choose your own first
                    window.location.href = data.mustChangePassword ? "/change-password" : "/admin";
                    return;
                }
                // Show the server's reason (wrong password, too many attempts, ...)
                errorText.textContent = data.error || "Login failed. Please try again.";
                errorText.style.display = "block";
            });
        }).catch(() => {
            errorText.textContent = "Could not reach the server. Please try again.";
            errorText.style.display = "block";
        });
    });
}

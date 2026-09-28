/* ============================================
   NetGuard — JavaScript
   ============================================ */

console.log("NetGuard script loaded.");

// ===== FOOTER YEAR =====

document.querySelectorAll("#year").forEach((el) => {
    el.textContent = new Date().getFullYear();
});

// ===== SAVE/RESTORE ASSESSMENT ANSWERS =====

function saveAnswers() {
    const answers = {};
    for (let i = 1; i <= 10; i++) {
        const selected = document.querySelector(`input[name="q${i}"]:checked`);
        if (selected) answers[`q${i}`] = selected.value;
    }
    localStorage.setItem("netguard-answers", JSON.stringify(answers));
}

function restoreAnswers() {
    const saved = localStorage.getItem("netguard-answers");
    if (!saved) return false;

    const answers = JSON.parse(saved);
    if (Object.keys(answers).length === 0) return false;

    for (const key in answers) {
        const input = document.querySelector(`input[name="${key}"][value="${answers[key]}"]`);
        if (input) input.checked = true;
    }
    return true;
}

// ===== PROGRESS INDICATOR =====

function updateProgress() {
    const statusEl = document.getElementById("progress-status");
    const fillEl = document.getElementById("progress-fill");
    if (!statusEl || !fillEl) return;

    let answered = 0;
    for (let i = 1; i <= 10; i++) {
        if (document.querySelector(`input[name="q${i}"]:checked`)) answered++;
    }

    statusEl.textContent = `${answered} of 10 questions answered`;
    fillEl.style.width = `${(answered / 10) * 100}%`;
}

// ===== ASSESSMENT FORM =====

const assessmentForm = document.getElementById("assessment-form");

if (assessmentForm) {
    const wasRestored = restoreAnswers();
    updateProgress();

    const restoreBanner = document.getElementById("restore-banner");
    if (restoreBanner && wasRestored) {
        restoreBanner.hidden = false;
    }

    assessmentForm.addEventListener("change", function () {
        saveAnswers();
        updateProgress();
    });

    assessmentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const submitBtn = assessmentForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = "Calculating...";
            submitBtn.disabled = true;
            setTimeout(() => {
                submitBtn.textContent = "Calculate My Risk Score";
                submitBtn.disabled = false;
            }, 500);
        }

        const totalQuestions = 10;
        let missing = [];
        let safeAnswers = 0;

        const safeYesQuestions = [1, 4, 5, 6, 7, 8, 9, 10];
        const safeNoQuestions = [2, 3];

        // Clear previous error states
        document.querySelectorAll("fieldset").forEach((fs) => fs.classList.remove("fieldset-error"));

        for (let i = 1; i <= totalQuestions; i++) {
            const selected = document.querySelector(`input[name="q${i}"]:checked`);
            if (!selected) {
                missing.push(i);
                const fs = document.getElementById(`fieldset-q${i}`);
                if (fs) fs.classList.add("fieldset-error");
            }
        }

        const errorSummary = document.getElementById("error-summary");
        const errorList = document.getElementById("error-list");

        if (missing.length > 0) {
            if (errorSummary && errorList) {
                errorList.innerHTML = "";
                missing.forEach((q) => {
                    const li = document.createElement("li");
                    const link = document.createElement("a");
                    link.href = `#fieldset-q${q}`;
                    link.textContent = `Question ${q}`;
                    link.addEventListener("click", (e) => {
                        e.preventDefault();
                        const target = document.getElementById(`fieldset-q${q}`);
                        if (target) {
                            target.setAttribute("tabindex", "-1");
                            target.scrollIntoView({ behavior: "smooth", block: "center" });
                            target.focus();
                        }
                    });
                    li.appendChild(link);
                    errorList.appendChild(li);
                });
                errorSummary.classList.add("show");
                errorSummary.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            console.log("Missing questions:", missing);
            return;
        }

        if (errorSummary) errorSummary.classList.remove("show");

        safeYesQuestions.forEach((q) => {
            const selected = document.querySelector(`input[name="q${q}"]:checked`);
            if (selected && selected.value === "yes") safeAnswers++;
        });

        safeNoQuestions.forEach((q) => {
            const selected = document.querySelector(`input[name="q${q}"]:checked`);
            if (selected && selected.value === "no") safeAnswers++;
        });

        let riskLevel;
        if (safeAnswers >= 8) riskLevel = "Low";
        else if (safeAnswers >= 5) riskLevel = "Medium";
        else riskLevel = "High";

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

        showResults(riskLevel, checklist, safeAnswers);
    });

    // Reset button
    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
        resetBtn.addEventListener("click", function () {
            assessmentForm.reset();
            localStorage.removeItem("netguard-answers");
            updateProgress();

            document.querySelectorAll("fieldset").forEach((fs) => fs.classList.remove("fieldset-error"));
            const errorSummary = document.getElementById("error-summary");
            if (errorSummary) errorSummary.classList.remove("show");

            const restoreBanner = document.getElementById("restore-banner");
            if (restoreBanner) restoreBanner.hidden = true;

            const placeholder = document.getElementById("results-placeholder");
            const resultBox = document.getElementById("result-box");
            if (placeholder) placeholder.style.display = "block";
            if (resultBox) resultBox.style.display = "none";

            console.log("Assessment reset.");
        });
    }
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

    if (!placeholder || !resultBox) return;

    placeholder.style.display = "none";
    resultBox.style.display = "block";

    resultBox.classList.remove("result-low", "result-medium", "result-high");
    resultBox.classList.add(`result-${riskLevel.toLowerCase()}`);

    riskLevelEl.textContent = `Risk Level: ${riskLevel}`;
    riskLevelEl.className = "";
    riskLevelEl.classList.add(`risk-${riskLevel.toLowerCase()}`);

    if (riskLevel === "Low") {
        riskSummary.textContent = `You scored ${safeAnswers}/10. Your Wi-Fi setup is fairly secure.`;
    } else if (riskLevel === "Medium") {
        riskSummary.textContent = `You scored ${safeAnswers}/10. Some settings could be improved.`;
    } else {
        riskSummary.textContent = `You scored ${safeAnswers}/10. Your network may be vulnerable.`;
    }

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

    resultBox.focus();
    resultBox.scrollIntoView({ behavior: "smooth" });
}

// ===== CONTACT FORM =====

const contactForm = document.getElementById("contact-form");

if (contactForm) {
    const nameInput = document.getElementById("contact-name");
    const emailInput = document.getElementById("contact-email");
    const messageInput = document.getElementById("contact-message-input");

    function validateField(input, errorId, isValid) {
        const errorEl = document.getElementById(errorId);
        if (isValid) {
            input.classList.remove("invalid");
            if (errorEl) errorEl.classList.remove("show");
            return true;
        } else {
            input.classList.add("invalid");
            if (errorEl) errorEl.classList.add("show");
            return false;
        }
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    contactForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const message = messageInput.value.trim();

        const nameValid = validateField(nameInput, "error-name", name.length > 0);
        const emailValid = validateField(emailInput, "error-email", isValidEmail(email));
        const messageValid = validateField(messageInput, "error-message-field", message.length > 0);

        if (!nameValid || !emailValid || !messageValid) {
            const firstInvalid = contactForm.querySelector(".invalid");
            if (firstInvalid) firstInvalid.focus();
            return;
        }

        const msg = document.getElementById("contact-message");
        if (msg) msg.hidden = false;

        contactForm.reset();
        console.log("Contact form submitted:", { name, email, message });
    });

    // Clear error styling as the user fixes a field
    [nameInput, emailInput, messageInput].forEach((input) => {
        input.addEventListener("input", function () {
            if (input.classList.contains("invalid")) {
                input.classList.remove("invalid");
                const errorEl = input.parentElement.querySelector(".field-error");
                if (errorEl) errorEl.classList.remove("show");
            }
        });
    });
}

// ===== ACTIVE NAV HIGHLIGHT =====
// (server-rendered "active" class in each HTML file already covers this;
//  this is a fallback in case a page is opened without one set)

const currentPage = window.location.pathname.split("/").pop() || "index.html";
const navLinks = document.querySelectorAll("nav a");
const hasActive = Array.from(navLinks).some((link) => link.classList.contains("active"));

if (!hasActive) {
    navLinks.forEach((link) => {
        if (link.getAttribute("href") === currentPage) {
            link.classList.add("active");
        }
    });
}

// ===== CAROUSEL =====

const prevBtn = document.querySelector(".carousel-btn.prev");
const nextBtn = document.querySelector(".carousel-btn.next");
const carouselContainer = document.querySelector(".carousel-container");

if (prevBtn && nextBtn && carouselContainer) {
    const card = carouselContainer.querySelector(".card");
    const cardWidth = card.offsetWidth + 20;

    function updateCarouselButtons() {
        const maxScroll = carouselContainer.scrollWidth - carouselContainer.clientWidth;
        prevBtn.disabled = carouselContainer.scrollLeft <= 1;
        nextBtn.disabled = carouselContainer.scrollLeft >= maxScroll - 1;
    }

    prevBtn.addEventListener("click", () => {
        carouselContainer.scrollBy({ left: -cardWidth, behavior: "smooth" });
    });

    nextBtn.addEventListener("click", () => {
        carouselContainer.scrollBy({ left: cardWidth, behavior: "smooth" });
    });

    carouselContainer.addEventListener("scroll", updateCarouselButtons);
    window.addEventListener("resize", updateCarouselButtons);
    updateCarouselButtons();
}

// ===== EXPANDABLE TIPS =====

document.querySelectorAll(".tip-toggle").forEach((btn) => {
    btn.addEventListener("click", function () {
        const body = btn.nextElementSibling;
        const isOpen = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!isOpen));
        btn.textContent = isOpen ? "Learn more" : "Show less";
        if (body) body.hidden = isOpen;
    });
});

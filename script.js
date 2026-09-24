/* ============================================
   NetGuard — JavaScript
   ============================================ */

console.log("NetGuard script loaded.");

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
    if (!saved) return;

    const answers = JSON.parse(saved);
    for (const key in answers) {
        const input = document.querySelector(`input[name="${key}"][value="${answers[key]}"]`);
        if (input) input.checked = true;
    }
}

// ===== ASSESSMENT FORM =====

const assessmentForm = document.querySelector("form");

if (assessmentForm) {
    restoreAnswers();
    assessmentForm.addEventListener("change", saveAnswers);

    assessmentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const submitBtn = assessmentForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = "Calculating...";
            submitBtn.disabled = true;
            setTimeout(() => {
                submitBtn.textContent = "Calculate My Risk Score";
                submitBtn.disabled = false;
            }, 600);
        }

        const totalQuestions = 10;
        let answered = 0;
        let missing = [];
        let safeAnswers = 0;

        const safeYesQuestions = [1, 4, 5, 6, 7, 8, 9, 10];
        const safeNoQuestions = [2, 3];

        for (let i = 1; i <= totalQuestions; i++) {
            const selected = document.querySelector(`input[name="q${i}"]:checked`);
            if (!selected) missing.push(i);
            else answered++;
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

    resultBox.scrollIntoView({ behavior: "smooth" });
}

// ===== CONTACT FORM =====

const contactForm = document.getElementById("contact-form");

if (contactForm) {
    contactForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const name = contactForm.querySelector('input[type="text"]').value.trim();
        const email = contactForm.querySelector('input[type="email"]').value.trim();
        const message = contactForm.querySelector("textarea").value.trim();

        if (!name || !email || !message) {
            alert("Please fill in all fields before sending.");
            return;
        }

        const msg = document.getElementById("contact-message");
        if (msg) msg.style.display = "block";

        contactForm.reset();
        console.log("Contact form submitted:", { name, email, message });
    });
}

// ===== ACTIVE NAV HIGHLIGHT =====

const currentPage = window.location.pathname.split("/").pop() || "index.html";
const navLinks = document.querySelectorAll("nav a");

navLinks.forEach((link) => {
    if (link.getAttribute("href") === currentPage) {
        link.classList.add("active");
    }
});

// ===== CAROUSEL =====

const prevBtn = document.querySelector(".carousel-btn.prev");
const nextBtn = document.querySelector(".carousel-btn.next");
const carouselContainer = document.querySelector(".carousel-container");

if (prevBtn && nextBtn && carouselContainer) {
    const card = carouselContainer.querySelector(".card");
    const cardWidth = card.offsetWidth + 20;

    prevBtn.addEventListener("click", () => {
        carouselContainer.scrollBy({ left: -cardWidth, behavior: "smooth" });
    });

    nextBtn.addEventListener("click", () => {
        carouselContainer.scrollBy({ left: cardWidth, behavior: "smooth" });
    });
}
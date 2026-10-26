/* ============================================
   NetGuard — client-side enhancements (Milestone 2)
   Pages, scoring and validation are handled by the server.
   This file only adds convenience: draft saving, loading
   states, delete confirmation and the carousel.
   ============================================ */

const DRAFT_KEY = "netguard-answers";

// ===== ASSESSMENT FORM =====
const assessmentForm = document.getElementById("assessment-form");

if (assessmentForm) {
    const radios = () => assessmentForm.querySelectorAll('input[type="radio"]');
    const anyChecked = () => Array.from(radios()).some((r) => r.checked);

    // Restore an unsent draft (only if the server didn't already fill the form in)
    if (!anyChecked()) {
        try {
            const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
            for (const name in draft) {
                const input = assessmentForm.querySelector(`input[name="${name}"][value="${draft[name]}"]`);
                if (input) input.checked = true;
            }
        } catch (e) { /* ignore a corrupt draft */ }
    }

    assessmentForm.addEventListener("change", () => {
        const draft = {};
        assessmentForm.querySelectorAll("input[type=radio]:checked").forEach((r) => { draft[r.name] = r.value; });
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* storage unavailable */ }
    });

    assessmentForm.addEventListener("submit", () => {
        const btn = assessmentForm.querySelector('button[type="submit"]');
        btn.textContent = "Calculating...";
        btn.disabled = true;
    });

    document.getElementById("reset-btn").addEventListener("click", () => {
        radios().forEach((r) => { r.checked = false; });
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
        document.querySelectorAll(".alert-error, .has-error").forEach((el) => {
            if (el.classList.contains("alert")) el.remove();
            else el.classList.remove("has-error");
        });
    });

    // Back/forward cache: make sure the submit button isn't stuck on "Calculating..."
    window.addEventListener("pageshow", () => {
        const btn = assessmentForm.querySelector('button[type="submit"]');
        btn.textContent = "Calculate My Risk Score";
        btn.disabled = false;
    });
}

// Results page: the draft has been submitted, so clear it
if (document.querySelector("[data-clear-draft]")) {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
}

// ===== CONTACT FORM: prevent double submits =====
const contactForm = document.getElementById("contact-form");
if (contactForm) {
    contactForm.addEventListener("submit", () => {
        const btn = contactForm.querySelector('button[type="submit"]');
        btn.textContent = "Sending...";
        btn.disabled = true;
    });
    window.addEventListener("pageshow", () => {
        const btn = contactForm.querySelector('button[type="submit"]');
        btn.textContent = "Send Message";
        btn.disabled = false;
    });
}

// ===== DELETE CONFIRMATION =====
document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
        if (!confirm(form.dataset.confirm)) event.preventDefault();
    });
});

// ===== CAROUSEL =====
const prevBtn = document.querySelector(".carousel-btn.prev");
const nextBtn = document.querySelector(".carousel-btn.next");
const carouselContainer = document.querySelector(".carousel-container");

if (prevBtn && nextBtn && carouselContainer) {
    const step = () => carouselContainer.querySelector(".card").offsetWidth + 20;
    prevBtn.addEventListener("click", () => carouselContainer.scrollBy({ left: -step(), behavior: "smooth" }));
    nextBtn.addEventListener("click", () => carouselContainer.scrollBy({ left: step(), behavior: "smooth" }));
}

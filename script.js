/* ============================================
   NetGuard — JavaScript
   ============================================ */

console.log("NetGuard script loaded.");

// ===== FORM VALIDATION =====

const assessmentForm = document.querySelector("form");

if (assessmentForm) {
    assessmentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const totalQuestions = 10;
        let answered = 0;
        let missing = [];

        for (let i = 1; i <= totalQuestions; i++) {
            const question = document.querySelector(`input[name="q${i}"]:checked`);
            if (question) {
                answered++;
            } else {
                missing.push(i);
            }
        }

        if (answered < totalQuestions) {
            alert("Please answer all questions before submitting.");
            console.log("Missing questions:", missing);
            return;
        }

        console.log("All questions answered. Ready to calculate score.");
        // Next commit will calculate the score here
    });
}
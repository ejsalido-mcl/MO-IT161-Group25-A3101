/* ============================================
   NetGuard — JavaScript
   ============================================ */

console.log("NetGuard script loaded.");

// ===== FORM VALIDATION + RISK CALCULATION =====

const assessmentForm = document.querySelector("form");

if (assessmentForm) {
    assessmentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const totalQuestions = 10;
        let answered = 0;
        let missing = [];
        let safeAnswers = 0;

        // Questions where "yes" is the safe answer
        const safeYesQuestions = [1, 4, 5, 6, 7, 8, 9, 10];
        // Questions where "no" is the safe answer
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

        // Count safe answers
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

        console.log("Safe answers:", safeAnswers);
        console.log("Risk level:", riskLevel);
    });
}
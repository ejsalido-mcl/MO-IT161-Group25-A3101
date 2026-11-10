// ============================================
// NetGuard — input validation (pure functions)
// No Express here, so these can be unit-tested on their own.
// ============================================

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same limits as the forms on the website
const LIMITS = {
    nameMin: 2,
    nameMax: 100,
    emailMax: 254,
    subjectMax: 200,
    messageMin: 10,
    messageMax: 500
};

const VALID_LEVELS = ["Low", "Medium", "High"];

// Same rule as script.js: 8-10 safe answers = Low, 5-7 = Medium, 0-4 = High
function riskLevelFor(score) {
    if (score >= 8) return "Low";
    if (score >= 5) return "Medium";
    return "High";
}

// Returns { ok: true, value: {...clean data} } or { ok: false, errors: { field: "message" } }
function validateContact(body) {
    const data = body && typeof body === "object" ? body : {};
    const errors = {};

    // Every field must be a string (numbers/arrays/objects used to crash .trim())
    const isText = (v) => typeof v === "string";

    const name = isText(data.name) ? data.name.trim() : "";
    if (!isText(data.name) || name.length < LIMITS.nameMin) {
        errors.name = `Name is required (at least ${LIMITS.nameMin} characters).`;
    } else if (name.length > LIMITS.nameMax) {
        errors.name = `Name must be at most ${LIMITS.nameMax} characters.`;
    }

    const email = isText(data.email) ? data.email.trim() : "";
    if (!isText(data.email) || !email) {
        errors.email = "Email is required.";
    } else if (email.length > LIMITS.emailMax || !EMAIL_PATTERN.test(email)) {
        errors.email = "Invalid email address.";
    }

    // Subject is optional, but if it is sent it must be text
    let subject = "";
    if (data.subject !== undefined && data.subject !== null) {
        if (!isText(data.subject)) {
            errors.subject = "Subject must be text.";
        } else {
            subject = data.subject.trim();
            if (subject.length > LIMITS.subjectMax) {
                errors.subject = `Subject must be at most ${LIMITS.subjectMax} characters.`;
            }
        }
    }

    const message = isText(data.message) ? data.message.trim() : "";
    if (!isText(data.message) || message.length < LIMITS.messageMin) {
        errors.message = `Message is required (at least ${LIMITS.messageMin} characters).`;
    } else if (message.length > LIMITS.messageMax) {
        errors.message = `Message must be at most ${LIMITS.messageMax} characters.`;
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, value: { name, email, subject, message } };
}

// The server works out the risk level itself, so a client cannot send "Low" with a score of 2
function validateResult(body) {
    const data = body && typeof body === "object" ? body : {};
    const { riskLevel, score } = data;
    const errors = {};

    if (!VALID_LEVELS.includes(riskLevel)) {
        errors.riskLevel = "Risk level must be Low, Medium, or High.";
    }
    if (!Number.isInteger(score) || score < 0 || score > 10) {
        errors.score = "Score must be a whole number from 0 to 10.";
    }
    if (!errors.riskLevel && !errors.score && riskLevelFor(score) !== riskLevel) {
        errors.riskLevel = `A score of ${score} is ${riskLevelFor(score)} risk, not ${riskLevel}.`;
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, value: { riskLevel, score } };
}

module.exports = { EMAIL_PATTERN, LIMITS, VALID_LEVELS, riskLevelFor, validateContact, validateResult };
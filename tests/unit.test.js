// INTERNAL TESTS: the backend's own logic, checked directly (no server needed).
// Run with:  node --test tests/

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { LIMITS, riskLevelFor, validateContact, validateResult } = require("../validators");
const { createRateLimiter } = require("../ratelimit");

const goodContact = {
    name: "Juan Dela Cruz",
    email: "juan@example.com",
    subject: "Router help",
    message: "My router keeps disconnecting."
};

describe("riskLevelFor (same rule as script.js)", () => {
    const cases = [
        [0, "High"], [4, "High"],
        [5, "Medium"], [7, "Medium"],
        [8, "Low"], [10, "Low"]
    ];
    for (const [score, level] of cases) {
        test(`score ${score} is ${level}`, () => assert.equal(riskLevelFor(score), level));
    }
});

describe("validateContact", () => {
    test("accepts a good message and trims the text", () => {
        const r = validateContact({ ...goodContact, name: "  Juan  ", message: "  Hello there, help me.  " });
        assert.equal(r.ok, true);
        assert.equal(r.value.name, "Juan");
        assert.equal(r.value.message, "Hello there, help me.");
    });

    test("subject is optional", () => {
        const { subject, ...noSubject } = goodContact;
        const r = validateContact(noSubject);
        assert.equal(r.ok, true);
        assert.equal(r.value.subject, "");
    });

    test("null subject is treated as empty", () => {
        assert.equal(validateContact({ ...goodContact, subject: null }).ok, true);
    });

    const bad = [
        ["no body at all", undefined],
        ["body is a string", "hello"],
        ["empty object", {}],
        ["name missing", { ...goodContact, name: undefined }],
        ["name is only spaces", { ...goodContact, name: "   " }],
        ["name too short", { ...goodContact, name: "J" }],
        ["name too long", { ...goodContact, name: "J".repeat(LIMITS.nameMax + 1) }],
        ["name is a number (used to crash .trim())", { ...goodContact, name: 123 }],
        ["name is an object", { ...goodContact, name: { a: 1 } }],
        ["email missing", { ...goodContact, email: undefined }],
        ["email has no @", { ...goodContact, email: "juan.example.com" }],
        ["email has no dot after @", { ...goodContact, email: "juan@example" }],
        ["email has a space", { ...goodContact, email: "ju an@example.com" }],
        ["email is an array", { ...goodContact, email: ["a@b.co"] }],
        ["email too long", { ...goodContact, email: "a".repeat(LIMITS.emailMax) + "@example.com" }],
        ["subject is a number", { ...goodContact, subject: 5 }],
        ["subject too long", { ...goodContact, subject: "s".repeat(LIMITS.subjectMax + 1) }],
        ["message missing", { ...goodContact, message: undefined }],
        ["message too short", { ...goodContact, message: "short" }],
        ["message too long", { ...goodContact, message: "m".repeat(LIMITS.messageMax + 1) }],
        ["message is an array", { ...goodContact, message: ["hello hello hello"] }]
    ];
    for (const [label, body] of bad) {
        test(`rejects: ${label}`, () => {
            const r = validateContact(body);
            assert.equal(r.ok, false);
            assert.ok(Object.keys(r.errors).length > 0);
        });
    }

    test("reports which field is wrong", () => {
        const r = validateContact({ ...goodContact, email: "nope" });
        assert.deepEqual(Object.keys(r.errors), ["email"]);
    });

    test("accepts boundary lengths", () => {
        assert.equal(validateContact({ ...goodContact, name: "Jo" }).ok, true);
        assert.equal(validateContact({ ...goodContact, message: "m".repeat(LIMITS.messageMin) }).ok, true);
        assert.equal(validateContact({ ...goodContact, message: "m".repeat(LIMITS.messageMax) }).ok, true);
    });

    test("keeps HTML as plain text (the dashboard escapes it when showing it)", () => {
        const r = validateContact({ ...goodContact, message: "<script>alert(1)</script> hello" });
        assert.equal(r.ok, true);
        assert.equal(r.value.message, "<script>alert(1)</script> hello");
    });
});

describe("validateResult", () => {
    test("accepts matching level and score", () => {
        assert.deepEqual(validateResult({ riskLevel: "Low", score: 9 }), { ok: true, value: { riskLevel: "Low", score: 9 } });
        assert.equal(validateResult({ riskLevel: "Medium", score: 5 }).ok, true);
        assert.equal(validateResult({ riskLevel: "High", score: 0 }).ok, true);
    });

    const bad = [
        ["no body", undefined],
        ["empty object", {}],
        ["unknown level", { riskLevel: "Critical", score: 9 }],
        ["lowercase level", { riskLevel: "low", score: 9 }],
        ["score above 10", { riskLevel: "Low", score: 11 }],
        ["negative score", { riskLevel: "High", score: -1 }],
        ["decimal score", { riskLevel: "Medium", score: 5.5 }],
        ["score as text", { riskLevel: "Low", score: "9" }],
        ["score is null", { riskLevel: "Low", score: null }],
        ["level missing", { score: 9 }],
        ["score missing", { riskLevel: "Low" }],
        ["Low with a score of 2 (mismatch)", { riskLevel: "Low", score: 2 }],
        ["High with a score of 10 (mismatch)", { riskLevel: "High", score: 10 }],
        ["Medium with a score of 8 (mismatch)", { riskLevel: "Medium", score: 8 }]
    ];
    for (const [label, body] of bad) {
        test(`rejects: ${label}`, () => assert.equal(validateResult(body).ok, false));
    }
});

describe("rate limiter", () => {
    // Fake request/response so no server is needed
    function fakeRes() {
        return {
            code: 200, headers: {}, body: null,
            set(k, v) { this.headers[k] = v; return this; },
            status(c) { this.code = c; return this; },
            json(b) { this.body = b; return this; }
        };
    }
    function hit(limiter, ip) {
        const res = fakeRes();
        let passed = false;
        limiter({ ip }, res, () => { passed = true; });
        return { passed, res };
    }

    test("lets requests through until the limit, then answers 429", () => {
        let clock = 0;
        const limiter = createRateLimiter({ windowMs: 1000, max: 3, now: () => clock });
        assert.equal(hit(limiter, "1.1.1.1").passed, true);
        assert.equal(hit(limiter, "1.1.1.1").passed, true);
        assert.equal(hit(limiter, "1.1.1.1").passed, true);
        const blocked = hit(limiter, "1.1.1.1");
        assert.equal(blocked.passed, false);
        assert.equal(blocked.res.code, 429);
        assert.ok(Number(blocked.res.headers["Retry-After"]) >= 1);
    });

    test("each address has its own count", () => {
        const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });
        assert.equal(hit(limiter, "1.1.1.1").passed, true);
        assert.equal(hit(limiter, "2.2.2.2").passed, true);
        assert.equal(hit(limiter, "1.1.1.1").passed, false);
    });

    test("allows requests again after the window passes", () => {
        let clock = 0;
        const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => clock });
        assert.equal(hit(limiter, "1.1.1.1").passed, true);
        assert.equal(hit(limiter, "1.1.1.1").passed, false);
        clock = 1001;
        assert.equal(hit(limiter, "1.1.1.1").passed, true);
    });
});

/* Assessment: questions, server-side scoring, saved results and result links */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, Client, answersWithScore, SAFE } = require("./helpers");

// A result saved before answers were stored (old format), to check compatibility
const LEGACY = { id: "11111111-2222-4333-8444-555555555555", riskLevel: "Medium", score: 6, date: "10/20/2026, 8:15:01 AM" };

let server;
let web;

before(async () => {
    server = await startServer({ seed: { "results.json": [LEGACY] } });
    web = new Client(server.url);
});
after(() => server.stop());

test("TC-ASM-01: questions are served publicly without safe answers or fixes", async () => {
    const res = await web.get("/api/questions");
    assert.equal(res.status, 200);
    assert.equal(res.data.length, 10);
    assert.equal(res.data[0].id, "q1");
    for (const q of res.data) assert.deepEqual(Object.keys(q).sort(), ["id", "text"]);
});

// Boundary values around each risk level (80% and 50%)
for (const [score, level] of [[10, "Low"], [8, "Low"], [7, "Medium"], [5, "Medium"], [4, "High"], [0, "High"]]) {
    test(`TC-ASM-02: score ${score}/10 is ${level} risk with ${10 - score} fixes`, async () => {
        const res = await web.post("/save-result", { answers: answersWithScore(score) });
        assert.equal(res.status, 200);
        assert.equal(res.data.score, score);
        assert.equal(res.data.total, 10);
        assert.equal(res.data.riskLevel, level);
        assert.equal(res.data.checklist.length, 10 - score);
        assert.match(res.data.id, /^[0-9a-f-]{36}$/);
    });
}

test("TC-ASM-03: the checklist names the right fixes", async () => {
    const answers = { ...SAFE, q1: "no", q3: "yes" }; // weak Wi-Fi password + default router password
    const res = await web.post("/save-result", { answers });
    assert.deepEqual(res.data.checklist, [
        "Use a stronger, unique Wi-Fi password.",
        "Change your router's default admin password."
    ]);
});

test("TC-ASM-04: answers, checklist and timestamps are saved with the result", async () => {
    const res = await web.post("/save-result", { answers: answersWithScore(7) });
    const saved = server.read("results.json").find(r => r.id === res.data.id);
    assert.equal(saved.answers.length, 10);
    assert.deepEqual(Object.keys(saved.answers[0]).sort(), ["answer", "question", "questionId", "safe"]);
    assert.equal(saved.checklist.length, 3);
    assert.ok(!Number.isNaN(Date.parse(saved.createdAt)));
});

test("TC-ASM-05: a score sent by the browser is ignored (old format rejected)", async () => {
    const res = await web.post("/save-result", { riskLevel: "Low", score: 10 });
    assert.equal(res.status, 400);
});

test("TC-ASM-06: invalid answer sets are rejected", async () => {
    const all = answersWithScore(10);
    const missingOne = { ...all };
    delete missingOne.q10;
    const cases = {
        "one question unanswered": { answers: missingOne },
        "answer is not yes/no": { answers: { ...all, q4: "maybe" } },
        "unknown question id": { answers: { ...all, hacked: "yes" } },
        "answers is an array": { answers: ["yes"] },
        "answers is a string": { answers: "yes" },
        "answers missing": {}
    };
    for (const [name, body] of Object.entries(cases)) {
        const res = await web.post("/save-result", body);
        assert.equal(res.status, 400, name);
        assert.ok(res.data.error, name);
    }
});

test("TC-RES-01: a result link shows that result, without the raw answers", async () => {
    const saved = await web.post("/save-result", { answers: answersWithScore(8) });
    const res = await web.get("/api/results/" + saved.data.id);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.data).sort(), ["checklist", "date", "riskLevel", "score", "total"]);
    assert.equal(res.data.score, 8);
    assert.equal(res.data.checklist.length, 2);
});

test("TC-RES-02: result links work in uppercase too", async () => {
    const saved = await web.post("/save-result", { answers: answersWithScore(9) });
    const res = await web.get("/api/results/" + saved.data.id.toUpperCase());
    assert.equal(res.status, 200);
});

test("TC-RES-03: invalid and unknown result links are handled", async () => {
    assert.equal((await web.get("/api/results/abc")).status, 400);
    assert.equal((await web.get("/api/results/..%2f..%2fapp.js")).status, 400);
    assert.equal((await web.get("/api/results/00000000-0000-4000-8000-000000000000")).status, 404);
});

test("TC-RES-04: results saved before answers were stored still open", async () => {
    const res = await web.get("/api/results/" + LEGACY.id);
    assert.equal(res.status, 200);
    assert.equal(res.data.total, 10);
    assert.equal(res.data.checklist, null);
});

test("TC-RES-05: the full results list is admin-only", async () => {
    assert.equal((await web.get("/api/results")).status, 401);
});

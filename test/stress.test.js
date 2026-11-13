/* Stress / load tests: many requests at the same time.
   Checks that nothing fails, nothing is lost, and responses stay fast. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, Client, adminClient, answersWithScore } = require("./helpers");

let server;
let web;

before(async () => {
    server = await startServer();
    web = new Client(server.url);
});
after(() => server.stop());

function summarize(times) {
    const sorted = [...times].sort((a, b) => a - b);
    const pick = p => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
    return { p50: pick(50), p95: pick(95), max: sorted.at(-1) };
}

async function timed(fn) {
    const start = performance.now();
    const res = await fn();
    return { res, ms: Math.round(performance.now() - start) };
}

test("TC-PERF-01: 200 simultaneous assessments all succeed and none are lost", async t => {
    const runs = await Promise.all(Array.from({ length: 200 }, (_, i) =>
        timed(() => web.post("/save-result", { answers: answersWithScore(i % 11) }))));

    const failures = runs.filter(r => r.res.status !== 200);
    assert.equal(failures.length, 0, `${failures.length} requests failed`);
    const ids = new Set(runs.map(r => r.res.data.id));
    assert.equal(ids.size, 200, "every result got its own id");
    assert.equal(server.read("results.json").length, 200, "all 200 were saved to disk");

    const stats = summarize(runs.map(r => r.ms));
    t.diagnostic(`200 concurrent /save-result: p50 ${stats.p50} ms, p95 ${stats.p95} ms, max ${stats.max} ms`);
    assert.ok(stats.p95 < 3000, `p95 ${stats.p95} ms is too slow`);
});

test("TC-PERF-02: 100 simultaneous contact messages all saved", async t => {
    const runs = await Promise.all(Array.from({ length: 100 }, (_, i) =>
        timed(() => web.post("/contact", { name: `Load ${i}`, email: `load${i}@example.com`, message: "load test" }))));

    assert.equal(runs.filter(r => r.res.status !== 200).length, 0);
    assert.equal(server.read("messages.json").length, 100);
    const stats = summarize(runs.map(r => r.ms));
    t.diagnostic(`100 concurrent /contact: p50 ${stats.p50} ms, p95 ${stats.p95} ms, max ${stats.max} ms`);
});

test("TC-PERF-03: 300 mixed page and API reads at once", async t => {
    const urls = ["/", "/assessment", "/api/questions", "/style.css", "/script.js"];
    const runs = await Promise.all(Array.from({ length: 300 }, (_, i) => timed(() => web.get(urls[i % urls.length]))));

    assert.equal(runs.filter(r => r.res.status !== 200).length, 0);
    const stats = summarize(runs.map(r => r.ms));
    t.diagnostic(`300 concurrent reads: p50 ${stats.p50} ms, p95 ${stats.p95} ms, max ${stats.max} ms`);
});

test("TC-PERF-04: dashboard stays fast with 200 results and 100 messages stored", async t => {
    const admin = await adminClient(server);
    const runs = await Promise.all(Array.from({ length: 50 }, (_, i) =>
        timed(() => admin.get(["/api/stats", "/api/results?page=3", "/api/messages?q=load", "/api/results/export"][i % 4]))));

    assert.equal(runs.filter(r => r.res.status !== 200).length, 0);
    const stats = summarize(runs.map(r => r.ms));
    t.diagnostic(`50 concurrent dashboard requests: p50 ${stats.p50} ms, p95 ${stats.p95} ms, max ${stats.max} ms`);
    const statsRes = await admin.get("/api/stats");
    assert.equal(statsRes.data.assessments.total, 200);
});

test("TC-PERF-05: a burst of 20 parallel logins is handled (slow password hashing)", async t => {
    const start = performance.now();
    const runs = await Promise.all(Array.from({ length: 20 }, () =>
        new Client(server.url).post("/login", { username: "roi", password: "Test#Passw0rd!" })));
    const ms = Math.round(performance.now() - start);
    assert.equal(runs.filter(r => r.status !== 200).length, 0);
    t.diagnostic(`20 parallel logins finished in ${ms} ms`);
});

/* Admin dashboard APIs: access control, messages, results, CSV export, stats, questions */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, Client, adminClient, answersWithScore } = require("./helpers");

let server;
let admin;
let web;

before(async () => {
    server = await startServer();
    web = new Client(server.url);
    admin = await adminClient(server);

    // 12 messages and 12 results to page and filter through
    for (let i = 1; i <= 12; i++) {
        await web.post("/contact", { name: `Visitor ${i}`, email: `visitor${i}@example.com`, message: `Message number ${i}` });
    }
    await web.post("/contact", { name: '=HYPERLINK("http://evil")', email: "csv@example.com", subject: 'Comma, "quote"', message: "line1\nline2" });
    for (const score of [10, 9, 8, 8, 7, 6, 5, 5, 4, 3, 1, 0]) {
        await web.post("/save-result", { answers: answersWithScore(score) });
    }
});
after(() => server.stop());

test("TC-ADM-01: every admin endpoint requires login", async () => {
    const endpoints = [
        ["GET", "/api/messages"], ["GET", "/api/messages/export"], ["PATCH", "/api/messages/x"], ["DELETE", "/api/messages/x"],
        ["GET", "/api/results"], ["GET", "/api/results/export"], ["GET", "/api/stats"],
        ["GET", "/api/questions/full"], ["POST", "/api/questions"], ["PATCH", "/api/questions/q1"],
        ["DELETE", "/api/questions/q1"], ["POST", "/api/questions/q1/move"],
        ["GET", "/api/admins"], ["POST", "/api/admins"], ["DELETE", "/api/admins/x"],
        ["GET", "/api/me"], ["POST", "/api/me/password"]
    ];
    for (const [method, url] of endpoints) {
        const res = await web.request(method, url, { json: {} });
        assert.equal(res.status, 401, `${method} ${url}`);
    }
});

test("TC-MSG-01: messages are paged, newest first", async () => {
    const page1 = await admin.get("/api/messages?page=1&limit=5");
    assert.equal(page1.status, 200);
    assert.deepEqual({ page: page1.data.page, limit: page1.data.limit, total: page1.data.total, totalPages: page1.data.totalPages },
        { page: 1, limit: 5, total: 13, totalPages: 3 });
    assert.equal(page1.data.items.length, 5);
    assert.equal(page1.data.items[0].email, "csv@example.com", "newest first");
    const page3 = await admin.get("/api/messages?page=3&limit=5");
    assert.equal(page3.data.items.length, 3);
    const beyond = await admin.get("/api/messages?page=99");
    assert.equal(beyond.data.items.length, 0);
});

test("TC-MSG-02: messages can be searched and filtered by status", async () => {
    const search = await admin.get("/api/messages?q=VISITOR%2012");
    assert.deepEqual(search.data.items.map(m => m.name), ["Visitor 12"]);

    const id = (await admin.get("/api/messages?q=visitor1%40example.com")).data.items[0].id;
    assert.equal((await admin.patch("/api/messages/" + id, { status: "resolved" })).status, 200);
    const resolved = await admin.get("/api/messages?status=resolved");
    assert.equal(resolved.data.total, 1);
    assert.equal(resolved.data.items[0].id, id);
});

test("TC-MSG-03: invalid paging and filter values are rejected", async () => {
    for (const query of ["page=0", "page=-1", "page=abc", "page=1.5", "limit=0", "limit=101", "page=1&page=2",
        "status=deleted", "q=" + "a".repeat(101)]) {
        const res = await admin.get("/api/messages?" + query);
        assert.equal(res.status, 400, query);
    }
});

test("TC-MSG-04: messages can be updated and deleted; bad requests are rejected", async () => {
    const id = (await admin.get("/api/messages?q=visitor2%40example.com")).data.items[0].id;
    assert.equal((await admin.patch("/api/messages/" + id, { status: "hacked" })).status, 400);
    assert.equal((await admin.patch("/api/messages/" + id, {})).status, 400);
    assert.equal((await admin.patch("/api/messages/nope", { status: "new" })).status, 404);
    assert.equal((await admin.delete("/api/messages/" + id)).status, 200);
    assert.equal((await admin.delete("/api/messages/" + id)).status, 404);
});

test("TC-RSL-01: results can be filtered by risk level and date", async () => {
    const high = await admin.get("/api/results?riskLevel=High&limit=100");
    assert.equal(high.data.total, 4);
    assert.ok(high.data.items.every(r => r.riskLevel === "High"));

    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    assert.equal((await admin.get(`/api/results?from=${key}&to=${key}`)).data.total, 12);
    assert.equal((await admin.get("/api/results?to=2000-01-01")).data.total, 0);
});

test("TC-RSL-02: invalid result filters are rejected", async () => {
    for (const query of ["riskLevel=low", "riskLevel=Extreme", "from=11/09/2026", "from=2026-13-45",
        "from=2026-12-01&to=2026-11-01", "limit=500"]) {
        assert.equal((await admin.get("/api/results?" + query)).status, 400, query);
    }
});

test("TC-CSV-01: message export is a UTF-8 CSV download that respects filters", async () => {
    const res = await admin.get("/api/messages/export?q=csv%40example.com");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/csv/);
    assert.match(res.headers.get("content-disposition"), /attachment; filename="netguard-messages-\d{4}-\d{2}-\d{2}\.csv"/);
    assert.equal(res.text.charCodeAt(0), 0xFEFF, "starts with a BOM so Excel reads UTF-8");
    const lines = res.text.slice(1).trim().split("\r\n");
    assert.equal(lines[0], "Date,Name,Email,Subject,Message,Status");
});

test("TC-CSV-02: CSV cells are escaped and spreadsheet formulas are neutralized", async () => {
    const res = await admin.get("/api/messages/export?q=csv%40example.com");
    assert.ok(res.text.includes(`"'=HYPERLINK(""http://evil"")"`), "formula cell starts with ' and quotes are doubled");
    assert.ok(res.text.includes(`"Comma, ""quote"""`), "commas and quotes are quoted");
    assert.ok(res.text.includes('"line1\nline2"'), "line breaks stay inside one quoted cell");
});

test("TC-CSV-03: results export includes score, total and fixes", async () => {
    const res = await admin.get("/api/results/export?riskLevel=Low");
    const lines = res.text.slice(1).trim().split("\r\n");
    assert.equal(lines[0], "Date,Risk Level,Score,Out Of,Fixes Needed");
    assert.equal(lines.length - 1, 4, "4 Low results");
});

test("TC-STAT-01: stats add up correctly", async () => {
    const res = await admin.get("/api/stats");
    const a = res.data.assessments;
    assert.equal(a.total, 12);
    assert.deepEqual(a.byLevel, { Low: 4, Medium: 4, High: 4 });
    // scores 10,9,8,8,7,6,5,5,4,3,1,0 = 66 of 120 = 55%
    assert.equal(a.averagePercent, 55);
    assert.equal(a.last14Days.length, 14);
    assert.equal(a.last14Days.at(-1).count, 12, "all 12 taken today");
    assert.equal(res.data.messages.total, 12); // 13 sent, 1 deleted in TC-MSG-04
});

test("TC-STAT-02: per-question fail rates are counted and sorted", async () => {
    const res = await admin.get("/api/stats");
    const q = res.data.questions;
    assert.equal(q.length, 10);
    assert.ok(q.every(item => item.answered === 12));
    const rates = q.map(item => item.failRate);
    assert.deepEqual(rates, [...rates].sort((x, y) => y - x));
    // answersWithScore(s) fails the first 10-s questions, so q1 fails most often
    assert.equal(q[0].id, "q1");
});

test("TC-QST-01: admins can add, edit, reorder and delete questions", async () => {
    const created = await admin.post("/api/questions", { text: "Do you use a VPN on public Wi-Fi?", safeAnswer: "yes", fix: "Use a VPN on public Wi-Fi." });
    assert.equal(created.status, 201);
    const id = created.data.id;

    assert.equal((await admin.patch("/api/questions/" + id, { safeAnswer: "no" })).status, 200);
    assert.equal((await admin.post(`/api/questions/${id}/move`, { direction: "up" })).status, 200);
    const publicList = (await web.get("/api/questions")).data;
    assert.equal(publicList.length, 11);
    assert.equal(publicList[9].id, id, "moved up one place");

    assert.equal((await admin.delete("/api/questions/" + id)).status, 200);
    assert.equal((await web.get("/api/questions")).data.length, 10);
});

test("TC-QST-02: question validation", async () => {
    const cases = [
        [{ text: "x", safeAnswer: "yes" }, "missing fix"],
        [{ text: "x", safeAnswer: "maybe", fix: "y" }, "bad safe answer"],
        [{ text: "a".repeat(201), safeAnswer: "yes", fix: "y" }, "text too long"],
        [{ text: 5, safeAnswer: "yes", fix: "y" }, "text not a string"]
    ];
    for (const [body, name] of cases) assert.equal((await admin.post("/api/questions", body)).status, 400, name);
    assert.equal((await admin.patch("/api/questions/q1", {})).status, 400, "empty edit");
    assert.equal((await admin.patch("/api/questions/nope", { text: "x" })).status, 404);
    assert.equal((await admin.post("/api/questions/q1/move", { direction: "up" })).status, 400, "already at top");
    assert.equal((await admin.post("/api/questions/q1/move", { direction: "left" })).status, 400);
});

test("TC-QST-03: scoring follows edited questions; stale answer sets are rejected", async () => {
    const created = await admin.post("/api/questions", { text: "Is WPS turned off?", safeAnswer: "yes", fix: "Turn off WPS." });
    const id = created.data.id;
    try {
        const stale = await web.post("/save-result", { answers: answersWithScore(10) });
        assert.equal(stale.status, 400, "a page opened before the change must reload");

        const res = await web.post("/save-result", { answers: { ...answersWithScore(10), [id]: "no" } });
        assert.equal(res.data.total, 11);
        assert.equal(res.data.score, 10);
        assert.equal(res.data.riskLevel, "Low", "10/11 = 91%");
        assert.deepEqual(res.data.checklist, ["Turn off WPS."]);
    } finally {
        await admin.delete("/api/questions/" + id);
    }
});

test("TC-QST-04: the last question can't be deleted", async () => {
    const ids = (await admin.get("/api/questions/full")).data.map(q => q.id);
    for (const id of ids.slice(1)) await admin.delete("/api/questions/" + id);
    const last = await admin.delete("/api/questions/" + ids[0]);
    assert.equal(last.status, 400);
    assert.match(last.data.error, /at least one question/);
});

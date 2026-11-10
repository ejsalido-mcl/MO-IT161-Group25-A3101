// EXTERNAL TEST: brute-force and spam protection, checked over real HTTP.
// Kept in its own file because the limits are set before the app loads.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "netguard-rl-"));
process.env.DATA_DIR = dataDir;
process.env.ADMIN_PASSWORD = "test-password";
process.env.LOGIN_MAX = "3";
process.env.CONTACT_MAX = "2";
process.env.RESULT_MAX = "2";

const app = require("../app");
let server;
let base;

before(async () => {
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
});

function post(url, body) {
    return fetch(base + url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

test("login is blocked after too many attempts (brute-force protection)", async () => {
    for (let i = 0; i < 3; i++) {
        assert.equal((await post("/login", { password: "wrong" })).status, 401);
    }
    const blocked = await post("/login", { password: "test-password" }); // even the right password
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
});

test("contact form is blocked after too many messages (spam protection)", async () => {
    const msg = { name: "Spammer", email: "spam@example.com", message: "Buy my stuff please now" };
    assert.equal((await post("/contact", msg)).status, 200);
    assert.equal((await post("/contact", msg)).status, 200);
    assert.equal((await post("/contact", msg)).status, 429);
});

test("save-result is blocked after too many submissions", async () => {
    const result = { riskLevel: "Low", score: 9 };
    assert.equal((await post("/save-result", result)).status, 200);
    assert.equal((await post("/save-result", result)).status, 200);
    assert.equal((await post("/save-result", result)).status, 429);
});

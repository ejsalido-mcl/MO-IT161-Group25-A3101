/* Pages, file protection, security headers and error handling */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, Client } = require("./helpers");

let server;
let web;

before(async () => {
    server = await startServer();
    web = new Client(server.url);
});
after(() => server.stop());

test("TC-PAGE-01: every public page loads (200, HTML)", async () => {
    for (const url of ["/", "/assessment", "/about", "/contact", "/login", "/result",
        "/index.html", "/style.css", "/script.js", "/images/shield.svg"]) {
        const res = await web.get(url);
        assert.equal(res.status, 200, url);
    }
});

test("TC-PAGE-02: protected pages redirect to login when logged out", async () => {
    for (const url of ["/admin", "/change-password"]) {
        const res = await web.get(url);
        assert.equal(res.status, 302, url);
        assert.equal(res.headers.get("location"), "/login");
    }
});

test("TC-SEC-01: server files and data files cannot be downloaded", async () => {
    for (const url of ["/app.js", "/admin-accounts.js", "/package.json", "/.env", "/.env.example",
        "/messages.json", "/results.json", "/questions.json", "/admins.json",
        "/private/admin.html", "/admin.html", "/change-password.html"]) {
        const res = await web.get(url);
        assert.equal(res.status, 404, url);
    }
});

test("TC-SEC-02: path traversal attempts are blocked", async () => {
    for (const url of ["/..%2fapp.js", "/%2e%2e/messages.json", "/images/..%2f..%2fadmins.json", "/..%5capp.js"]) {
        const res = await web.get(url);
        assert.ok([400, 403, 404].includes(res.status), `${url} -> ${res.status}`);
        assert.ok(!res.text.includes("require("), `${url} leaked source code`);
    }
});

test("TC-SEC-03: security headers are set and X-Powered-By is hidden", async () => {
    const res = await web.get("/");
    assert.equal(res.headers.get("x-powered-by"), null);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("referrer-policy"), "same-origin");
});

test("TC-ERR-01: malformed JSON returns a clean 400 without a stack trace", async () => {
    const res = await web.request("POST", "/contact", { body: '{"name":', headers: { "content-type": "application/json" } });
    assert.equal(res.status, 400);
    assert.deepEqual(res.data, { error: "Request body is not valid JSON." });
    assert.ok(!/at |node_modules|C:\\|\/home\//.test(res.text), "error leaked internals");
});

test("TC-ERR-02: requests over 10 KB are rejected with 413", async () => {
    const res = await web.post("/contact", { name: "a", email: "a@b.co", message: "x".repeat(20000) });
    assert.equal(res.status, 413);
    assert.equal(res.data.error, "Request is too large.");
});

test("TC-ERR-03: unknown API routes return JSON 404", async () => {
    const res = await web.get("/api/does-not-exist");
    assert.equal(res.status, 404);
    assert.deepEqual(res.data, { error: "Not found." });
});

test("TC-ERR-04: requests with no body never crash the server (no 500s)", async () => {
    for (const url of ["/contact", "/save-result", "/login"]) {
        const res = await web.request("POST", url);
        assert.equal(res.status, 400, url);
        assert.ok(res.data && res.data.error, `${url} should explain the error`);
    }
});

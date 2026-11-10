// EXTERNAL TESTS: talk to the running backend over HTTP, like a browser or Postman would.
// Uses its own temporary data folder, so your real messages.json / results.json are never touched.
// Run with:  node --test tests/

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Set up the environment BEFORE loading the app
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "netguard-test-"));
process.env.DATA_DIR = dataDir;
process.env.ADMIN_PASSWORD = "test-password";
process.env.CONTACT_MAX = "1000";   // don't let the rate limiter get in the way here
process.env.RESULT_MAX = "1000";
process.env.LOGIN_MAX = "1000";

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

// Small helper: send a request and return { status, headers, json, text }
async function call(method, url, { body, cookie, raw } = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    let payload;
    if (raw !== undefined) {
        headers["Content-Type"] = "application/json";
        payload = raw;
    } else if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
    }
    const res = await fetch(base + url, { method, headers, body: payload, redirect: "manual" });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
    return { status: res.status, headers: res.headers, json, text };
}

async function loginCookie() {
    const res = await fetch(base + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "test-password" })
    });
    assert.equal(res.status, 200);
    return res.headers.get("set-cookie").split(";")[0];
}

const goodContact = {
    name: "Juan Dela Cruz",
    email: "juan@example.com",
    subject: "Router help",
    message: "My router keeps disconnecting."
};

describe("pages and static files", () => {
    test("home page loads", async () => {
        const r = await call("GET", "/");
        assert.equal(r.status, 200);
        assert.match(r.text, /NetGuard/);
    });

    test("public pages load", async () => {
        for (const page of ["/assessment", "/about", "/contact", "/login", "/style.css", "/script.js"]) {
            const r = await call("GET", page);
            assert.equal(r.status, 200, page);
        }
    });

    test("server code and data files are NOT downloadable", async () => {
        for (const file of ["/app.js", "/messages.json", "/results.json", "/package.json", "/validators.js", "/private/admin.html"]) {
            const r = await call("GET", file);
            assert.equal(r.status, 404, file);
        }
    });

    test("path traversal does not expose files", async () => {
        const r = await call("GET", "/%2e%2e/app.js");
        assert.notEqual(r.status, 200);
        assert.doesNotMatch(r.text, /require\("express"\)/);
    });

    test("security headers are set and X-Powered-By is hidden", async () => {
        const r = await call("GET", "/");
        assert.equal(r.headers.get("x-content-type-options"), "nosniff");
        assert.equal(r.headers.get("x-frame-options"), "DENY");
        assert.equal(r.headers.get("x-powered-by"), null);
    });

    test("unknown API route answers 404 as JSON", async () => {
        const r = await call("GET", "/api/does-not-exist");
        assert.equal(r.status, 404);
        assert.ok(r.json && r.json.error);
    });
});

describe("admin authentication", () => {
    test("admin page redirects to login when not logged in", async () => {
        const r = await call("GET", "/admin");
        assert.equal(r.status, 302);
        assert.match(r.headers.get("location"), /\/login/);
    });

    test("protected API routes answer 401 without login", async () => {
        for (const [method, url] of [
            ["GET", "/api/messages"], ["GET", "/api/results"],
            ["PATCH", "/api/messages/abc"], ["DELETE", "/api/messages/abc"]
        ]) {
            const r = await call(method, url, { body: { status: "resolved" } });
            assert.equal(r.status, 401, `${method} ${url}`);
        }
    });

    test("wrong password is rejected", async () => {
        const r = await call("POST", "/login", { body: { password: "wrong" } });
        assert.equal(r.status, 401);
    });

    test("login with no body or a non-text password is rejected (no crash)", async () => {
        assert.equal((await call("POST", "/login", { body: {} })).status, 401);
        assert.equal((await call("POST", "/login", { body: { password: { a: 1 } } })).status, 401);
        assert.equal((await call("POST", "/login")).status, 401);
    });

    test("correct password logs in, session cookie is HttpOnly + SameSite=Strict", async () => {
        const res = await fetch(base + "/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: "test-password" })
        });
        assert.equal(res.status, 200);
        const cookie = res.headers.get("set-cookie");
        assert.match(cookie, /HttpOnly/i);
        assert.match(cookie, /SameSite=Strict/i);
    });

    test("logged-in admin can open the API, and logout ends the session", async () => {
        const cookie = await loginCookie();
        assert.equal((await call("GET", "/api/messages", { cookie })).status, 200);
        assert.equal((await call("GET", "/admin", { cookie })).status, 200);

        assert.equal((await call("POST", "/logout", { cookie })).status, 200);
        assert.equal((await call("GET", "/api/messages", { cookie })).status, 401);
    });
});

describe("POST /contact", () => {
    test("valid message is saved and shows up for the admin as 'new'", async () => {
        const r = await call("POST", "/contact", { body: { ...goodContact, name: "  Maria  " } });
        assert.equal(r.status, 200);

        const cookie = await loginCookie();
        const list = (await call("GET", "/api/messages", { cookie })).json;
        const saved = list.find((m) => m.name === "Maria");
        assert.ok(saved, "message should be in the list");
        assert.equal(saved.status, "new");
        assert.equal(saved.email, "juan@example.com");
        assert.ok(saved.id);
    });

    test("invalid input answers 400 and saves nothing", async () => {
        const cookie = await loginCookie();
        const before = (await call("GET", "/api/messages", { cookie })).json.length;

        const badBodies = [
            {},
            { ...goodContact, name: "" },
            { ...goodContact, name: 123 },                       // used to crash the server
            { ...goodContact, email: "not-an-email" },
            { ...goodContact, message: "short" },
            { ...goodContact, message: "m".repeat(501) },
            { ...goodContact, subject: 42 },
            { ...goodContact, message: ["array", "not", "text"] }
        ];
        for (const body of badBodies) {
            const r = await call("POST", "/contact", { body });
            assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
            assert.ok(r.json && r.json.details, "should explain which field is wrong");
        }

        const after = (await call("GET", "/api/messages", { cookie })).json.length;
        assert.equal(after, before);
    });

    test("malformed JSON answers 400 as JSON (no stack trace)", async () => {
        const r = await call("POST", "/contact", { raw: "{this is not json" });
        assert.equal(r.status, 400);
        assert.deepEqual(r.json, { error: "Invalid JSON." });
        assert.doesNotMatch(r.text, /at .*\.js:\d+/);
    });

    test("oversized body answers 413", async () => {
        const r = await call("POST", "/contact", { body: { ...goodContact, message: "x".repeat(20000) } });
        assert.equal(r.status, 413);
    });

    test("script tags are stored as plain text, not changed or run", async () => {
        const evil = "<script>alert('xss')</script> please help";
        await call("POST", "/contact", { body: { ...goodContact, name: "Evil Tester", message: evil } });
        const cookie = await loginCookie();
        const list = (await call("GET", "/api/messages", { cookie })).json;
        const saved = list.find((m) => m.name === "Evil Tester");
        assert.equal(saved.message, evil);
        // The dashboard (script.js) escapes this with escapeHTML() before showing it.
    });
});

describe("message management (PATCH / DELETE)", () => {
    test("admin can mark resolved, and it is saved", async () => {
        await call("POST", "/contact", { body: { ...goodContact, name: "Patch Person" } });
        const cookie = await loginCookie();
        const msg = (await call("GET", "/api/messages", { cookie })).json.find((m) => m.name === "Patch Person");

        const r = await call("PATCH", `/api/messages/${msg.id}`, { cookie, body: { status: "resolved" } });
        assert.equal(r.status, 200);

        const again = (await call("GET", "/api/messages", { cookie })).json.find((m) => m.id === msg.id);
        assert.equal(again.status, "resolved");
    });

    test("invalid status answers 400, unknown id answers 404", async () => {
        const cookie = await loginCookie();
        const msg = (await call("GET", "/api/messages", { cookie })).json[0];
        assert.equal((await call("PATCH", `/api/messages/${msg.id}`, { cookie, body: { status: "banana" } })).status, 400);
        assert.equal((await call("PATCH", `/api/messages/${msg.id}`, { cookie })).status, 400);
        assert.equal((await call("PATCH", "/api/messages/not-a-real-id", { cookie, body: { status: "new" } })).status, 404);
    });

    test("admin can delete a message; deleting it again gives 404", async () => {
        await call("POST", "/contact", { body: { ...goodContact, name: "Delete Me" } });
        const cookie = await loginCookie();
        const msg = (await call("GET", "/api/messages", { cookie })).json.find((m) => m.name === "Delete Me");

        assert.equal((await call("DELETE", `/api/messages/${msg.id}`, { cookie })).status, 200);
        assert.equal((await call("DELETE", `/api/messages/${msg.id}`, { cookie })).status, 404);
        const list = (await call("GET", "/api/messages", { cookie })).json;
        assert.equal(list.some((m) => m.id === msg.id), false);
    });
});

describe("POST /save-result", () => {
    test("valid result is saved and visible to the admin", async () => {
        const cookie = await loginCookie();
        const before = (await call("GET", "/api/results", { cookie })).json.length;

        assert.equal((await call("POST", "/save-result", { body: { riskLevel: "Low", score: 9 } })).status, 200);
        assert.equal((await call("POST", "/save-result", { body: { riskLevel: "Medium", score: 6 } })).status, 200);
        assert.equal((await call("POST", "/save-result", { body: { riskLevel: "High", score: 2 } })).status, 200);

        const list = (await call("GET", "/api/results", { cookie })).json;
        assert.equal(list.length, before + 3);
        assert.deepEqual(list.at(-1).riskLevel, "High");
    });

    test("invalid results answer 400 and save nothing", async () => {
        const cookie = await loginCookie();
        const before = (await call("GET", "/api/results", { cookie })).json.length;

        const bad = [
            {},
            { riskLevel: "Critical", score: 9 },
            { riskLevel: "Low", score: 11 },
            { riskLevel: "High", score: -1 },
            { riskLevel: "Medium", score: 5.5 },
            { riskLevel: "Low", score: "9" },
            { riskLevel: "Low" },
            { score: 9 },
            { riskLevel: "Low", score: 2 },    // level does not match the score
            { riskLevel: "High", score: 10 }
        ];
        for (const body of bad) {
            const r = await call("POST", "/save-result", { body });
            assert.equal(r.status, 400, JSON.stringify(body));
        }

        const after = (await call("GET", "/api/results", { cookie })).json.length;
        assert.equal(after, before);
    });
});

describe("data file safety", () => {
    test("a corrupted results.json does not crash the server; a backup is kept", async () => {
        const cookie = await loginCookie();
        fs.writeFileSync(path.join(dataDir, "results.json"), "{ this is broken");

        const r = await call("GET", "/api/results", { cookie });
        assert.equal(r.status, 200);
        assert.deepEqual(r.json, []);

        const backups = fs.readdirSync(dataDir).filter((f) => f.startsWith("results.json.broken-"));
        assert.ok(backups.length >= 1, "a .broken-* backup should exist");

        // ...and the server keeps working afterwards
        assert.equal((await call("POST", "/save-result", { body: { riskLevel: "Low", score: 10 } })).status, 200);
    });
});

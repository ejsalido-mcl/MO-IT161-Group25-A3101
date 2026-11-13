/* ============================================
   NetGuard — test helpers

   Every test file starts its OWN server:
   - on a free port (PORT=0)
   - with a fresh temporary data folder (DATA_DIR), so tests never
     touch the real messages.json / results.json / admins.json
   - with emails in dry-run mode (printed, never sent)
   The server and its data folder are removed when the file finishes.
   ============================================ */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const APP = path.join(__dirname, "..", "app.js");
const STARTING_PASSWORD = "netguard-admin";
const TEST_PASSWORD = "Test#Passw0rd!";

// The default questions' safe answers (q2 and q3 are safe when answered "no")
const SAFE = { q1: "yes", q2: "no", q3: "no", q4: "yes", q5: "yes", q6: "yes", q7: "yes", q8: "yes", q9: "yes", q10: "yes" };

/**
 * Starts a server. Options:
 *   seed: { "results.json": [...], ... } files to create before starting
 *   env:  extra environment variables
 * Returns { url, dataDir, output(), read(file), stop() }
 */
async function startServer({ seed = {}, env = {} } = {}) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "netguard-test-"));
    for (const [file, content] of Object.entries(seed)) {
        fs.writeFileSync(path.join(dataDir, file), typeof content === "string" ? content : JSON.stringify(content, null, 2));
    }

    const child = spawn(process.execPath, [APP], {
        env: {
            ...process.env,
            PORT: "0",
            DATA_DIR: dataDir,
            MAIL_DRY_RUN: "true",
            NOTIFY_EMAIL: "alerts@netguard.test",
            SMTP_HOST: "",
            ADMIN_PASSWORD: "",
            INITIAL_ADMINS: "",
            SESSION_SECRET: "test-secret",
            ...env
        },
        stdio: ["ignore", "pipe", "pipe"]
    });

    let log = "";
    child.stdout.on("data", chunk => { log += chunk; });
    child.stderr.on("data", chunk => { log += chunk; });

    const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Server did not start in time:\n" + log)), 15000);
        const check = () => {
            const match = log.match(/running on port (\d+)/);
            if (match) {
                clearTimeout(timer);
                resolve(Number(match[1]));
            }
        };
        child.stdout.on("data", check);
        child.on("exit", code => {
            clearTimeout(timer);
            reject(new Error(`Server exited with code ${code}:\n${log}`));
        });
    });

    return {
        url: `http://127.0.0.1:${port}`,
        dataDir,
        output: () => log,
        read: file => JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8")),
        async stop() {
            if (child.exitCode === null) {
                const exited = new Promise(resolve => child.once("exit", resolve));
                child.kill();
                await exited;
            }
            fs.rmSync(dataDir, { recursive: true, force: true });
        }
    };
}

/**
 * Starts the server expecting it to FAIL (e.g. a damaged admins.json).
 * Resolves with { code, log } when it exits.
 */
function runServerExpectingExit({ seed = {}, env = {} } = {}) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "netguard-test-"));
    for (const [file, content] of Object.entries(seed)) {
        fs.writeFileSync(path.join(dataDir, file), typeof content === "string" ? content : JSON.stringify(content));
    }
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [APP], {
            env: { ...process.env, PORT: "0", DATA_DIR: dataDir, MAIL_DRY_RUN: "true", INITIAL_ADMINS: "", ...env },
            stdio: ["ignore", "pipe", "pipe"]
        });
        let log = "";
        child.stdout.on("data", c => { log += c; });
        child.stderr.on("data", c => { log += c; });
        const timer = setTimeout(() => { child.kill(); reject(new Error("Server kept running:\n" + log)); }, 15000);
        child.on("exit", code => {
            clearTimeout(timer);
            const fileAfter = fs.existsSync(path.join(dataDir, "admins.json"))
                ? fs.readFileSync(path.join(dataDir, "admins.json"), "utf8") : null;
            fs.rmSync(dataDir, { recursive: true, force: true });
            resolve({ code, log, fileAfter });
        });
    });
}

/** A tiny HTTP client that keeps its own session cookie, like one browser. */
class Client {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.cookie = "";
    }

    async request(method, url, { json, body, headers = {} } = {}) {
        const sendHeaders = { ...headers };
        if (this.cookie) sendHeaders.cookie = this.cookie;
        let payload = body;
        // GET/HEAD requests can't carry a body
        if (json !== undefined && method !== "GET" && method !== "HEAD") {
            sendHeaders["content-type"] = "application/json";
            payload = JSON.stringify(json);
        }
        const res = await fetch(this.baseUrl + url, { method, headers: sendHeaders, body: payload, redirect: "manual" });
        for (const cookie of res.headers.getSetCookie()) {
            const pair = cookie.split(";")[0];
            if (pair.startsWith("connect.sid=")) this.cookie = pair;
        }
        // Decode ourselves so a byte-order mark (BOM) at the start is kept, not silently dropped
        const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await res.arrayBuffer());
        let data = null;
        try { data = JSON.parse(text); } catch { /* not JSON */ }
        return { status: res.status, headers: res.headers, text, data };
    }

    get(url, options) { return this.request("GET", url, options); }
    post(url, json, options) { return this.request("POST", url, { json, ...options }); }
    patch(url, json, options) { return this.request("PATCH", url, { json, ...options }); }
    delete(url, options) { return this.request("DELETE", url, options); }
}

/** Logs in; returns the client and the login response. */
async function login(server, username, password) {
    const client = new Client(server.url);
    const res = await client.post("/login", { username, password });
    return { client, res };
}

/**
 * A ready-to-use admin client. The first call logs in as "roi" with the
 * starting password and completes the forced password change; later
 * calls just log in with the new password.
 */
async function adminClient(server) {
    if (!server.adminReady) {
        const { client, res } = await login(server, "roi", STARTING_PASSWORD);
        if (res.status !== 200) throw new Error("Admin login failed: " + res.text);
        const changed = await client.post("/api/me/password", { currentPassword: STARTING_PASSWORD, newPassword: TEST_PASSWORD });
        if (changed.status !== 200) throw new Error("Password change failed: " + changed.text);
        server.adminReady = true;
        return client;
    }
    const { client, res } = await login(server, "roi", TEST_PASSWORD);
    if (res.status !== 200) throw new Error("Admin login failed: " + res.text);
    return client;
}

/** Answers that score exactly `score` out of 10 on the default questions. */
function answersWithScore(score) {
    const ids = Object.keys(SAFE);
    const answers = {};
    ids.forEach((id, index) => {
        const safe = SAFE[id];
        answers[id] = index < ids.length - score ? (safe === "yes" ? "no" : "yes") : safe;
    });
    return answers;
}

module.exports = {
    STARTING_PASSWORD,
    TEST_PASSWORD,
    SAFE,
    startServer,
    runServerExpectingExit,
    Client,
    login,
    adminClient,
    answersWithScore
};

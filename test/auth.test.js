/* Admin accounts: login, forced password change, sessions, account management, CLI */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { startServer, runServerExpectingExit, Client, login, adminClient, STARTING_PASSWORD, TEST_PASSWORD } = require("./helpers");

let server;

before(async () => { server = await startServer(); });
after(() => server.stop());

test("TC-AUTH-01: first run creates roi, evan, lenard, hady with hashed passwords", () => {
    const admins = server.read("admins.json");
    assert.deepEqual(admins.map(a => a.username), ["roi", "evan", "lenard", "hady"]);
    for (const admin of admins) {
        assert.match(admin.passwordHash, /^scrypt\$16384\$8\$1\$/);
        assert.equal(admin.mustChangePassword, true);
    }
    assert.ok(!JSON.stringify(admins).includes(STARTING_PASSWORD), "plain password must never be stored");
});

test("TC-AUTH-02: wrong username and wrong password give the same answer", async () => {
    const unknown = await login(server, "ghost", "whatever123");
    const wrong = await login(server, "evan", "wrong-password");
    assert.equal(unknown.res.status, 401);
    assert.equal(wrong.res.status, 401);
    assert.deepEqual(unknown.res.data, wrong.res.data);
});

test("TC-AUTH-03: login input is validated", async () => {
    for (const body of [{}, { username: "roi" }, { password: "x" }, { username: ["roi"], password: STARTING_PASSWORD },
        { username: "roi", password: [STARTING_PASSWORD] }]) {
        const res = await new Client(server.url).post("/login", body);
        assert.equal(res.status, 400, JSON.stringify(body));
    }
});

test("TC-AUTH-04: usernames are not case-sensitive", async () => {
    const { res } = await login(server, "  EVAN ", STARTING_PASSWORD);
    assert.equal(res.status, 200);
    assert.equal(res.data.username, "evan");
});

test("TC-AUTH-05: first login must change the password before anything else", async () => {
    const { client, res } = await login(server, "lenard", STARTING_PASSWORD);
    assert.equal(res.data.mustChangePassword, true);

    const page = await client.get("/admin");
    assert.equal(page.status, 302);
    assert.equal(page.headers.get("location"), "/change-password");
    assert.equal((await client.get("/change-password")).status, 200);

    for (const [method, url] of [["GET", "/api/messages"], ["GET", "/api/stats"], ["GET", "/api/admins"],
        ["POST", "/api/questions"], ["DELETE", "/api/questions/q1"]]) {
        const blocked = await client.request(method, url, { json: {} });
        assert.equal(blocked.status, 403, `${method} ${url}`);
        assert.equal(blocked.data.mustChangePassword, true);
    }
    assert.equal((await client.get("/api/me")).status, 200);
});

test("TC-AUTH-06: new passwords must follow the rules", async () => {
    const { client } = await login(server, "hady", STARTING_PASSWORD);
    const cases = {
        "too short": "abc123",
        "contains username": "hady-secure-99",
        "the starting password": STARTING_PASSWORD,
        "too long": "x".repeat(129)
    };
    for (const [name, newPassword] of Object.entries(cases)) {
        const res = await client.post("/api/me/password", { currentPassword: STARTING_PASSWORD, newPassword });
        assert.equal(res.status, 400, name);
    }
    const wrongCurrent = await client.post("/api/me/password", { currentPassword: "not-it-123", newPassword: "Valid#Pass2026" });
    assert.equal(wrongCurrent.status, 400);
    assert.equal(wrongCurrent.data.error, "Your current password is wrong.");
});

test("TC-AUTH-07: after changing the password the dashboard opens; old password stops working", async () => {
    const { client } = await login(server, "evan", STARTING_PASSWORD);
    const other = (await login(server, "evan", STARTING_PASSWORD)).client;

    const res = await client.post("/api/me/password", { currentPassword: STARTING_PASSWORD, newPassword: "Blue#Secure2026" });
    assert.equal(res.status, 200);
    assert.equal((await client.get("/admin")).status, 200);
    assert.equal((await client.get("/api/stats")).status, 200);
    assert.equal((await other.get("/api/me")).status, 401, "other sessions are logged out");
    assert.equal((await login(server, "evan", STARTING_PASSWORD)).res.status, 401);
    assert.equal((await login(server, "evan", "Blue#Secure2026")).res.status, 200);
});

test("TC-AUTH-08: admins can add accounts, which must also change their password", async () => {
    const admin = await adminClient(server);
    const bad = [
        [{ username: "ab", password: STARTING_PASSWORD }, 400],
        [{ username: "has space", password: STARTING_PASSWORD }, 400],
        [{ username: "newbie", password: "short" }, 400],
        [{ username: "ROI", password: STARTING_PASSWORD }, 409]
    ];
    for (const [body, status] of bad) assert.equal((await admin.post("/api/admins", body)).status, status, JSON.stringify(body));

    const created = await admin.post("/api/admins", { username: "Newbie", password: STARTING_PASSWORD });
    assert.equal(created.status, 201);
    assert.equal(created.data.username, "newbie");
    assert.equal(created.data.passwordHash, undefined);
    const { res } = await login(server, "newbie", STARTING_PASSWORD);
    assert.equal(res.data.mustChangePassword, true);
});

test("TC-AUTH-09: account list never exposes password hashes", async () => {
    const admin = await adminClient(server);
    const res = await admin.get("/api/admins");
    assert.equal(res.status, 200);
    assert.ok(!res.text.includes("scrypt$"));
    assert.equal(res.data.filter(a => a.isYou).length, 1);
});

test("TC-AUTH-10: deleting an account ends its sessions; you can't delete yourself", async () => {
    const admin = await adminClient(server);
    const me = (await admin.get("/api/me")).data;
    assert.equal((await admin.delete("/api/admins/" + me.id)).status, 400);

    const victim = (await login(server, "newbie", STARTING_PASSWORD)).client;
    const id = (await admin.get("/api/admins")).data.find(a => a.username === "newbie").id;
    assert.equal((await admin.delete("/api/admins/" + id)).status, 200);
    assert.equal((await victim.get("/api/me")).status, 401);
    assert.equal((await admin.delete("/api/admins/" + id)).status, 404);
});

test("TC-AUTH-11: logout ends the session", async () => {
    const admin = await adminClient(server);
    assert.equal((await admin.post("/logout")).status, 200);
    assert.equal((await admin.get("/api/me")).status, 401);
});

test("TC-AUTH-12: CLI resets a forgotten password and forces a new one", async () => {
    const logged = await adminClient(server);
    const result = spawnSync(process.execPath, [path.join(__dirname, "..", "manage-admins.js"), "reset-password", "roi"], {
        input: "\n", // Enter = use the starting password
        env: { ...process.env, DATA_DIR: server.dataDir },
        encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /reset/);
    assert.equal((await logged.get("/api/me")).status, 401, "reset logs the user out");
    const { res } = await login(server, "roi", STARTING_PASSWORD);
    assert.equal(res.data.mustChangePassword, true);
    server.adminReady = false; // roi is back to the starting password
});

test("TC-AUTH-13: a damaged admins.json stops the server instead of resetting accounts", async () => {
    const { code, log, fileAfter } = await runServerExpectingExit({ seed: { "admins.json": "{ broken" } });
    assert.equal(code, 1);
    assert.match(log, /Could not load admin accounts/);
    assert.equal(fileAfter, "{ broken", "the damaged file must be left untouched");
});

test("TC-AUTH-14: 5 wrong passwords lock the login for that IP (brute-force protection)", async () => {
    const fresh = await startServer();
    try {
        for (let i = 1; i <= 5; i++) {
            assert.equal((await login(fresh, "roi", "guess-" + i)).res.status, 401, `attempt ${i}`);
        }
        const locked = await login(fresh, "roi", STARTING_PASSWORD);
        assert.equal(locked.res.status, 429, "even the right password is refused while locked");
        assert.match(locked.res.data.error, /Too many failed attempts/);
    } finally {
        await fresh.stop();
    }
});

test("TC-AUTH-15: a successful login resets the failed-attempt counter", async () => {
    const fresh = await startServer();
    try {
        for (let i = 1; i <= 4; i++) await login(fresh, "roi", "guess-" + i);
        assert.equal((await login(fresh, "roi", STARTING_PASSWORD)).res.status, 200);
        for (let i = 1; i <= 4; i++) {
            assert.equal((await login(fresh, "roi", "again-" + i)).res.status, 401);
        }
    } finally {
        await fresh.stop();
    }
});

// keep TEST_PASSWORD referenced for readers: adminClient() uses it as roi's password
void TEST_PASSWORD;

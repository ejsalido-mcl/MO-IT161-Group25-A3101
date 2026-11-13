/* Contact form: validation, boundaries, storage and email notification */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, Client } = require("./helpers");

let server;
let web;
const valid = { name: "Juan Dela Cruz", email: "juan@example.com", subject: "Router help", message: "How do I enable WPA3?" };

before(async () => {
    server = await startServer();
    web = new Client(server.url);
});
after(() => server.stop());

test("TC-CON-01: a valid message is saved as 'new' with a timestamp", async () => {
    const res = await web.post("/contact", valid);
    assert.equal(res.status, 200);
    const saved = server.read("messages.json").at(-1);
    assert.equal(saved.name, valid.name);
    assert.equal(saved.status, "new");
    assert.ok(saved.id && saved.createdAt);
});

test("TC-CON-02: subject is optional; text is trimmed", async () => {
    const res = await web.post("/contact", { name: "  Ana  ", email: " ana@example.com ", message: "  hi  " });
    assert.equal(res.status, 200);
    const saved = server.read("messages.json").at(-1);
    assert.equal(saved.name, "Ana");
    assert.equal(saved.email, "ana@example.com");
    assert.equal(saved.subject, "");
    assert.equal(saved.message, "hi");
});

test("TC-CON-03: required fields are enforced", async () => {
    for (const field of ["name", "email", "message"]) {
        const missing = { ...valid };
        delete missing[field];
        assert.equal((await web.post("/contact", missing)).status, 400, `missing ${field}`);
        assert.equal((await web.post("/contact", { ...valid, [field]: "   " })).status, 400, `blank ${field}`);
    }
});

test("TC-CON-04: invalid email addresses are rejected", async () => {
    for (const email of ["not-an-email", "a@b", "@example.com", "a b@example.com", "a@@example.com"]) {
        const res = await web.post("/contact", { ...valid, email });
        assert.equal(res.status, 400, email);
        assert.equal(res.data.error, "Invalid email address.", email);
    }
});

test("TC-CON-05: non-text values are rejected instead of crashing", async () => {
    for (const bad of [123, true, ["x"], { a: 1 }]) {
        const res = await web.post("/contact", { ...valid, name: bad });
        assert.equal(res.status, 400, JSON.stringify(bad));
        assert.equal(res.data.error, "The name field must be text.");
    }
});

test("TC-CON-06: length limits accept the maximum and reject one more (boundary)", async () => {
    const limits = { name: 100, subject: 150, message: 2000 };
    for (const [field, max] of Object.entries(limits)) {
        assert.equal((await web.post("/contact", { ...valid, [field]: "a".repeat(max) })).status, 200, `${field} = ${max}`);
        const over = await web.post("/contact", { ...valid, [field]: "a".repeat(max + 1) });
        assert.equal(over.status, 400, `${field} = ${max + 1}`);
        assert.match(over.data.error, /too long/);
    }
});

test("TC-CON-07: script tags are stored as plain text (escaped when displayed)", async () => {
    const res = await web.post("/contact", { ...valid, name: "<script>alert(1)</script>" });
    assert.equal(res.status, 200);
    assert.equal(server.read("messages.json").at(-1).name, "<script>alert(1)</script>");
});

test("TC-MAIL-01: a new message triggers a plain-text email to the admin", async () => {
    await web.post("/contact", { ...valid, subject: "Email check", message: "Please reply" });
    await new Promise(resolve => setTimeout(resolve, 300));
    const log = server.output();
    assert.match(log, /DRY RUN email/);
    const email = JSON.parse(log.slice(log.lastIndexOf("DRY RUN email:") + "DRY RUN email:".length).trim().split("\n")[0]);
    assert.equal(email.to[0].address, "alerts@netguard.test");
    assert.equal(email.replyTo[0].address, valid.email);
    assert.equal(email.subject, "New NetGuard message: Email check");
    assert.match(email.text, /Please reply/);
    assert.equal(email.html, undefined, "email must be plain text only");
});

test("TC-MAIL-02: line breaks in the subject can't inject email headers", async () => {
    await web.post("/contact", { ...valid, subject: "Hi\r\nBcc: evil@example.com" });
    await new Promise(resolve => setTimeout(resolve, 300));
    const log = server.output();
    const email = JSON.parse(log.slice(log.lastIndexOf("DRY RUN email:") + "DRY RUN email:".length).trim().split("\n")[0]);
    assert.equal(email.subject, "New NetGuard message: Hi Bcc: evil@example.com");
    assert.equal(email.bcc, undefined);
});

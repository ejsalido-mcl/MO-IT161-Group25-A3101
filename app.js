const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
<<<<<<< HEAD
=======
const accounts = require("./admin-accounts");
>>>>>>> Carbonell

// Load settings from a .env file if there is one (see .env.example)
try {
    process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
    // No .env file - use real environment variables / defaults
}

const app = express();

// --- SETTINGS ---
const PORT = process.env.PORT || 3000;
<<<<<<< HEAD
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "netguard-admin";
const MESSAGES_FILE = path.join(__dirname, "messages.json");
const RESULTS_FILE = path.join(__dirname, "results.json");
const QUESTIONS_FILE = path.join(__dirname, "questions.json");

// The original 10 questions. Used to create questions.json the first time
// the server runs; after that, the questions are read from questions.json.
// (assessment.html still lists q1-q10, so keep the ids in sync with it.)
=======
// Where the JSON data files live (the automated tests point this at a temporary folder)
const DATA_DIR = process.env.DATA_DIR || __dirname;
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const RESULTS_FILE = path.join(DATA_DIR, "results.json");
const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");
const QUESTION_LIMITS = { text: 200, fix: 200 };
const MAX_QUESTIONS = 30;

// The original 10 questions. Used to create questions.json the first time
// the server runs; after that, admins edit the questions from the dashboard.
>>>>>>> Carbonell
const DEFAULT_QUESTIONS = [
    { id: "q1", text: "Do you use a strong password for your Wi-Fi network?", safeAnswer: "yes", fix: "Use a stronger, unique Wi-Fi password." },
    { id: "q2", text: "Is your Wi-Fi password shared with many people?", safeAnswer: "no", fix: "Limit who knows your Wi-Fi password." },
    { id: "q3", text: "Is your router's admin password still the default one?", safeAnswer: "no", fix: "Change your router's default admin password." },
    { id: "q4", text: "Do you keep your router's firmware updated?", safeAnswer: "yes", fix: "Update your router's firmware regularly." },
    { id: "q5", text: "Do you use WPA2 or WPA3 encryption?", safeAnswer: "yes", fix: "Enable WPA2 or WPA3 encryption." },
    { id: "q6", text: "Is your Wi-Fi network hidden from public view?", safeAnswer: "yes", fix: "Consider hiding your Wi-Fi network name (SSID)." },
    { id: "q7", text: "Do you have a guest network for visitors?", safeAnswer: "yes", fix: "Set up a separate guest network for visitors." },
    { id: "q8", text: "Do you regularly check who is connected to your network?", safeAnswer: "yes", fix: "Regularly check who is connected to your network." },
    { id: "q9", text: "Is your router placed in a secure location?", safeAnswer: "yes", fix: "Place your router in a secure location." },
    { id: "q10", text: "Do you use a firewall on your network?", safeAnswer: "yes", fix: "Enable a firewall on your network." }
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Longest value we accept for each contact form field
const LIMITS = { name: 100, email: 254, subject: 150, message: 2000 };

// Login: lock an IP out for 15 minutes after 5 wrong passwords
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const loginAttempts = new Map(); // ip -> { count, firstAttempt }
<<<<<<< HEAD
=======

>>>>>>> Carbonell

// --- MIDDLEWARE ---
app.disable("x-powered-by"); // don't advertise that we run Express

// Basic security headers on every response
app.use((req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "same-origin"
    });
    next();
});

app.use(express.json({ limit: "10kb" }));

// Express 5 leaves req.body undefined when a request has no JSON body
app.use((req, res, next) => {
    if (req.body === undefined || req.body === null || typeof req.body !== "object") req.body = {};
    next();
});

// Sessions remember who is logged in as admin
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "strict", maxAge: 60 * 60 * 1000 } // 1 hour
}));

// Only files inside /public can be opened from the browser
app.use(express.static(path.join(__dirname, "public")));

// --- HELPERS ---

// Read a JSON data file safely (never crashes the server)
function readData(file) {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
        if (err.code === "ENOENT") return []; // file doesn't exist yet
        const backup = file + ".broken-" + Date.now();
        fs.copyFileSync(file, backup);
        console.error(`${path.basename(file)} was unreadable. Backup saved as ${path.basename(backup)}`);
        return [];
    }
    if (!Array.isArray(data)) return [];

    let changed = false;
    data.forEach(item => {
        if (!item.id) {
            item.id = crypto.randomUUID();
            changed = true;
        }
    });
    if (changed) writeData(file, data);
    return data;
}

function writeData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Returns the trimmed text, "" if the field was left out, or null if it isn't text
function cleanText(value) {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") return null;
    return value.trim();
}

// Low risk = at least 80% safe answers, Medium = at least 50%, otherwise High.
// With 10 questions that is 8-10 Low, 5-7 Medium, 0-4 High (same as before).
function riskLevelForScore(score, total = 10) {
    const ratio = total ? score / total : 0;
    if (ratio >= 0.8) return "Low";
    if (ratio >= 0.5) return "Medium";
    return "High";
}

// --- QUESTION HELPERS ---

function readQuestions() {
    if (!fs.existsSync(QUESTIONS_FILE)) {
        writeData(QUESTIONS_FILE, DEFAULT_QUESTIONS);
        return DEFAULT_QUESTIONS.map(q => ({ ...q }));
    }
    return readData(QUESTIONS_FILE);
}

<<<<<<< HEAD
=======
// Checks the fields of a new/edited question -> { fields } or { error }.
// partial: true for edits, where only the fields being changed are sent.
function readQuestionFields(body, { partial = false } = {}) {
    const labels = { text: "Question", fix: "Fix" };
    const fields = {};

    for (const key of ["text", "fix"]) {
        if (partial && body[key] === undefined) continue;
        const value = cleanText(body[key]);
        if (!value) return { error: `${labels[key]} text is required.` };
        if (value.length > QUESTION_LIMITS[key]) {
            return { error: `${labels[key]} text is too long (max ${QUESTION_LIMITS[key]} characters).` };
        }
        fields[key] = value;
    }
    if (!partial || body.safeAnswer !== undefined) {
        if (!["yes", "no"].includes(body.safeAnswer)) return { error: 'safeAnswer must be "yes" or "no".' };
        fields.safeAnswer = body.safeAnswer;
    }
    if (Object.keys(fields).length === 0) return { error: "Nothing to update." };
    return { fields };
}

>>>>>>> Carbonell
// Scores { questionId: "yes" | "no" } against the current questions.
// The server does the scoring, so the browser can't send a fake score.
function scoreAnswers(questions, answers) {
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
        return { error: 'answers must be an object like { "q1": "yes" }.' };
    }
    const unanswered = questions.filter(q => !["yes", "no"].includes(answers[q.id]));
    const unknown = Object.keys(answers).filter(id => !questions.some(q => q.id === id));
    if (unanswered.length || unknown.length) {
        return { error: "Please answer every question. If the page has been open a while, reload it - the questions may have changed." };
    }

    const details = questions.map(q => ({
        questionId: q.id,
        question: q.text,
        answer: answers[q.id],
        safe: answers[q.id] === q.safeAnswer,
        fix: q.fix
    }));
    const score = details.filter(d => d.safe).length;
    const total = questions.length;
    return {
        score,
        total,
        riskLevel: riskLevelForScore(score, total),
        // Saved with the result (question text included, so old results still
        // make sense after an admin edits or deletes a question)
        answers: details.map(({ questionId, question, answer, safe }) => ({ questionId, question, answer, safe })),
        checklist: details.filter(d => !d.safe).map(d => d.fix)
    };
}

// --- EMAIL NOTIFICATIONS ---

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;
const MAIL_DRY_RUN = process.env.MAIL_DRY_RUN === "true";
const mailer = createMailer();

function createMailer() {
    if (MAIL_DRY_RUN) {
        console.log("Email notifications: DRY RUN (emails are printed here, not sent).");
        return nodemailer.createTransport({ jsonTransport: true });
    }
    if (!process.env.SMTP_HOST || !NOTIFY_EMAIL) {
        console.log("Email notifications: off (set SMTP_HOST and NOTIFY_EMAIL in .env to turn them on).");
        return null;
    }
    const port = Number(process.env.SMTP_PORT) || 587;
    console.log(`Email notifications: on, sending to ${NOTIFY_EMAIL}.`);
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
}

// Tells the admin about a new contact message. Runs in the background:
// if the email fails, the visitor's message is still saved.
function notifyNewMessage(msg) {
    if (!mailer) return;
    const oneLine = text => String(text || "").replace(/[\r\n]+/g, " ").slice(0, 150);
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    mailer.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || NOTIFY_EMAIL || "netguard@localhost",
        to: NOTIFY_EMAIL || "admin@localhost",
        replyTo: msg.email,
        subject: `New NetGuard message: ${oneLine(msg.subject) || "(no subject)"}`,
        // Plain text only, so nothing a visitor types can run as HTML
        text: [
            "You have a new message from the NetGuard contact form.",
            "",
            `From:    ${oneLine(msg.name)} <${msg.email}>`,
            `Subject: ${oneLine(msg.subject) || "(none)"}`,
            `Date:    ${msg.date}`,
            "",
            msg.message,
            "",
            `Reply to this email to answer them, or manage messages at ${appUrl}/admin`
        ].join("\n")
    }).then(info => {
        if (MAIL_DRY_RUN) console.log("DRY RUN email:\n" + info.message.toString());
    }).catch(err => {
        console.error("Could not send the notification email:", err.message);
    });
}

// --- LIST HELPERS (filtering, paging, CSV) ---

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD from <input type="date">

// When a record was created, as a timestamp. Old records only have the
// display date ("11/9/2026, 4:25:27 PM"); new ones also store createdAt (ISO).
function recordTime(item) {
    const time = Date.parse(item.createdAt || item.date);
    return Number.isNaN(time) ? 0 : time;
}

function newestFirst(a, b) {
    return recordTime(b) - recordTime(a);
}

// One query value as text: "" when missing, null when sent more than once (?a=1&a=2)
function queryText(value) {
    if (value === undefined) return "";
    if (typeof value !== "string") return null;
    return value.trim();
}

<<<<<<< HEAD
=======
// ?page=2&limit=10 -> { page, limit } or { error }
function readPaging(query) {
    const page = query.page === undefined ? 1 : Number(query.page);
    const limit = query.limit === undefined ? 10 : Number(query.limit);
    if (!Number.isInteger(page) || page < 1) return { error: "page must be a whole number of 1 or more." };
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { error: "limit must be a whole number from 1 to 100." };
    return { page, limit };
}

function paginate(items, { page, limit }) {
    const total = items.length;
    return {
        items: items.slice((page - 1) * limit, page * limit),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
    };
}

>>>>>>> Carbonell
// ?status=new&q=router -> { items } or { error }
function filterMessages(query) {
    const status = queryText(query.status);
    const search = queryText(query.q);
    if (status === null || (status && !["new", "resolved"].includes(status))) {
        return { error: "status must be new or resolved." };
    }
    if (search === null || search.length > 100) {
        return { error: "Search text must be 100 characters or fewer." };
    }

    const needle = search.toLowerCase();
<<<<<<< HEAD
    const items = readData(MESSAGES_FILE)
=======
    // Reversed first, so records saved in the same millisecond still come out newest first
    const items = readData(MESSAGES_FILE).reverse()
>>>>>>> Carbonell
        .filter(m => !status || (m.status || "new") === status)
        .filter(m => !needle || [m.name, m.email, m.subject, m.message]
            .some(field => String(field || "").toLowerCase().includes(needle)))
        .sort(newestFirst);
    return { items };
}

// ?riskLevel=High&from=2026-11-01&to=2026-11-30 -> { items } or { error }
function filterResults(query) {
    const riskLevel = queryText(query.riskLevel);
    const from = queryText(query.from);
    const to = queryText(query.to);

    if (riskLevel === null || (riskLevel && !["Low", "Medium", "High"].includes(riskLevel))) {
        return { error: "riskLevel must be Low, Medium or High." };
    }
    for (const [name, value] of [["from", from], ["to", to]]) {
        if (value === null || (value && (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))))) {
            return { error: `${name} must be a date like 2026-11-09.` };
        }
    }

    // Whole days in the server's local time, the same clock the dates were saved with
    const fromTime = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const toTime = to ? new Date(to + "T23:59:59.999").getTime() : Infinity;
    if (fromTime > toTime) return { error: "The from date must be on or before the to date." };

<<<<<<< HEAD
    const items = readData(RESULTS_FILE)
=======
    // Reversed first, so records saved in the same millisecond still come out newest first
    const items = readData(RESULTS_FILE).reverse()
>>>>>>> Carbonell
        .filter(r => !riskLevel || r.riskLevel === riskLevel)
        .filter(r => {
            const time = recordTime(r);
            return time >= fromTime && time <= toTime;
        })
        .sort(newestFirst);
    return { items };
}

// One CSV cell. Cells starting with = + - @ get a ' in front so Excel/Sheets
// treat them as text, not formulas (contact messages are typed by visitors).
function csvCell(value) {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sendCsv(res, name, header, rows) {
    const today = localDateKey(new Date());
    const lines = [header, ...rows].map(row => row.map(csvCell).join(","));
    res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="netguard-${name}-${today}.csv"`
    });
    // The BOM at the start makes Excel open the file as UTF-8
    res.send("﻿" + lines.join("\r\n") + "\r\n");
}

// A Date as YYYY-MM-DD in local time
function localDateKey(date) {
    const pad = n => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

<<<<<<< HEAD
// --- LOGIN LOCKOUT ---
=======
// --- ADMIN ACCOUNTS ---

// Hash of a random password, checked when someone logs in with a username
// that doesn't exist, so the reply takes just as long as a real wrong password
// (otherwise the timing would reveal which usernames exist).
let dummyPasswordHash = null;

// The team's admin accounts, created the first time the server runs
// (when admins.json doesn't exist yet). Override with INITIAL_ADMINS in .env.
const INITIAL_ADMINS = (process.env.INITIAL_ADMINS || "roi,evan,lenard,hady")
    .split(",").map(name => name.trim().toLowerCase()).filter(Boolean);

// First run: create the team's accounts with the shared starting password.
// Everyone is made to choose their own password the first time they log in.
async function ensureFirstAdmin() {
    dummyPasswordHash = await accounts.hashPassword(crypto.randomBytes(16).toString("hex"));
    if (accounts.readAdmins().length > 0) return;

    const startingPassword = process.env.ADMIN_PASSWORD || accounts.TEMPORARY_PASSWORD;
    const created = [];
    for (const name of INITIAL_ADMINS) {
        const checked = accounts.checkUsername(name);
        if (checked.error) throw new Error(`INITIAL_ADMINS: "${name}" - ${checked.error}`);
        created.push(await accounts.newAdminRecord(checked.username, startingPassword, { mustChangePassword: true }));
    }
    if (created.length === 0) throw new Error("INITIAL_ADMINS is empty, so no admin account could be created.");
    accounts.writeAdmins(created);
    console.log(`Created admin accounts: ${created.map(a => a.username).join(", ")}.`);
    console.log(`Starting password: ${process.env.ADMIN_PASSWORD ? "the one in ADMIN_PASSWORD" : `"${accounts.TEMPORARY_PASSWORD}"`}. Each person must change it at first login.`);
}

function warnAboutStartingPasswords() {
    const pending = accounts.readAdmins().filter(a => a.mustChangePassword).map(a => a.username);
    if (pending.length) {
        console.warn(`Note: these accounts haven't chosen their own password yet: ${pending.join(", ")}.`);
    }
}

// The logged-in admin for this request, or null. A session stops working
// if its account was deleted or its password changed after it logged in.
function currentAdmin(req) {
    if (!req.session.adminId) return null;
    const admin = accounts.readAdmins().find(a => a.id === req.session.adminId);
    if (!admin) return null;
    if (admin.passwordChangedAt && req.session.loginAt < Date.parse(admin.passwordChangedAt)) return null;
    return admin;
}
>>>>>>> Carbonell

function isLockedOut(ip) {
    const entry = loginAttempts.get(ip);
    if (!entry) return false;
    if (Date.now() - entry.firstAttempt > LOCKOUT_MS) {
        loginAttempts.delete(ip);
        return false;
    }
    return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(ip) {
    const entry = loginAttempts.get(ip);
    if (!entry || Date.now() - entry.firstAttempt > LOCKOUT_MS) {
        loginAttempts.set(ip, { count: 1, firstAttempt: Date.now() });
    } else {
        entry.count++;
    }
}

<<<<<<< HEAD
// Only let logged-in admins through
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) return next();
=======
// Any logged-in admin, even one who still has to change their password
// (used only for the change-password page and the API it needs)
function requireLogin(req, res, next) {
    const admin = currentAdmin(req);
    if (admin) {
        req.admin = admin;
        return next();
    }
>>>>>>> Carbonell
    if (req.path.startsWith("/api/")) {
        return res.status(401).json({ error: "Please log in." });
    }
    res.redirect("/login");
}

// Logged-in admins who have chosen their own password. Everyone else is
// sent to the change-password page first.
function requireAdmin(req, res, next) {
    requireLogin(req, res, () => {
        if (!req.admin.mustChangePassword) return next();
        if (req.path.startsWith("/api/")) {
            return res.status(403).json({ error: "Please change your password first.", mustChangePassword: true });
        }
        res.redirect("/change-password");
    });
}

// --- FRONTEND ROUTES ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/assessment", (req, res) => res.sendFile(path.join(__dirname, "public", "assessment.html")));
app.get("/about", (req, res) => res.sendFile(path.join(__dirname, "public", "about.html")));
app.get("/contact", (req, res) => res.sendFile(path.join(__dirname, "public", "contact.html")));
app.get("/login", (req, res) => {
    const admin = currentAdmin(req);
    if (admin) return res.redirect(admin.mustChangePassword ? "/change-password" : "/admin");
    res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/result", (req, res) => res.sendFile(path.join(__dirname, "public", "result.html")));
app.get("/admin", requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "private", "admin.html"));
});
app.get("/change-password", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "private", "change-password.html"));
});

// --- AUTHENTICATION ---
<<<<<<< HEAD
app.post("/login", (req, res) => {
=======
app.post("/login", async (req, res) => {
>>>>>>> Carbonell
    const ip = req.ip;
    if (isLockedOut(ip)) {
        return res.status(429).json({ error: "Too many failed attempts. Please try again in 15 minutes." });
    }

<<<<<<< HEAD
    const password = String(req.body.password || "");
    if (password !== ADMIN_PASSWORD) {
        recordFailedLogin(ip);
        return res.status(401).json({ error: "Wrong password." });
    }
    loginAttempts.delete(ip);
=======
    const { username, password } = req.body;
    if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) {
        return res.status(400).json({ error: "Please enter your username and password." });
    }

    const name = username.trim().toLowerCase();
    const admin = accounts.readAdmins().find(a => a.username === name);
    // Always run the (slow) password check, even for unknown usernames
    const tooLong = password.length > accounts.PASSWORD_MAX;
    const correct = await accounts.verifyPassword(tooLong ? "" : password, admin ? admin.passwordHash : dummyPasswordHash);
    if (!admin || !correct || tooLong) {
        recordFailedLogin(ip);
        // Same message either way, so it doesn't reveal which usernames exist
        return res.status(401).json({ error: "Wrong username or password." });
    }

    loginAttempts.delete(ip);
    const now = Date.now();
    const all = accounts.readAdmins();
    const record = all.find(a => a.id === admin.id);
    if (record) {
        record.lastLoginAt = new Date(now).toISOString();
        accounts.writeAdmins(all);
    }
>>>>>>> Carbonell

    req.session.regenerate(err => {
        if (err) return res.status(500).json({ error: "Login failed." });
        req.session.adminId = admin.id;
        req.session.loginAt = now;
        res.json({
            message: "Logged in.",
            username: admin.username,
            // The login page sends these people to /change-password first
            mustChangePassword: Boolean(admin.mustChangePassword)
        });
    });
});

app.post("/logout", (req, res) => {
    req.session.destroy(() => res.json({ message: "Logged out." }));
});

// Who is logged in (works before the first password change too)
app.get("/api/me", requireLogin, (req, res) => res.json(accounts.publicAdmin(req.admin)));

// Change your own password: { currentPassword, newPassword }
app.post("/api/me/password", requireLogin, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > accounts.PASSWORD_MAX) {
        return res.status(400).json({ error: "Please enter your current password." });
    }
    const problem = accounts.checkNewPassword(newPassword, req.admin.username);
    if (problem) return res.status(400).json({ error: problem });
    if (newPassword === currentPassword) {
        return res.status(400).json({ error: "The new password must be different from the current one." });
    }

    if (!(await accounts.verifyPassword(currentPassword, req.admin.passwordHash))) {
        recordFailedLogin(req.ip);
        return res.status(400).json({ error: "Your current password is wrong." });
    }
    const newHash = await accounts.hashPassword(newPassword);

    const now = Date.now();
    const all = accounts.readAdmins();
    const record = all.find(a => a.id === req.admin.id);
    if (!record) return res.status(404).json({ error: "Your account no longer exists." });
    record.passwordHash = newHash;
    record.passwordChangedAt = new Date(now).toISOString();
    record.mustChangePassword = false;
    accounts.writeAdmins(all);

    // Logs out every other session of this account; this one stays logged in
    req.session.loginAt = now;
    res.json({ message: "Password changed. Any other sessions of this account were logged out." });
});

// --- Managing admin accounts ---

app.get("/api/admins", requireAdmin, (req, res) => {
    res.json(accounts.readAdmins().map(a => ({ ...accounts.publicAdmin(a), isYou: a.id === req.admin.id })));
});

// { username, password } - the password is temporary: the new admin
// must choose their own the first time they log in
app.post("/api/admins", requireAdmin, async (req, res) => {
    const checked = accounts.checkUsername(req.body.username);
    if (checked.error) return res.status(400).json({ error: checked.error });
    const problem = accounts.checkNewPassword(req.body.password, checked.username, { temporary: true });
    if (problem) return res.status(400).json({ error: problem });

    const record = await accounts.newAdminRecord(checked.username, req.body.password, { mustChangePassword: true });

    const all = accounts.readAdmins();
    if (all.some(a => a.username === checked.username)) {
        return res.status(409).json({ error: "That username is already taken." });
    }
    if (all.length >= accounts.MAX_ADMINS) {
        return res.status(400).json({ error: `There can be at most ${accounts.MAX_ADMINS} admin accounts.` });
    }
    all.push(record);
    accounts.writeAdmins(all);
    res.status(201).json(accounts.publicAdmin(record));
});

app.delete("/api/admins/:id", requireAdmin, (req, res) => {
    if (req.params.id === req.admin.id) {
        return res.status(400).json({ error: "You can't delete your own account while you're logged in to it." });
    }
    const all = accounts.readAdmins();
    const remaining = all.filter(a => a.id !== req.params.id);
    if (remaining.length === all.length) return res.status(404).json({ error: "Account not found." });

    accounts.writeAdmins(remaining);
    res.json({ message: "Account deleted." });
});

// --- BACKEND FEATURE 1: Contact Messages (CRUD) ---
app.post("/contact", (req, res) => {
    const fields = {
        name: cleanText(req.body.name),
        email: cleanText(req.body.email),
        subject: cleanText(req.body.subject),
        message: cleanText(req.body.message)
    };

    for (const [field, value] of Object.entries(fields)) {
        if (value === null) return res.status(400).json({ error: `The ${field} field must be text.` });
        if (value.length > LIMITS[field]) {
            return res.status(400).json({ error: `The ${field} field is too long (max ${LIMITS[field]} characters).` });
        }
    }
    if (!fields.name || !fields.email || !fields.message) {
        return res.status(400).json({ error: "Missing required fields." });
    }
    if (!EMAIL_PATTERN.test(fields.email)) {
        return res.status(400).json({ error: "Invalid email address." });
    }

    const messages = readData(MESSAGES_FILE);
    const newMessage = {
        id: crypto.randomUUID(),
        ...fields,
        status: "new",
        date: new Date().toLocaleString(),
        createdAt: new Date().toISOString()
    };
    messages.push(newMessage);
    writeData(MESSAGES_FILE, messages);
    notifyNewMessage(newMessage);
    res.json({ message: "Message saved successfully!" });
});

// Newest first. Optional filters: ?status=new|resolved &q=search text
// Paging: ?page=1 &limit=10 (max 100)
app.get("/api/messages", requireAdmin, (req, res) => {
    const paging = readPaging(req.query);
    if (paging.error) return res.status(400).json({ error: paging.error });
    const filtered = filterMessages(req.query);
    if (filtered.error) return res.status(400).json({ error: filtered.error });

    res.json(paginate(filtered.items, paging));
});

// Same filters as the list, every matching row, as a CSV download
app.get("/api/messages/export", requireAdmin, (req, res) => {
    const filtered = filterMessages(req.query);
    if (filtered.error) return res.status(400).json({ error: filtered.error });

    sendCsv(res, "messages",
        ["Date", "Name", "Email", "Subject", "Message", "Status"],
        filtered.items.map(m => [m.date, m.name, m.email, m.subject, m.message, m.status || "new"]));
});

// Same filters as the list, every matching row, as a CSV download
app.get("/api/messages/export", requireAdmin, (req, res) => {
    const filtered = filterMessages(req.query);
    if (filtered.error) return res.status(400).json({ error: filtered.error });

    sendCsv(res, "messages",
        ["Date", "Name", "Email", "Subject", "Message", "Status"],
        filtered.items.map(m => [m.date, m.name, m.email, m.subject, m.message, m.status || "new"]));
});

app.patch("/api/messages/:id", requireAdmin, (req, res) => {
    const { status } = req.body;
    if (!["new", "resolved"].includes(status)) return res.status(400).json({ error: "Invalid status." });

    const messages = readData(MESSAGES_FILE);
    const msg = messages.find(m => m.id === req.params.id);
    if (!msg) return res.status(404).json({ error: "Message not found." });

    msg.status = status;
    writeData(MESSAGES_FILE, messages);
    res.json({ message: "Message updated." });
});

app.delete("/api/messages/:id", requireAdmin, (req, res) => {
    const messages = readData(MESSAGES_FILE);
    const remaining = messages.filter(m => m.id !== req.params.id);
    if (remaining.length === messages.length) return res.status(404).json({ error: "Message not found." });

    writeData(MESSAGES_FILE, remaining);
    res.json({ message: "Message deleted." });
});

<<<<<<< HEAD
// --- BACKEND FEATURE 2: Assessment Results ---

// Body: { "answers": { "q1": "yes", "q2": "no", ... } }
// The server scores the answers, saves them, and sends back the result.
app.post("/save-result", (req, res) => {
    const questions = readQuestions();
    if (questions.length === 0) return res.status(503).json({ error: "The assessment has no questions yet." });

    const scored = scoreAnswers(questions, req.body.answers);
    if (scored.error) return res.status(400).json({ error: scored.error });

    const results = readData(RESULTS_FILE);
    const id = crypto.randomUUID();
    results.push({
        id,
        riskLevel: scored.riskLevel,
        score: scored.score,
        total: scored.total,
        answers: scored.answers,
        checklist: scored.checklist,
        date: new Date().toLocaleString(),
        createdAt: new Date().toISOString()
    });
    writeData(RESULTS_FILE, results);

    // The id lets the user come back to this result later at /result?id=...
    res.json({
        message: "Assessment saved successfully!",
        id,
        riskLevel: scored.riskLevel,
        score: scored.score,
        total: scored.total,
        checklist: scored.checklist
    });
=======
// --- BACKEND FEATURE 2: Assessment questions ---

// Public: what the assessment page shows (no answers or fixes)
app.get("/api/questions", (req, res) => {
    res.json(readQuestions().map(({ id, text }) => ({ id, text })));
>>>>>>> Carbonell
});

// Admin: everything, for the question editor
app.get("/api/questions/full", requireAdmin, (req, res) => res.json(readQuestions()));

<<<<<<< HEAD
=======
app.post("/api/questions", requireAdmin, (req, res) => {
    const questions = readQuestions();
    if (questions.length >= MAX_QUESTIONS) {
        return res.status(400).json({ error: `The assessment can have at most ${MAX_QUESTIONS} questions.` });
    }
    const checked = readQuestionFields(req.body);
    if (checked.error) return res.status(400).json({ error: checked.error });

    const question = { id: "q-" + crypto.randomUUID().slice(0, 8), ...checked.fields };
    questions.push(question);
    writeData(QUESTIONS_FILE, questions);
    res.status(201).json(question);
});

app.patch("/api/questions/:id", requireAdmin, (req, res) => {
    const questions = readQuestions();
    const question = questions.find(q => q.id === req.params.id);
    if (!question) return res.status(404).json({ error: "Question not found." });
    const checked = readQuestionFields(req.body, { partial: true });
    if (checked.error) return res.status(400).json({ error: checked.error });

    Object.assign(question, checked.fields);
    writeData(QUESTIONS_FILE, questions);
    res.json(question);
});

// Move a question one place up or down: { "direction": "up" | "down" }
app.post("/api/questions/:id/move", requireAdmin, (req, res) => {
    const { direction } = req.body;
    if (!["up", "down"].includes(direction)) return res.status(400).json({ error: 'direction must be "up" or "down".' });

    const questions = readQuestions();
    const index = questions.findIndex(q => q.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Question not found." });
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= questions.length) {
        return res.status(400).json({ error: `That question is already at the ${direction === "up" ? "top" : "bottom"}.` });
    }

    [questions[index], questions[target]] = [questions[target], questions[index]];
    writeData(QUESTIONS_FILE, questions);
    res.json({ message: "Question moved." });
});

app.delete("/api/questions/:id", requireAdmin, (req, res) => {
    const questions = readQuestions();
    const remaining = questions.filter(q => q.id !== req.params.id);
    if (remaining.length === questions.length) return res.status(404).json({ error: "Question not found." });
    if (remaining.length === 0) return res.status(400).json({ error: "The assessment needs at least one question." });

    writeData(QUESTIONS_FILE, remaining);
    res.json({ message: "Question deleted." });
});

// --- BACKEND FEATURE 3: Assessment Results ---

// Body: { "answers": { "q1": "yes", "q2": "no", ... } }
// The server scores the answers, saves them, and sends back the result.
app.post("/save-result", (req, res) => {
    const questions = readQuestions();
    if (questions.length === 0) return res.status(503).json({ error: "The assessment has no questions yet." });

    const scored = scoreAnswers(questions, req.body.answers);
    if (scored.error) return res.status(400).json({ error: scored.error });

    const results = readData(RESULTS_FILE);
    const id = crypto.randomUUID();
    results.push({
        id,
        riskLevel: scored.riskLevel,
        score: scored.score,
        total: scored.total,
        answers: scored.answers,
        checklist: scored.checklist,
        date: new Date().toLocaleString(),
        createdAt: new Date().toISOString()
    });
    writeData(RESULTS_FILE, results);

    // The id lets the user come back to this result later at /result?id=...
    res.json({
        message: "Assessment saved successfully!",
        id,
        riskLevel: scored.riskLevel,
        score: scored.score,
        total: scored.total,
        checklist: scored.checklist
    });
});

// Admins see every result, newest first.
// Optional filters: ?riskLevel=Low|Medium|High &from=YYYY-MM-DD &to=YYYY-MM-DD
// Paging: ?page=1 &limit=10 (max 100)
app.get("/api/results", requireAdmin, (req, res) => {
    const paging = readPaging(req.query);
    if (paging.error) return res.status(400).json({ error: paging.error });
    const filtered = filterResults(req.query);
    if (filtered.error) return res.status(400).json({ error: filtered.error });

    res.json(paginate(filtered.items, paging));
});

>>>>>>> Carbonell
// Same filters as the list, every matching row, as a CSV download.
// (Must come before /api/results/:id, or "export" would be read as an id.)
app.get("/api/results/export", requireAdmin, (req, res) => {
    const filtered = filterResults(req.query);
    if (filtered.error) return res.status(400).json({ error: filtered.error });

    sendCsv(res, "results",
        ["Date", "Risk Level", "Score", "Out Of", "Fixes Needed"],
        filtered.items.map(r => [r.date, r.riskLevel, r.score, r.total || 10, (r.checklist || []).join(" | ")]));
});

// --- BACKEND FEATURE 4: Dashboard statistics ---
app.get("/api/stats", requireAdmin, (req, res) => {
    const results = readData(RESULTS_FILE);
    const messages = readData(MESSAGES_FILE);
    const questions = readQuestions();

    const total = results.length;
    // Old results have no "total" field; they were all out of 10
    const percentSum = results.reduce((sum, r) => sum + Number(r.score || 0) / (r.total || 10), 0);
    const byLevel = { Low: 0, Medium: 0, High: 0 };
    results.forEach(r => {
        if (r.riskLevel in byLevel) byLevel[r.riskLevel]++;
    });

    // Assessments per day for the last 14 days, oldest first (for a trend chart)
    const last14Days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
        const day = new Date(today);
        day.setDate(day.getDate() - i);
        last14Days.push({ date: localDateKey(day), count: 0 });
    }
    results.forEach(r => {
        const day = last14Days.find(d => d.date === localDateKey(new Date(recordTime(r))));
        if (day) day.count++;
    });

    // How often each current question was answered unsafely (results saved
    // before answers were stored are skipped). Most-failed first.
    const questionStats = questions.map(q => {
        let answered = 0;
        let failed = 0;
        results.forEach(r => {
            const answer = (r.answers || []).find(a => a.questionId === q.id);
            if (!answer) return;
            answered++;
            if (!answer.safe) failed++;
        });
        return {
            id: q.id,
            text: q.text,
            answered,
            failed,
            failRate: answered ? Math.round((failed / answered) * 100) : null
        };
    }).sort((a, b) => (b.failRate ?? -1) - (a.failRate ?? -1) || b.failed - a.failed);

    const resolved = messages.filter(m => m.status === "resolved").length;
    res.json({
        assessments: {
            total,
            averagePercent: total ? Math.round((percentSum / total) * 100) : null,
            byLevel,
            last14Days
        },
        questions: questionStats,
        messages: {
            total: messages.length,
            new: messages.length - resolved,
            resolved
        }
    });
});

// Anyone with the link can see ONE result. The id is a random UUID,
// so results can't be guessed or listed by other visitors.
app.get("/api/results/:id", (req, res) => {
    const id = req.params.id.toLowerCase();
    if (!UUID_PATTERN.test(id)) {
        return res.status(400).json({ error: "Invalid result link." });
    }
    const result = readData(RESULTS_FILE).find(r => r.id === id);
    if (!result) return res.status(404).json({ error: "Result not found." });

    const { riskLevel, score, date } = result;
    res.json({
        riskLevel,
        score,
        total: result.total || 10,
        date,
        // null for results saved before answers were stored
        checklist: Array.isArray(result.checklist) ? result.checklist : null
    });
});

// --- ERROR HANDLING ---

// Unknown API routes answer in JSON instead of an HTML page
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// Catch every error so users never see stack traces or file paths
app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Request body is not valid JSON." });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Request is too large." });

    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
});

<<<<<<< HEAD
app.listen(PORT, () => console.log(`NetGuard backend running on port ${PORT}`));
=======
// Set up the admin accounts first, then start taking requests
ensureFirstAdmin()
    .then(() => {
        warnAboutStartingPasswords();
        // PORT=0 lets the system pick a free port (used by the automated tests)
        const server = app.listen(PORT, () => console.log(`NetGuard backend running on port ${server.address().port}`));
    })
    .catch(err => {
        console.error("Could not load admin accounts (admins.json):", err.message);
        console.error("Fix or remove admins.json, or reset an account with: npm run admin -- reset-password <username>");
        process.exit(1);
    });
>>>>>>> Carbonell

const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// Load settings from a .env file if there is one (see .env.example)
try {
    process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
    // No .env file - use real environment variables / defaults
}

const app = express();

// --- SETTINGS ---
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "netguard-admin";
const MESSAGES_FILE = path.join(__dirname, "messages.json");
const RESULTS_FILE = path.join(__dirname, "results.json");
const QUESTIONS_FILE = path.join(__dirname, "questions.json");

// The original 10 questions. Used to create questions.json the first time
// the server runs; after that, the questions are read from questions.json.
// (assessment.html still lists q1-q10, so keep the ids in sync with it.)
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
    const items = readData(MESSAGES_FILE)
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

    const items = readData(RESULTS_FILE)
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

// --- LOGIN LOCKOUT ---

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

// Only let logged-in admins through
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) return next();
    if (req.path.startsWith("/api/")) {
        return res.status(401).json({ error: "Please log in." });
    }
    res.redirect("/login");
}

// --- FRONTEND ROUTES ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/assessment", (req, res) => res.sendFile(path.join(__dirname, "public", "assessment.html")));
app.get("/about", (req, res) => res.sendFile(path.join(__dirname, "public", "about.html")));
app.get("/contact", (req, res) => res.sendFile(path.join(__dirname, "public", "contact.html")));
app.get("/login", (req, res) => {
    if (req.session.isAdmin) return res.redirect("/admin");
    res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/result", (req, res) => res.sendFile(path.join(__dirname, "public", "result.html")));
app.get("/admin", requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "private", "admin.html"));
});

// --- AUTHENTICATION ---
app.post("/login", (req, res) => {
    const ip = req.ip;
    if (isLockedOut(ip)) {
        return res.status(429).json({ error: "Too many failed attempts. Please try again in 15 minutes." });
    }

    const password = String(req.body.password || "");
    if (password !== ADMIN_PASSWORD) {
        recordFailedLogin(ip);
        return res.status(401).json({ error: "Wrong password." });
    }
    loginAttempts.delete(ip);

    req.session.regenerate(err => {
        if (err) return res.status(500).json({ error: "Login failed." });
        req.session.isAdmin = true;
        res.json({ message: "Logged in." });
    });
});

app.post("/logout", (req, res) => {
    req.session.destroy(() => res.json({ message: "Logged out." }));
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

app.get("/api/messages", requireAdmin, (req, res) => res.json(readData(MESSAGES_FILE)));

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
});

app.get("/api/results", requireAdmin, (req, res) => res.json(readData(RESULTS_FILE)));

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

app.listen(PORT, () => console.log(`NetGuard backend running on port ${PORT}`));

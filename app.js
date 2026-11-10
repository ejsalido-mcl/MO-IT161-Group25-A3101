const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { validateContact, validateResult } = require("./validators");
const { createRateLimiter } = require("./ratelimit");

const app = express();

// --- SETTINGS ---
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEFAULT_ADMIN_PASSWORD = "netguard-admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
const DATA_DIR = process.env.DATA_DIR || __dirname; // tests point this to a temp folder
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const RESULTS_FILE = path.join(DATA_DIR, "results.json");

// The default password is public (it is in the GitHub repo), so never run with it for real
if (ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD) {
    if (IS_PRODUCTION) {
        console.error("Refusing to start: set the ADMIN_PASSWORD environment variable.");
        process.exit(1);
    }
    console.warn("WARNING: using the default admin password. Set ADMIN_PASSWORD before deploying.");
}

// Rate limits (the numbers can be changed with environment variables, e.g. for tests)
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: Number(process.env.LOGIN_MAX) || 10 });
const contactLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: Number(process.env.CONTACT_MAX) || 5 });
const resultLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: Number(process.env.RESULT_MAX) || 30 });

// --- MIDDLEWARE ---
app.disable("x-powered-by");

// Basic security headers
app.use((req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    next();
});

app.use(express.json({ limit: "10kb" }));

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

// Write to a temporary file first, then swap it in, so a crash can't leave half a file
function writeData(file, data) {
    const temp = file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, file);
}

// Compare passwords without leaking timing information
function passwordMatches(input) {
    const a = crypto.createHash("sha256").update(String(input)).digest();
    const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
    return crypto.timingSafeEqual(a, b);
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
app.get("/admin", requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "private", "admin.html"));
});

// --- AUTHENTICATION ---
app.post("/login", loginLimiter, (req, res) => {
    const password = String((req.body && req.body.password) || "");
    if (!passwordMatches(password)) return res.status(401).json({ error: "Wrong password." });

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
app.post("/contact", contactLimiter, (req, res) => {
    const result = validateContact(req.body);
    if (!result.ok) {
        return res.status(400).json({ error: "Please check the form.", details: result.errors });
    }

    const messages = readData(MESSAGES_FILE);
    messages.push({
        id: crypto.randomUUID(),
        ...result.value, // name, email, subject, message (already trimmed and checked)
        status: "new",
        date: new Date().toLocaleString(),
        createdAt: new Date().toISOString()
    });
    writeData(MESSAGES_FILE, messages);
    res.json({ message: "Message saved successfully!" });
});

app.get("/api/messages", requireAdmin, (req, res) => res.json(readData(MESSAGES_FILE)));

app.patch("/api/messages/:id", requireAdmin, (req, res) => {
    const status = req.body && req.body.status;
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
app.post("/save-result", resultLimiter, (req, res) => {
    const result = validateResult(req.body);
    if (!result.ok) {
        return res.status(400).json({ error: "Invalid assessment result.", details: result.errors });
    }

    const results = readData(RESULTS_FILE);
    results.push({
        id: crypto.randomUUID(),
        riskLevel: result.value.riskLevel,
        score: result.value.score,
        date: new Date().toLocaleString(),
        createdAt: new Date().toISOString()
    });
    writeData(RESULTS_FILE, results);
    res.json({ message: "Assessment saved successfully!" });
});

app.get("/api/results", requireAdmin, (req, res) => res.json(readData(RESULTS_FILE)));

// --- ERRORS (always answer with JSON, never a stack trace) ---
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON." });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Request too large." });
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
});

// Start the server only when run directly (node app.js). Tests import the app instead.
if (require.main === module) {
    app.listen(PORT, () => console.log(`NetGuard backend running on port ${PORT}`));
}

module.exports = app;
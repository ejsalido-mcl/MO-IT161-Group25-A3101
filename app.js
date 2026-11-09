const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

// --- SETTINGS ---
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "netguard-admin";
const MESSAGES_FILE = path.join(__dirname, "messages.json");
const RESULTS_FILE = path.join(__dirname, "results.json");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Longest value we accept for each contact form field
const LIMITS = { name: 100, email: 254, subject: 150, message: 2000 };

// Login: lock an IP out for 15 minutes after 5 wrong passwords
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const loginAttempts = new Map(); // ip -> { count, firstAttempt }

if (!process.env.ADMIN_PASSWORD) {
    console.warn("WARNING: ADMIN_PASSWORD is not set, so the default admin password is in use.");
}

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

// The same scoring rule the assessment page uses
function riskLevelForScore(score) {
    if (score >= 8) return "Low";
    if (score >= 5) return "Medium";
    return "High";
}

// Compare passwords without leaking timing information
function passwordMatches(input) {
    const a = crypto.createHash("sha256").update(input).digest();
    const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
    return crypto.timingSafeEqual(a, b);
}

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

    const { password } = req.body;
    if (typeof password !== "string" || !password) {
        return res.status(400).json({ error: "Please enter the password." });
    }
    if (!passwordMatches(password)) {
        recordFailedLogin(ip);
        return res.status(401).json({ error: "Wrong password. Please try again." });
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
    messages.push({
        id: crypto.randomUUID(),
        ...fields,
        status: "new",
        date: new Date().toLocaleString()
    });
    writeData(MESSAGES_FILE, messages);
    res.json({ message: "Message saved successfully!" });
});

app.get("/api/messages", requireAdmin, (req, res) => res.json(readData(MESSAGES_FILE)));

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
app.post("/save-result", (req, res) => {
    const { riskLevel, score } = req.body;
    const validLevels = ["Low", "Medium", "High"];
    
    if (!validLevels.includes(riskLevel) || !Number.isInteger(score) || score < 0 || score > 10) {
        return res.status(400).json({ error: "Invalid assessment result." });
    }
    if (riskLevel !== riskLevelForScore(score)) {
        return res.status(400).json({ error: "Risk level does not match the score." });
    }

    const results = readData(RESULTS_FILE);
    const id = crypto.randomUUID();
    results.push({
        id,
        riskLevel,
        score,
        date: new Date().toLocaleString()
    });
    writeData(RESULTS_FILE, results);
    // The id lets the user come back to this result later at /result?id=...
    res.json({ message: "Assessment saved successfully!", id });
});

// Admins see every result
app.get("/api/results", requireAdmin, (req, res) => res.json(readData(RESULTS_FILE)));

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
    res.json({ riskLevel, score, date });
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

const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

// --- SETTINGS ---
const PORT = 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "netguard-admin";
const MESSAGES_FILE = path.join(__dirname, "messages.json");
const RESULTS_FILE = path.join(__dirname, "results.json");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- MIDDLEWARE ---
app.use(express.json());

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
app.post("/login", (req, res) => {
    const password = String(req.body.password || "");
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password." });
    
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
    const { name, email, subject, message } = req.body;

    if (!name || !name.trim() || !email || !email.trim() || !message || !message.trim()) {
        return res.status(400).json({ error: "Missing required fields." });
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
        return res.status(400).json({ error: "Invalid email address." });
    }

    const messages = readData(MESSAGES_FILE);
    messages.push({
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim(),
        subject: subject ? subject.trim() : "",
        message: message.trim(),
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

    const results = readData(RESULTS_FILE);
    results.push({
        id: crypto.randomUUID(),
        riskLevel,
        score,
        date: new Date().toLocaleString()
    });
    writeData(RESULTS_FILE, results);
    res.json({ message: "Assessment saved successfully!" });
});

app.get("/api/results", requireAdmin, (req, res) => res.json(readData(RESULTS_FILE)));

app.listen(PORT, () => console.log(`NetGuard backend running on port ${PORT}`));

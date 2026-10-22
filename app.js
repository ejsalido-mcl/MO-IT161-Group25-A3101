const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

// 1. Middleware to read JSON
app.use(express.json());

// 2. Serve static files (CSS, JS, images)
app.use(express.static(__dirname));

// --- FRONTEND ROUTES ---
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/assessment", (req, res) => {
    res.sendFile(path.join(__dirname, "assessment.html"));
});

app.get("/about", (req, res) => {
    res.sendFile(path.join(__dirname, "about.html"));
});

app.get("/contact", (req, res) => {
    res.sendFile(path.join(__dirname, "contact.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "admin.html"));
});

// --- BACKEND FEATURE 1: Contact Messages ---

// Save a message (Create)
app.post("/contact", (req, res) => {
    const { name, email, subject, message } = req.body;

    // Server-side validation: never trust the browser alone
    if (!name || !name.trim() || !email || !email.trim() || !message || !message.trim()) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    console.log("Message received from:", name);
    const messages = JSON.parse(fs.readFileSync("messages.json", "utf8"));
    messages.push({
        name: name.trim(),
        email: email.trim(),
        subject: subject ? subject.trim() : "",
        message: message.trim(),
        date: new Date().toLocaleString()
    });
    fs.writeFileSync("messages.json", JSON.stringify(messages, null, 2));
    res.json({ message: "Message saved successfully!" });
});

// Retrieve all messages (Read) - used by the Admin page
app.get("/api/messages", (req, res) => {
    const messages = JSON.parse(fs.readFileSync("messages.json", "utf8"));
    res.json(messages);
});

// --- BACKEND FEATURE 2: Assessment Results ---

// Save a result (Create)
app.post("/save-result", (req, res) => {
    const { riskLevel, score } = req.body;

    // Server-side validation
    const validLevels = ["Low", "Medium", "High"];
    if (!validLevels.includes(riskLevel) || !Number.isInteger(score) || score < 0 || score > 10) {
        return res.status(400).json({ error: "Invalid assessment result." });
    }

    const results = JSON.parse(fs.readFileSync("results.json", "utf8"));

    const newResult = {
        riskLevel: riskLevel,
        score: score,
        date: new Date().toLocaleString()
    };

    results.push(newResult);
    fs.writeFileSync("results.json", JSON.stringify(results, null, 2));

    console.log("Assessment saved:", newResult.riskLevel, newResult.score + "/10");
    res.json({ message: "Assessment saved successfully!" });
});

// Retrieve all results (Read) - used by the Admin page
app.get("/api/results", (req, res) => {
    const results = JSON.parse(fs.readFileSync("results.json", "utf8"));
    res.json(results);
});

app.listen(3000, () => {
    console.log("NetGuard backend running on port 3000");
});

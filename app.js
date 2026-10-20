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

// --- BACKEND FEATURE 1: Save Contact Messages ---
app.post("/contact", (req, res) => {
    console.log("Message received from:", req.body.name);
    const messages = JSON.parse(fs.readFileSync("messages.json", "utf8"));
    messages.push(req.body);
    fs.writeFileSync("messages.json", JSON.stringify(messages, null, 2));
    res.json({ message: "Message saved successfully!" });
});

// --- BACKEND FEATURE 2: Save Assessment Results ---
app.post("/save-result", (req, res) => {
    // Read existing results
    const results = JSON.parse(fs.readFileSync("results.json", "utf8"));

    // Add a timestamp to the new result
    const newResult = {
        ...req.body,
        date: new Date().toLocaleString()
    };

    // Save to file
    results.push(newResult);
    fs.writeFileSync("results.json", JSON.stringify(results, null, 2));

    console.log("Assessment saved:", newResult.riskLevel, newResult.score + "/10");
    res.json({ message: "Assessment saved successfully!" });
});

app.listen(3000, () => {
    console.log("NetGuard backend running on port 3000");
});

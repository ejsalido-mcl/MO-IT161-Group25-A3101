const express = require("express");
const path = require("path");
const fs = require("fs"); // 1. Require File System

const app = express();

// 2. Middleware to read JSON from frontend
app.use(express.json());

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

// --- BACKEND FEATURE: Receive and Save Contact Messages ---
app.post("/contact", (req, res) => {
    console.log("Message received from:", req.body.name);

    // 3. Read existing messages
    const messages = JSON.parse(fs.readFileSync("messages.json", "utf8"));

    // 4. Add new message
    messages.push(req.body);

    // 5. Save back to file
    fs.writeFileSync("messages.json", JSON.stringify(messages, null, 2));

    // 6. Send response to frontend
    res.json({ message: "Message saved successfully!" });
});

app.listen(3000, () => {
    console.log("NetGuard backend running on port 3000");
});
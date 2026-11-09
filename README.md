# 🛡️ NetGuard

A full-stack, browser-based self-assessment tool that helps everyday users check the security of their home or small-office Wi-Fi setup.

Users answer a short series of yes/no questions about their network. Based on their answers, the system calculates a simple risk score (Low / Medium / High) and provides a checklist of clear, actionable fixes. The application includes a secure backend that saves assessment results and contact messages to a database (JSON file storage), viewable via a protected Admin Dashboard.

## 📚 Project Documents

| Document | Link |
|----------|------|
| **Application Development Workflow Worksheet** | [Open in Google Sheets](https://docs.google.com/spreadsheets/d/1ePzmws0MpG4CEh5o9x4xcvqGJ91ZuvOXTstRpDk-x0k/edit?usp=sharing) |
| **AI Use Statement** | [Open in Google Docs](https://docs.google.com/document/d/1d5d_AJy_V9Srx4gRgZh0hKpEZf1F6S4XSwOs-g-M4U4/edit?usp=sharing) |

---

## 📖 Table of Contents

- [Features](#-features)
- [Pages](#-pages)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [How It Works](#-how-it-works)
- [Design](#-design)
- [Team](#-team)
- [Course](#-course)

---

## ✨ Features

- **10-Question Wi-Fi Security Assessment** — Simple yes/no questions about your network setup.
- **Risk Score Calculation** — Automatically determines Low, Medium, or High risk.
- **Personalized Checklist** — Get specific fixes for anything flagged.
- **Save Progress (Frontend)** — Answers are saved locally with `localStorage`.
- **Full-Stack Backend** — Saves assessment results and contact messages securely to the server using JSON file persistence.
- **Admin Dashboard** — A secure, login-protected area for the team to view statistics, read messages, mark messages as resolved, and delete messages.
- **Active Navigation** — Highlights the current page in the menu.
- **Responsive Design** — Works on desktop, tablet, and mobile.

---

## 📄 Pages

| Page | File | Purpose |
|------|------|---------|
| **Home** | `public/index.html` | Landing page with hero, features, and security tips. |
| **Start Assessment** | `public/assessment.html` | The 10-question Wi-Fi security quiz. |
| **About Us** | `public/about.html` | Project background and FAQ. |
| **Contact Us** | `public/contact.html` | Contact form with backend integration. |
| **Admin Login** | `public/login.html` | Secure login for the team. |
| **Admin Dashboard** | `private/admin.html` | Protected page to view stats, messages, and results. |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Structure** | HTML5 |
| **Styling** | CSS3 (Custom Variables & Flexbox/Grid) |
| **Interactivity** | JavaScript (Vanilla) |
| **Backend** | Node.js + Express.js |
| **Security** | Express-Session (Admin Authentication) |
| **Storage** | JSON File Storage (`fs` module) & `localStorage` |
| **Version Control** | Git + GitHub |
| **Editor** | Visual Studio Code |

---

## 📁 Project Structure

```text
NetGuard/
├── app.js                 # Express Backend Server & API Routes
├── package.json           # Project dependencies (Express, express-session)
├── messages.json          # Saved contact messages
├── results.json           # Saved assessment results
├── public/                # Frontend files (visible to the browser)
│   ├── index.html
│   ├── assessment.html
│   ├── about.html
│   ├── contact.html
│   ├── login.html
│   ├── style.css
│   ├── script.js
│   └── images/
└── private/               # Protected files (only reachable after login)
    └── admin.html

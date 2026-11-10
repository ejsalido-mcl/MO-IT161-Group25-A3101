# 🛡️ NetGuard

**NetGuard is a free, browser-based self-assessment tool that helps everyday users check how secure their home or small-office Wi-Fi is.**

Many people never change their router's default password, skip firmware updates, or share their Wi-Fi password with everyone. NetGuard turns those risks into a short yes/no questionnaire. When you finish, it gives you a **risk level (Low / Medium / High)**, a **score**, and a **personalized checklist of fixes**, plus a link you can save to come back to your result later.

Behind the scenes, a Node.js/Express backend scores the answers, stores results and contact messages, and powers a password-protected **Admin Dashboard**. The team uses it to read messages, track assessment trends, see which security issues are most common, and edit the assessment questions.

---

## 📚 Project Documents

| Document | Link |
|----------|------|
| **Application Development Workflow Worksheet** | [Open in Google Sheets](https://docs.google.com/spreadsheets/d/1ePzmws0MpG4CEh5o9x4xcvqGJ91ZuvOXTstRpDk-x0k/edit?usp=sharing) |
| **AI Use Statement** | [Open in Google Docs](https://docs.google.com/document/d/1d5d_AJy_V9Srx4gRgZh0hKpEZf1F6S4XSwOs-g-M4U4/edit?usp=sharing) |

---

## 📖 Table of Contents

- [Features](#-features)
- [Pages](#-pages)
- [Tech Stack](#️-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Admin Accounts](#-admin-accounts)
- [Email Notifications](#-email-notifications)
- [How It Works](#️-how-it-works)
- [API Reference](#-api-reference)
- [Data & Privacy](#-data--privacy)
- [Security](#️-security)
- [Design](#-design)
- [Team](#-team)
- [Course](#-course)

---

## ✨ Features

### For visitors
- **Wi-Fi security assessment:** simple yes/no questions about your network setup, loaded from the server.
- **Risk score:** a Low, Medium or High rating with your score (for example, 7/10).
- **Personalized checklist:** a specific fix for every question answered unsafely.
- **Shareable result link:** each result gets its own private link (`/result?id=...`) so you can revisit it later.
- **Contact form:** send questions to the team, with clear validation messages.
- **Responsive design:** works on desktop, tablet and mobile (Bootstrap 5).

### For the team (Admin Dashboard)
- **Individual admin accounts:** everyone logs in with their own username and password.
- **Overview stats:** total assessments, average score, Low/Medium/High counts and new messages.
- **Charts:** assessments per day for the last 14 days, and the questions people most often answer unsafely.
- **Message inbox:** search, filter by status, mark as resolved or new, delete, and page through results.
- **Assessment history:** filter by risk level and date range, with paging.
- **CSV export:** download messages or results (respecting the current filters), ready for Excel or Google Sheets.
- **Question editor:** add, edit, reorder and delete assessment questions without touching the code.
- **Account management:** add or remove admins and change your own password.
- **Email alerts:** optional email notification whenever a new contact message arrives.

---

## 📄 Pages

| Page | URL | File | Purpose |
|------|-----|------|---------|
| **Home** | `/` | `public/index.html` | Landing page: what NetGuard does, how it works, risk levels and quick tips. |
| **Start Assessment** | `/assessment` | `public/assessment.html` | The Wi-Fi security questionnaire, results and checklist. |
| **Saved Result** | `/result?id=...` | `public/result.html` | Shows a previously saved result from its shareable link. |
| **About Us** | `/about` | `public/about.html` | Project mission and FAQ. |
| **Contact Us** | `/contact` | `public/contact.html` | Contact form that saves messages to the backend. |
| **Admin Login** | `/login` | `public/login.html` | Username and password login for the team. |
| **Choose Password** | `/change-password` | `private/change-password.html` | Shown at first login: admins must replace the starting password. |
| **Admin Dashboard** | `/admin` | `private/admin.html` | Protected dashboard: stats, charts, messages, results, questions and accounts. |

Files in `private/` are never served directly; the server only sends them to logged-in admins.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Structure** | HTML5 |
| **Styling** | Bootstrap 5.3 (CDN) + custom CSS theme (`style.css`) |
| **Interactivity** | Vanilla JavaScript (`fetch` API) |
| **Backend** | Node.js + Express 5 |
| **Sessions** | express-session (HTTP-only, SameSite=Strict cookies) |
| **Passwords** | scrypt hashing (Node's built-in `crypto`) |
| **Email** | Nodemailer (SMTP, e.g. Gmail) |
| **Storage** | JSON files (`fs` module) |
| **Version Control** | Git + GitHub |
| **Editor** | Visual Studio Code |

---

## 📁 Project Structure

```text
MO-IT161-Group25-A3101/
├── app.js                 # Express server: pages, API routes, validation, scoring
├── admin-accounts.js      # Admin account helpers: password hashing, storage, rules
├── manage-admins.js       # Command-line tool: npm run admin -- list | add | reset-password | delete
├── package.json           # Dependencies and npm scripts
├── .env.example           # Template for local settings (copy to .env)
├── questions.json         # Assessment questions (editable from the dashboard)
├── messages.json          # Saved contact messages
├── results.json           # Saved assessment results (with answers)
├── admins.json            # Admin accounts, password hashes (created on first run, NOT in git)
├── public/                # Files the browser can load directly
│   ├── index.html         # Home
│   ├── assessment.html    # Assessment
│   ├── result.html        # Saved result (shareable link)
│   ├── about.html         # About Us + FAQ
│   ├── contact.html       # Contact form
│   ├── login.html         # Admin login
│   ├── style.css          # Theme on top of Bootstrap
│   ├── script.js          # All front-end logic
│   └── images/
└── private/               # Only sent to logged-in admins
    ├── admin.html         # Admin dashboard
    └── change-password.html
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) **20.12 or newer** (tested on Node 24)
- Git

### Install and run

```bash
git clone https://github.com/ejsalido-mcl/MO-IT161-Group25-A3101.git
cd MO-IT161-Group25-A3101
npm install
npm start
```

Then open **http://localhost:3000**.

The first time the server starts, it creates the team's admin accounts (see [Admin Accounts](#-admin-accounts)) and `questions.json` with the default 10 questions.

> **Changed `app.js`?** Restart the server (Ctrl+C, then `npm start`). Changes to files in `public/` only need a browser refresh (Ctrl+F5).

### Optional settings (`.env`)

Copy the template and edit it:

```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

| Setting | What it does | Default |
|---------|--------------|---------|
| `PORT` | Port the server listens on | `3000` |
| `APP_URL` | Site address used in email links | `http://localhost:3000` |
| `INITIAL_ADMINS` | Accounts created on first run (comma-separated) | `roi,evan,lenard,hady` |
| `ADMIN_PASSWORD` | Starting password for those accounts | `netguard-admin` |
| `SESSION_SECRET` | Keeps admins logged in across restarts | random each start |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL`, `MAIL_FROM` | Email notifications | off |
| `MAIL_DRY_RUN` | Print emails in the terminal instead of sending | `false` |

`.env` is git-ignored, so passwords in it are never committed.

---

## 👤 Admin Accounts

### First login
On first run the server creates these accounts, all with the starting password **`netguard-admin`**:

| Username |
|----------|
| `roi` |
| `evan` |
| `lenard` |
| `hady` |

1. Go to **http://localhost:3000/login** and sign in (usernames are not case-sensitive).
2. You'll be taken to **Choose your password**. The dashboard stays locked until you set your own.
3. Your new password needs at least 8 characters, can't contain your username, and can't be `netguard-admin`.

### Managing accounts
- **From the dashboard** (Admin Accounts section): add an admin with a temporary password (they must change it at first login), delete an admin, or change your own password. Changing your password logs out your other sessions.
- **From the command line**, useful if someone forgets their password. The server doesn't need restarting:

```bash
npm run admin -- list                      # show all accounts
npm run admin -- add <username>            # new account (temporary password)
npm run admin -- reset-password <username> # reset to a temporary password (Enter = netguard-admin)
npm run admin -- delete <username>
```

> ⚠️ The starting password is visible in this public repository. Everyone should change it right away, and **before** the site is ever put online.

---

## 📧 Email Notifications

NetGuard can email the team whenever a contact message arrives. The email is plain text and includes the sender, subject and message; **Reply** goes straight to the visitor. It's **off by default**.

- **Try it without an email account:** set `MAIL_DRY_RUN=true` and `NOTIFY_EMAIL=admin@example.com` in `.env`. Emails are printed in the server terminal.
- **Send real emails with Gmail:**
  1. Turn on 2-Step Verification for the Google account.
  2. Create an **App password** (Google Account → Security → App passwords).
  3. In `.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<app password>`, `NOTIFY_EMAIL=<who receives alerts>`.
  4. Restart the server. It should print `Email notifications: on`.

If an email fails to send, the message is still saved and shown on the dashboard.

---

## ⚙️ How It Works

1. **Questions:** the assessment page loads the current questions from `GET /api/questions`.
2. **Answers:** the visitor answers every question; unanswered ones are highlighted.
3. **Scoring on the server:** the browser sends only the answers to `POST /save-result`. The server compares each answer to that question's safe answer, so scores can't be faked.
4. **Result:** the server saves the result (score, answers and checklist) and returns the risk level, score, checklist and a result ID.
5. **Shareable link:** the page shows `/result?id=<id>`, which anyone with the link can open later.
6. **Dashboard:** admins see the result in the stats, charts, history table and CSV export.

### Risk levels

The score is the number of questions answered safely. The risk level is based on the percentage of safe answers, so it still works if questions are added or removed.

| Risk level | Safe answers | With 10 questions |
|------------|--------------|-------------------|
| 🟢 **Low** | 80% or more | 8–10 |
| 🟡 **Medium** | 50–79% | 5–7 |
| 🔴 **High** | Below 50% | 0–4 |

---

## 🔌 API Reference

**Public**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/questions` | Current questions (`id`, `text` only) |
| `POST` | `/save-result` | Body `{ "answers": { "q1": "yes", ... } }`; scores, saves and returns the result |
| `GET` | `/api/results/:id` | One saved result (risk level, score, total, date, checklist) |
| `POST` | `/contact` | Body `{ name, email, subject?, message }`; saves a contact message |
| `POST` | `/login` | Body `{ username, password }` |
| `POST` | `/logout` | Ends the session |

**Admin only** (requires login; returns `401` if logged out, `403` if the password must be changed first)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me` | The logged-in admin |
| `POST` | `/api/me/password` | Body `{ currentPassword, newPassword }` |
| `GET` / `POST` | `/api/admins` | List accounts / add an account `{ username, password }` |
| `DELETE` | `/api/admins/:id` | Delete an account (not your own) |
| `GET` | `/api/messages` | `?status=new\|resolved&q=search&page=1&limit=10` |
| `PATCH` / `DELETE` | `/api/messages/:id` | Update status `{ "status": "resolved" }` / delete |
| `GET` | `/api/messages/export` | CSV download (same filters) |
| `GET` | `/api/results` | `?riskLevel=Low\|Medium\|High&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=10` |
| `GET` | `/api/results/export` | CSV download (same filters) |
| `GET` | `/api/stats` | Totals, average, risk counts, 14-day trend, per-question fail rates |
| `GET` | `/api/questions/full` | Questions including safe answers and fixes |
| `POST` | `/api/questions` | Add `{ text, safeAnswer: "yes"\|"no", fix }` |
| `PATCH` / `DELETE` | `/api/questions/:id` | Edit / delete a question |
| `POST` | `/api/questions/:id/move` | Reorder `{ "direction": "up"\|"down" }` |

Lists return `{ items, page, limit, total, totalPages }`. Errors return `{ "error": "message" }` with a `4xx` status.

---

## 🔒 Data & Privacy

| File | What's in it | In git? |
|------|--------------|---------|
| `results.json` | Each assessment's answers, score, risk level, checklist and date. **No names or emails.** | Yes |
| `messages.json` | Contact messages (name, email, subject, message, status) | Yes |
| `questions.json` | The assessment questions | Yes |
| `admins.json` | Admin usernames and **hashed** passwords | **No** (git-ignored) |
| `.env` | Local settings and email password | **No** (git-ignored) |

Results are only reachable by their random ID link or by admins.

---

## 🛡️ Security

- **Server-side validation** on every endpoint: field types, required fields, length limits, email format and a 10 KB request limit.
- **Server-side scoring:** the browser sends answers, never scores.
- **Passwords hashed with scrypt** and compared in constant time; unknown usernames take as long as wrong passwords, so usernames can't be discovered.
- **Login lockout:** 5 failed attempts lock that IP out for 15 minutes.
- **Forced password change** for new and reset accounts.
- **Sessions:** HTTP-only, SameSite=Strict cookies; a session ends when its account is deleted or its password changes.
- **Protected pages:** `private/` files and all admin APIs require login.
- **Output escaping:** user-submitted text is escaped before it's shown on the dashboard; CSV exports neutralize spreadsheet formulas.
- **Safe errors:** JSON error messages with no stack traces; `X-Powered-By` removed; `nosniff`, `X-Frame-Options` and `Referrer-Policy` headers set.
- **No secrets in git:** `admins.json` and `.env` are ignored.

---

## 🎨 Design

- **Bootstrap 5.3** for layout (grid, navbar, cards, forms, accordion, tables, pagination), themed with NetGuard's colors in `style.css`.
- **Clean, card-based layout** with a blue accent (`#2563eb`) on a light slate background.
- **Consistent risk colors:** green (Low), amber (Medium) and red (High), used on badges, cards and results.
- **Responsive:** the navbar collapses into a menu on phones, and layouts stack into one column.
- **Accessible:** semantic HTML, labelled form fields, keyboard-friendly controls, visible focus states, and charts with hover/focus tooltips plus a screen-reader table.

---

## 👥 Team

**Group 25** (Section A3101)

| Member |
|--------|
| Roi Jewel Carbonell |
| Evan |
| Lenard |
| Hady |

---

## 🎓 Course

**MO-IT161**, Group 25, Section A3101.

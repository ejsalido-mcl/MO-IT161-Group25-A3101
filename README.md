# 🛡️ NetGuard

A browser-based self-assessment tool that helps everyday users check the security of their home or small-office Wi-Fi setup.

Users answer 10 yes/no questions about their network. The **Node.js / Express server** scores the answers (Low / Medium / High risk), saves the result, and shows a checklist of clear, actionable fixes for anything flagged.

> **Milestone 2: Backend-Supported Web Application** (MO-IT161). Milestone 1 was a client-side-rendered (CSR) static site. Milestone 2 migrates it to **server-side rendering (SSR) with Node.js, Express and EJS**, and adds a REST API, validation and persistent storage.

---

## 📚 Project Documents

| Document | Link |
|----------|------|
| **Application Development Workflow Worksheet** | [Open in Google Sheets](https://docs.google.com/spreadsheets/d/1ePzmws0MpG4CEh5o9x4xcvqGJ91ZuvOXTstRpDk-x0k/edit?usp=sharing) |
| **AI Use Statement** | [Open in Google Docs](https://docs.google.com/document/d/1d5d_AJy_V9Srx4gRgZh0hKpEZf1F6S4XSwOs-g-M4U4/edit?usp=sharing) |

---

## 📖 Table of Contents

- [Features](#-features)
- [What Changed in Milestone 2](#-what-changed-in-milestone-2)
- [Pages](#-pages)
- [REST API](#-rest-api)
- [Tech Stack](#️-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [How It Works](#-how-it-works)
- [Testing](#-testing)
- [Design](#-design)
- [Scope and Limitations](#-scope-and-limitations)
- [Team](#-team)
- [Course](#-course)

---

## ✨ Features

- **10-Question Wi-Fi Security Assessment**: simple yes/no questions, rendered by the server from one data file
- **Server-side Risk Score**: Low (8-10 safe answers), Medium (5-7), High (0-4)
- **Personalized Checklist**: a specific fix for every unsafe answer
- **Saved Results (backend feature)**: every result is stored on the server in `data/assessments.json`, survives restarts, and can be revisited or deleted under **My Past Results**
- **Contact Form with a real backend**: validated on the server and stored in `data/messages.json`
- **Validation and clear errors**: field-level messages, answers kept after an error, JSON errors for the API
- **Save Your Progress**: unsent answers are kept in the browser with `localStorage`
- **Reset Button, loading states, delete confirmation**
- **Accessible**: skip link, `fieldset`/`legend` questions, labelled inputs, `aria-current` navigation, visible focus
- **Responsive Design**: works on desktop, tablet, and mobile
- **Learn More Carousel**: browse Wi-Fi security tips
- **Active Navigation**: the current page is highlighted by the server
- **Light protections**: anonymous HttpOnly cookie, HTML-escaped output, request size limits, basic rate limiting on writes

---

## 🔄 What Changed in Milestone 2

| Area | Milestone 1 (CSR) | Milestone 2 (SSR + backend) |
|------|-------------------|-----------------------------|
| Pages | 4 static `.html` files | EJS templates with shared header/footer partials, rendered by Express |
| Scoring | Browser JavaScript | `scoringService` on the server |
| Form submit | `preventDefault()` and DOM updates | `POST /assessment`, validate, save, then **303 redirect** to `/results/:id` |
| Storage | `localStorage` only | JSON-file persistence through a repository layer (plus a `localStorage` draft) |
| Contact form | Fake success message | `POST /contact`, validated and stored |
| Active nav link | JavaScript adds `.active` | Server sets `.active` and `aria-current` |
| Code organization | One `script.js` | Routes, controllers, services, repositories |
| API | None | REST API under `/api` |
| About page FAQ | "Nothing is saved" | Explains what is stored and how to delete it |

---

## 📄 Pages

| Route | View | Purpose |
|-------|------|---------|
| `GET /` | `index.ejs` | Landing page with hero, features, tips and carousel |
| `GET /assessment` | `assessment.ejs` | The 10-question Wi-Fi security quiz |
| `POST /assessment` | (redirect) | Validates, scores, saves, redirects to the result |
| `GET /results/:id` | `result.ejs` | Risk level, score and checklist |
| `GET /history` | `history.ejs` | Past results for this browser |
| `POST /history/:id/delete` | (redirect) | Deletes one saved result |
| `GET /about` | `about.ejs` | Project background and FAQ |
| `GET /contact` | `contact.ejs` | Contact form and support info |
| `POST /contact` | (redirect) | Validates and stores the message |

---

## 🔌 REST API

JSON in and out. Saved results are scoped to the caller's anonymous session cookie (`ng_sid`).

| Method | Endpoint | Description | Success | Errors |
|--------|----------|-------------|---------|--------|
| GET | `/api/health` | Server status | 200 | n/a |
| GET | `/api/questions` | The 10 questions | 200 | n/a |
| POST | `/api/assessments` | Score and save `{ "answers": { "q1": "yes", ..., "q10": "no" } }` | 201 | 400, 429 |
| GET | `/api/assessments` | List my saved results, newest first | 200 | n/a |
| GET | `/api/assessments/:id` | One saved result | 200 | 404 |
| DELETE | `/api/assessments/:id` | Delete one result | 204 | 404 |
| POST | `/api/contact` | `{ name, email, subject, message }` | 201 | 400 |

Example:

```bash
curl -c jar -b jar -X POST http://localhost:3000/api/assessments \
  -H "Content-Type: application/json" \
  -d '{"answers":{"q1":"yes","q2":"no","q3":"no","q4":"yes","q5":"yes","q6":"yes","q7":"yes","q8":"yes","q9":"yes","q10":"yes"}}'
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime / Server** | Node.js (18 or newer) and Express 4 |
| **Templating (SSR)** | EJS |
| **Persistence** | JSON files (atomic, serialized writes) |
| **Styling** | CSS3 |
| **Client JavaScript** | Vanilla JS (enhancements only) |
| **Fonts** | Google Fonts (Montserrat, Archivo Black) |
| **Testing** | Node's built-in test runner (`node:test`) |
| **Version Control** | Git + GitHub |
| **Editor** | Visual Studio Code |

---

## 📁 Project Structure

```
netguard/
├── server.js                    # Starts the server (PORT, default 3000)
├── package.json
├── src/
│   ├── app.js                   # Express setup: middleware, routes, error handling
│   ├── routes/
│   │   ├── pages.js             # HTML (SSR) routes
│   │   └── api.js               # REST API routes
│   ├── controllers/             # HTTP in/out only
│   │   ├── pageController.js
│   │   └── apiController.js
│   ├── services/                # Business logic
│   │   ├── scoringService.js    # validate answers and calculate risk
│   │   ├── assessmentService.js
│   │   └── contactService.js
│   ├── repositories/            # Data access (replaceable by a database later)
│   │   ├── jsonStore.js
│   │   ├── assessmentRepository.js
│   │   └── messageRepository.js
│   ├── middleware/              # session cookie, rate limit, error handler
│   ├── data/questions.js        # Questions, safe answers and fixes
│   └── utils/httpError.js
├── views/                       # EJS templates and partials/
├── public/                      # style.css, script.js, images/
├── data/                        # Runtime JSON storage (git-ignored)
├── tests/app.test.js            # 18 automated tests
└── docs/MILESTONE2_WORKSHEET.md
```

---

## 🚀 Getting Started

**Requirements:** [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone <your-repo-url>
cd <repo-folder>
git checkout milestone-2     # if the work is not merged into main yet
npm install
npm start
```

Open **http://localhost:3000**.

Other commands:

| Command | What it does |
|---------|--------------|
| `npm run dev` | Starts the server and restarts it when files change |
| `npm test` | Runs the automated tests |

Optional environment variables: `PORT` (default 3000), `DATA_DIR` (where JSON files are stored), `RATE_LIMIT_MAX` (write requests per minute per IP, default 30).

Images live in `public/images/` (`Netguard Logo.png`, `wifi-security.jpg`).

---

## ⚙️ How It Works

1. The visitor opens `/assessment`. Express renders the form from `src/data/questions.js`.
2. The form is sent with `POST /assessment`. The controller passes the answers to `assessmentService`.
3. `scoringService` validates all 10 answers. If any are missing or invalid, the form is shown again with error messages and the chosen answers kept (HTTP 400).
4. If valid, the score and risk level are calculated and the checklist is built from the unsafe answers.
5. `assessmentRepository` saves the record to `data/assessments.json`, tagged with the visitor's anonymous session id.
6. The server answers with a **303 redirect** to `/results/:id`, so refreshing the page never resubmits the form.
7. `/history` lists only the records that belong to the visitor's cookie. The same data is available through `/api/assessments`.

Request flow: `Route → Controller → Service → Repository → JSON file`, and back to an EJS view or a JSON response.

---

## 🧪 Testing

```bash
npm test
```

18 automated tests cover:
- all pages render and 404 handling (HTML and JSON)
- scoring at every boundary (10, 8, 7, 5, 4 and 0 safe answers) and the perfect-score checklist
- missing, invalid and malformed input
- saving, listing, fetching and deleting results
- **persistence after an application restart**
- one visitor cannot read or delete another visitor's results
- the full form, redirect, result, history, delete flow
- form errors re-rendered with answers preserved
- contact form validation and storage
- HTML escaping of user input
- concurrent writes

Manual scenarios to check before submitting: unanswered questions, double submit, refresh on the results page, restart the server and open **My Past Results**, open a result link in a private window (should be 404), empty contact form, invalid email, mobile width, keyboard-only navigation.

---

## 🎨 Design

- **Theme:** white, blue and lime
- **Colors:** primary blue `#1984c2`, accent lime `#32CD32`, risk colors green `#22c55e` / yellow `#eab308` / red `#ef4444`
- **Fonts:** Archivo Black (headings), Montserrat (body)
- **Layout:** centered 900px container, card grids, responsive down to mobile widths
- **Accessibility:** skip link, semantic landmarks, labelled form controls, visible keyboard focus

---

## 🎯 Scope and Limitations

Milestone 2 focuses on a **lightweight backend**. There are no user accounts or login, no database server, and no multi-user management. Storage is a JSON file, kept behind the repository layer so it can be swapped for a database later. Saved results are tied to the browser's anonymous cookie, so clearing cookies or switching browsers means old results can't be reached.

---

## 🎓 Course

MO-IT161 - Web Systems and Technology · Term 1, SY 2026-27 · Bachelor of Science in Information Technology · A3101

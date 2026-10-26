# Milestone 2 – Browser-Based Application Development Workflow Worksheet (draft content)

> Copy these into the matching worksheet sections. Items in **[brackets]** are for your team to fill in or confirm. Do not claim anything your team did not actually do or discuss.

**GitHub repository URL:** [paste link – make sure every teammate and the instructor has access]
**Worksheet link submitted by every member individually:** yes

---

## 1. Backend-Supported Features Analysis

| Feature | What it does | Frontend ↔ Backend communication | Why it fits the project |
|---|---|---|---|
| **Server-side assessment scoring + saved results** (main feature) | Server validates the 10 answers, calculates the risk level, stores the result, and shows it at `/results/:id`. Past results are listed at `/history` and can be deleted. | HTML form `POST /assessment` → controller → service → repository → JSON file → `303` redirect → server-rendered results page. Same logic exposed through `POST/GET/DELETE /api/assessments`. | Core purpose of NetGuard is scoring Wi-Fi security; saving lets users track improvement after applying fixes. |
| **Contact form backend** | Validates and stores messages. | `POST /contact` and `POST /api/contact` → `contactService` → `messages.json`. | Replaces the fake success message from Milestone 1 with real behaviour. |
| **Anonymous session cookie** | Lets each visitor see only their own results without accounts. | `ng_sid` HttpOnly cookie read by middleware on every request. | Privacy without building authentication (out of scope). |
| **REST API** (`/api/*`) | JSON endpoints for questions, assessments, contact, health. | Same services as the pages. | Extra initiative beyond the minimum: API routing + layered code. |

**Decisions made & rejected options:**
- Chose **JSON-file storage** over a database: meets "store information beyond the browser session" with minimal complexity; isolated in the repository layer so it can be swapped.
- Chose **EJS SSR** to migrate from CSR while keeping the Milestone 1 HTML/CSS almost unchanged.
- Rejected **login/accounts and a database** – explicitly out of scope for Milestone 2.

## 2. Completed Implementation Work

- Migrated 4 static pages to EJS templates with shared `header`/`footer` partials (SSR).
- Express app with routes → controllers → services → repositories → data layering.
- Questions, safe answers and fixes moved to a single data file used by form, scoring and API.
- Scoring moved from browser to server (same thresholds as Milestone 1).
- Persistence in `data/assessments.json` and `data/messages.json` (atomic, serialized writes).
- Server-side validation with field errors; answers preserved after an error; JSON errors for the API.
- Post/Redirect/Get so refreshing the results page never resubmits.
- History page with delete + confirmation.
- Middleware: anonymous session, rate limiting, 404/500 handling, security headers.
- Accessibility improvements (skip link, fieldset/legend, labels, `aria-current`, focus styles).
- About-page FAQ corrected (it previously said nothing is stored).
- 18 automated tests with Node's built-in test runner.

## 3. Implementation Dependencies

| Task | Depends on |
|---|---|
| Route handlers | Express app setup |
| Views | EJS configured + partials |
| Scoring service | `questions.js` data |
| Results page / history | Repository + persistence |
| Per-visitor results | Session middleware |
| API & pages | Shared services (no duplicated logic) |
| Tests | App factory `createApp()` |

Suggested order: 1) project + Express setup → 2) EJS migration → 3) questions + scoring service → 4) repository + persistence → 5) form POST/redirect/results → 6) validation + errors → 7) history/delete + session → 8) API routes → 9) contact → 10) tests + docs.

## 4. Workflow Updates & Revisions (Milestone 1 → 2)

- Static `.html` → `.ejs`; `script.js` scoring logic removed (now server-side); client script only adds enhancements.
- Navigation active state is rendered by the server.
- Added `package.json`, `server.js`, `src/`, `views/`, `public/`, `data/`, `tests/`.
- [Add anything your team changed in its plan, timeline or roles.]

## 5. Testing Summary (automated – all 18 passing)

| Scenario | Result |
|---|---|
| Valid input at every risk boundary (10, 8, 7, 5, 4, 0 safe answers) | Correct level and checklist length |
| Missing, invalid (`"maybe"`) and malformed-JSON input | `400` with clear messages; server stays up |
| Form with unanswered questions | Re-rendered with errors and answers kept |
| Refresh / repeated submission | PRG redirect – no duplicate on refresh |
| Application restart | Saved result still retrievable |
| Another visitor opening my result | `404` |
| Contact form valid / invalid | Stored / `400` with 4 field errors |
| HTML injection in form fields | Escaped |
| 15 simultaneous writes | None lost |

[Add your **manual** testing observations: browsers/devices tried, issues found and how you fixed them.]

## 6. Development Reflections

[Write in your own words. Prompts: What was hardest about moving from CSR to SSR? What did layering (routes/controllers/services/repositories) make easier? What bug or surprise did testing reveal? What would you add with more time (database, authentication)?]

Honest notes you may mention: scoring thresholds were kept identical to Milestone 1; storage is a JSON file, not a database, by design; Milestone 1 frontend refinements are planned for the TA.

## 7. Team Discussion Outcomes

[Record what your team actually decided in the review meeting: chosen backend feature, scope confirmation, challenges, final revisions, date of meeting.]

## 8. Milestone 2 Team Contributions Table

| Team member | Contributions | Approx. % |
|---|---|---|
| [Name] | [e.g. Express setup, routes] | |
| [Name] | [e.g. services, validation] | |
| [Name] | [e.g. views, accessibility] | |
| [Name] | [e.g. tests, documentation] | |

Every member must complete their row and submit the same worksheet link individually.

## 9. Rubric Alignment (self-check)

| Criterion | Evidence |
|---|---|
| Functional Suitability | Saved assessments, history/delete, contact storage, REST API, extensible layered structure |
| Usability | Clear errors with links to fields, preserved answers, loading states, delete confirmation, skip link, keyboard-friendly forms |
| Correctness & Performance | Server-side validation, atomic writes, rate limiting, 18 passing tests including restart and concurrency |
| Task Order & Prioritization | Dependency table and build order above |

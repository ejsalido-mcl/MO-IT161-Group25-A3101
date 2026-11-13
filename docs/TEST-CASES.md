# NetGuard — Test Cases

| | |
|---|---|
| **Project** | NetGuard Wi-Fi Security Self-Assessment (MO-IT161, Group 25, A3101) |
| **Version tested** | Branch `Carbonell` (after the "Add admin accounts…" and README commits) |
| **Test date** | 2026-11-10 |
| **Environment** | Windows 11 Pro, Node.js 24.22.1, Express 5.3.0 |
| **Automated suite** | `npm test` — 70 tests in `test/*.test.js` (Node.js built-in test runner) |
| **Saved results** | `npm run test:report` writes [`docs/test-results.txt`](test-results.txt) |
| **Related** | [Defect Log](DEFECT-LOG.md) |

---

## 1. How to run the tests

```bash
npm install
npm test               # run everything (about 3 seconds)
npm run test:report    # same, and save the results to docs/test-results.txt
```

**Setup and teardown (done automatically by `test/helpers.js`):**
- **Setup:** each test file starts its own NetGuard server on a free port, with a new empty temporary data folder (`DATA_DIR`). Emails run in dry-run mode, so they are captured instead of being sent. Some tests seed starting data, for example an old-format result.
- **Teardown:** when the file finishes, the server is stopped and its temporary data folder is deleted.
- **Isolation:** the real `messages.json`, `results.json`, `questions.json` and `admins.json` are never touched. Test files run in parallel without affecting each other.

---

## 2. Summary

| Area | Test IDs | Automated tests | Passed | Failed |
|------|----------|-----------------|--------|--------|
| Pages, file protection & error handling | TC-PAGE, TC-SEC, TC-ERR | 9 | 9 | 0 |
| Assessment & scoring | TC-ASM | 11 | 11 | 0 |
| Saved result links | TC-RES | 5 | 5 | 0 |
| Contact form & email alerts | TC-CON, TC-MAIL | 9 | 9 | 0 |
| Admin accounts & login security | TC-AUTH | 15 | 15 | 0 |
| Admin dashboard APIs | TC-ADM, TC-MSG, TC-RSL, TC-CSV, TC-STAT, TC-QST | 16 | 16 | 0 |
| Stress / performance | TC-PERF | 5 | 5 | 0 |
| **Total (automated)** | | **70** | **70** | **0** |
| Manual UI checks | TC-UI | 14 | to be run | |

**Techniques used:** equivalence partitioning (valid and invalid classes), boundary value analysis (risk-level thresholds, field length limits, paging limits), negative testing, security testing (access control, injection, brute force, timing, path traversal, CSV formula injection), concurrency and stress testing, and regression tests for every logged defect.

---

## 3. Test cases

**Status key:** ✅ Pass · ❌ Fail · ⬜ Not yet run.
For automated cases, "Actual" is the result of the 2026-11-10 run ([test-results.txt](test-results.txt)).

### 3.1 Pages, file protection & error handling — `test/pages-and-security.test.js`

| ID | Requirement | Steps | Test data | Expected | Actual | Status |
|----|-------------|-------|-----------|----------|--------|--------|
| TC-PAGE-01 | All public pages load | GET each page and asset | `/`, `/assessment`, `/about`, `/contact`, `/login`, `/result`, CSS, JS, images | 200 for every URL | 200 for all 10 | ✅ |
| TC-PAGE-02 | Admin pages need login | GET while logged out | `/admin`, `/change-password` | 302 redirect to `/login` | 302 → `/login` | ✅ |
| TC-SEC-01 | Server/data files can't be downloaded | GET each file directly | `app.js`, `.env`, `package.json`, `*.json` data, `private/*.html` | 404 for every file | 404 for all 12 | ✅ |
| TC-SEC-02 | Path traversal blocked | GET encoded `../` paths | `/..%2fapp.js`, `/%2e%2e/messages.json`, `/..%5capp.js`, … | 400/403/404, no source code returned | 404, no source leaked | ✅ |
| TC-SEC-03 | Security headers | GET `/`, inspect headers | — | No `X-Powered-By`; `nosniff`, `DENY`, `same-origin` set | As expected | ✅ |
| TC-ERR-01 | Broken JSON handled cleanly | POST invalid JSON | `{"name":` | 400 JSON error, no stack trace or file paths | 400 `Request body is not valid JSON.` | ✅ |
| TC-ERR-02 | Oversized requests refused | POST 20 KB body | 20,000-char message | 413 | 413 `Request is too large.` | ✅ |
| TC-ERR-03 | Unknown API routes | GET unknown route | `/api/does-not-exist` | 404 JSON `{ error }` | 404 `Not found.` | ✅ |
| TC-ERR-04 | Missing body never crashes server | POST with no body | `/contact`, `/save-result`, `/login` | 400 with message (never 500) | 400 with message | ✅ |

### 3.2 Assessment & scoring — `test/assessment.test.js`

| ID | Requirement | Steps | Test data | Expected | Actual | Status |
|----|-------------|-------|-----------|----------|--------|--------|
| TC-ASM-01 | Questions served without answers | GET `/api/questions` | — | 10 questions, only `id` and `text` | As expected | ✅ |
| TC-ASM-02a | Boundary: top score | POST `/save-result` | 10/10 safe | Low, 0 fixes | Low, 0 fixes | ✅ |
| TC-ASM-02b | Boundary: Low threshold (80%) | POST `/save-result` | 8/10 safe | Low, 2 fixes | Low, 2 fixes | ✅ |
| TC-ASM-02c | Boundary: just below Low | POST `/save-result` | 7/10 safe | Medium, 3 fixes | Medium, 3 fixes | ✅ |
| TC-ASM-02d | Boundary: Medium threshold (50%) | POST `/save-result` | 5/10 safe | Medium, 5 fixes | Medium, 5 fixes | ✅ |
| TC-ASM-02e | Boundary: just below Medium | POST `/save-result` | 4/10 safe | High, 6 fixes | High, 6 fixes | ✅ |
| TC-ASM-02f | Boundary: lowest score | POST `/save-result` | 0/10 safe | High, 10 fixes | High, 10 fixes | ✅ |
| TC-ASM-03 | Correct fixes listed | Answer q1 "no", q3 "yes" | Otherwise safe | Exactly the 2 matching fixes, in order | As expected | ✅ |
| TC-ASM-04 | Answers saved with result | Submit, read `results.json` | 7/10 | 10 answers, 3 fixes, valid `createdAt` stored | As expected | ✅ |
| TC-ASM-05 | Browser can't send its own score | POST old format | `{ riskLevel: "Low", score: 10 }` | 400 | 400 | ✅ |
| TC-ASM-06 | Invalid answer sets rejected | POST each invalid set | Missing answer, `"maybe"`, unknown id, array, string, none | 400 with message for each | 400 for all 6 | ✅ |

### 3.3 Saved result links — `test/assessment.test.js`

| ID | Requirement | Steps | Test data | Expected | Actual | Status |
|----|-------------|-------|-----------|----------|--------|--------|
| TC-RES-01 | Link shows that result | Submit, then GET `/api/results/:id` | 8/10 | Score, total, date, checklist — no raw answers | As expected | ✅ |
| TC-RES-02 | Uppercase link works | GET with id in capitals | — | 200 | 200 | ✅ |
| TC-RES-03 | Bad links handled | GET invalid/unknown ids | `abc`, `..%2f..%2fapp.js`, unused UUID | 400, 400, 404 | 400, 400, 404 | ✅ |
| TC-RES-04 | Old results still open | GET a pre-upgrade result | Seeded result with no `answers`/`total` | 200, total 10, checklist `null` | As expected | ✅ |
| TC-RES-05 | Full list is private | GET `/api/results` logged out | — | 401 | 401 | ✅ |

### 3.4 Contact form & email — `test/contact.test.js`

| ID | Requirement | Steps | Test data | Expected | Actual | Status |
|----|-------------|-------|-----------|----------|--------|--------|
| TC-CON-01 | Valid message saved | POST `/contact` | Name, email, subject, message | 200; saved with status `new`, id, timestamp | As expected | ✅ |
| TC-CON-02 | Subject optional, text trimmed | POST with spaces, no subject | `"  Ana  "` | Saved as `Ana`, subject `""` | As expected | ✅ |
| TC-CON-03 | Required fields | Remove / blank each field | name, email, message | 400 each time | 400 ×6 | ✅ |
| TC-CON-04 | Email format | POST invalid emails | `not-an-email`, `a@b`, `@example.com`, `a b@…`, `a@@…` | 400 `Invalid email address.` | As expected | ✅ |
| TC-CON-05 | Wrong data types | name as number/bool/array/object | `123`, `true`, `["x"]`, `{}` | 400 `must be text` (no crash) | As expected | ✅ |
| TC-CON-06 | Length limits (boundary) | POST max and max+1 | name 100/101, subject 150/151, message 2000/2001 | Max accepted, max+1 → 400 `too long` | As expected | ✅ |
| TC-CON-07 | Script tags stored as text | POST `<script>` name | `<script>alert(1)</script>` | Stored as plain text (escaped on dashboard) | As expected | ✅ |
| TC-MAIL-01 | Admin gets an email | POST message, read dry-run log | Subject "Email check" | Plain-text email to admin, Reply-To = visitor, no HTML | As expected | ✅ |
| TC-MAIL-02 | Email header injection blocked | Subject containing CRLF + `Bcc:` | `Hi\r\nBcc: evil@…` | Line break removed; no Bcc header | As expected | ✅ |

### 3.5 Admin accounts & login security — `test/auth.test.js`

| ID | Requirement | Steps | Test data | Expected | Actual | Status |
|----|-------------|-------|-----------|----------|--------|--------|
| TC-AUTH-01 | Team accounts created on first run | Start fresh server, read `admins.json` | — | roi, evan, lenard, hady; scrypt hashes; must change password; no plain password stored | As expected | ✅ |
| TC-AUTH-02 | Usernames can't be discovered | Log in with unknown user, then wrong password | `ghost` / `evan` | Same 401 response for both | Identical responses | ✅ |
| TC-AUTH-03 | Login input validated | POST missing/array fields | 5 invalid bodies | 400 each | 400 ×5 | ✅ |
| TC-AUTH-04 | Usernames not case-sensitive | Log in as `"  EVAN "` | — | 200, username `evan` | As expected | ✅ |
| TC-AUTH-05 | First login forces password change | Log in, open dashboard and APIs | lenard / starting password | `/admin` → `/change-password`; admin APIs 403; `/api/me` allowed | As expected | ✅ |
| TC-AUTH-06 | Password rules | Try invalid new passwords | Too short, contains username, starting password, 129 chars, wrong current | 400 each | 400 ×5 | ✅ |
| TC-AUTH-07 | Password change works | Change password with 2 sessions open | evan | Dashboard opens; other session logged out; old password fails; new works | As expected | ✅ |
| TC-AUTH-08 | Add admin accounts | Add invalid then valid account | Short/space name, weak password, duplicate `ROI`, then `Newbie` | 400/400/400/409, then 201; new account must change password | As expected | ✅ |
| TC-AUTH-09 | Hashes never exposed | GET `/api/admins` | — | No `scrypt$` in response; exactly one `isYou` | As expected | ✅ |
| TC-AUTH-10 | Delete accounts | Delete self, delete other, delete again | — | 400 (self), 200 + victim's session ends, 404 | As expected | ✅ |
| TC-AUTH-11 | Logout | POST `/logout`, then GET `/api/me` | — | 200 then 401 | As expected | ✅ |
| TC-AUTH-12 | CLI password reset | `manage-admins.js reset-password roi`, press Enter | — | Exit 0; roi logged out; must change password again | As expected | ✅ |
| TC-AUTH-13 | Damaged accounts file | Start with corrupt `admins.json` | `{ broken` | Server exits with code 1; file left untouched | As expected | ✅ |
| TC-AUTH-14 | Brute-force lockout | 5 wrong passwords, then the right one | Fresh server | Attempts 1–5: 401; 6th (correct): 429 | As expected | ✅ |
| TC-AUTH-15 | Successful login resets counter | 4 wrong, 1 right, 4 wrong | Fresh server | All later attempts 401, not 429 | As expected | ✅ |

### 3.6 Admin dashboard APIs — `test/admin-dashboard.test.js`
**Setup:** 13 messages (including one with formula, comma, quote and line break) and 12 results with scores 10, 9, 8, 8, 7, 6, 5, 5, 4, 3, 1, 0.

| ID | Requirement | Steps | Test data | Expected | Actual | Status |
|----|-------------|-------|-----------|----------|--------|--------|
| TC-ADM-01 | Every admin endpoint needs login | Call 17 admin endpoints logged out | — | 401 for all | 401 ×17 | ✅ |
| TC-MSG-01 | Paging, newest first | GET pages 1, 3, 99 (limit 5) | 13 messages | total 13, 3 pages; newest first; page 3 has 3; page 99 empty | As expected | ✅ |
| TC-MSG-02 | Search & status filter | Search `VISITOR 12`; resolve one; filter resolved | — | Case-insensitive match; exactly 1 resolved | As expected | ✅ |
| TC-MSG-03 | Invalid paging/filters | GET with bad values | `page=0/-1/abc/1.5`, `limit=0/101`, repeated `page`, `status=deleted`, 101-char search | 400 each | 400 ×9 | ✅ |
| TC-MSG-04 | Update & delete | Bad status, empty body, unknown id, delete twice | — | 400, 400, 404, 200, 404 | As expected | ✅ |
| TC-RSL-01 | Result filters | Filter High; today; before 2000 | — | 4 High; 12 today; 0 | As expected | ✅ |
| TC-RSL-02 | Invalid result filters | GET with bad values | `riskLevel=low`, `Extreme`, US-format date, month 13, from > to, `limit=500` | 400 each | 400 ×6 | ✅ |
| TC-CSV-01 | Message CSV download | GET export with filter | `q=csv@example.com` | `text/csv`, attachment file name with date, starts with BOM, correct header | As expected | ✅ |
| TC-CSV-02 | CSV escaping & formula safety | Inspect exported cell values | `=HYPERLINK(...)`, `Comma, "quote"`, `line1\nline2` | Formula prefixed with `'`; quotes doubled; line break kept in one cell | As expected | ✅ |
| TC-CSV-03 | Results CSV | Export Low results | — | Header includes Out Of and Fixes Needed; 4 rows | As expected | ✅ |
| TC-STAT-01 | Stats are correct | GET `/api/stats` | 12 results, 12 messages | total 12; 4/4/4 by level; average 55%; 14 days, 12 today | As expected | ✅ |
| TC-STAT-02 | Per-question fail rates | GET `/api/stats` | — | 10 questions, each answered 12×; sorted by fail rate; q1 first | As expected | ✅ |
| TC-QST-01 | Question editor | Add, edit, move up, delete | VPN question | 201, 200, moved to position 10, 200; public list back to 10 | As expected | ✅ |
| TC-QST-02 | Question validation | Invalid add/edit/move | Missing fix, bad safe answer, 201 chars, number, empty edit, unknown id, move top up, bad direction | 400/404 as appropriate | As expected | ✅ |
| TC-QST-03 | Scoring follows edited questions | Add question; submit old and new answer sets | WPS question | Old 10-answer set → 400 (reload); new set → 10/11 Low with the new fix | As expected | ✅ |
| TC-QST-04 | Keep at least one question | Delete all questions | — | Last delete → 400 | 400 `at least one question` | ✅ |

### 3.7 Stress & performance — `test/stress.test.js`

| ID | Requirement | Steps | Load | Expected | Actual (2026-11-10) | Status |
|----|-------------|-------|------|----------|---------------------|--------|
| TC-PERF-01 | No lost assessments under load | Send all requests at once | 200 × `/save-result` | 200 successes, 200 unique ids, 200 rows on disk, p95 < 3 s | 200/200 saved; p50 383 ms, p95 662 ms | ✅ |
| TC-PERF-02 | No lost messages under load | Send all at once | 100 × `/contact` | 100 successes, 100 rows on disk | 100/100 saved; p95 131 ms | ✅ |
| TC-PERF-03 | Pages stay responsive | Mixed reads at once | 300 × pages/CSS/JS/API | All 200 | 300/300; p95 173 ms | ✅ |
| TC-PERF-04 | Dashboard fast with data | Stats/paging/search/export at once | 50 requests, 200 results + 100 messages stored | All 200; stats total 200 | 50/50; p95 150 ms | ✅ |
| TC-PERF-05 | Login handles bursts | Parallel logins (scrypt hashing) | 20 logins | All succeed | 20/20 in 194 ms | ✅ |

**Performance analysis:** assessment saves are the slowest operation, because every save reads and rewrites the whole `results.json` file. At 200 simultaneous submissions the slowest response was still under 0.7 s, with no failures and no lost data. Node handles each synchronous file write completely before starting the next request, so concurrent writes can't overwrite each other. Response time will grow with the file's size. If the site reached thousands of results, moving to a database (for example SQLite) is the recommended next step.

### 3.8 Manual UI checks (browser)
These cover what the API tests can't see: layout, interaction and accessibility. Run them in Chrome or Edge with the server on http://localhost:3000, and again at phone width (DevTools → device toolbar, 390 px).

| ID | Requirement | Steps | Expected | Actual | Status |
|----|-------------|-------|----------|--------|--------|
| TC-UI-01 | Navigation | Click every navbar link on every page | Correct page opens; current page highlighted | | ⬜ |
| TC-UI-02 | Mobile menu | At 390 px width, tap ☰ | Menu opens and closes; links work | | ⬜ |
| TC-UI-03 | Unanswered questions highlighted | Answer 9 of 10, press Calculate | Red outline on the missed question, message "1 left", page scrolls to it | | ⬜ |
| TC-UI-04 | Result display | Answer all, press Calculate | Risk level in its colour, score, checklist and result link appear | | ⬜ |
| TC-UI-05 | Copy result link | Press Copy link, paste in a new tab | Button shows "Copied!"; saved result page shows the same result | | ⬜ |
| TC-UI-06 | Contact form feedback | Submit empty, then valid | Empty: error; valid: green thank-you message and form clears | | ⬜ |
| TC-UI-07 | FAQ accordion | Open each FAQ item on About | One opens at a time; keyboard (Tab + Enter) works | | ⬜ |
| TC-UI-08 | Login errors | Wrong password, then 6th attempt | "Wrong username or password", then lockout message | | ⬜ |
| TC-UI-09 | Forced password change | Log in as a new account | Redirected to Choose your password; dashboard opens after saving | | ⬜ |
| TC-UI-10 | Dashboard filters & paging | Type in search, change status, page through | Table updates as you type; "Showing x–y of z" correct | | ⬜ |
| TC-UI-11 | CSV export | Filter, then Export CSV; open in Excel | File downloads, opens with correct columns and characters | | ⬜ |
| TC-UI-12 | Charts | Hover and Tab through chart bars | Tooltip shows date/count or fail rate | | ⬜ |
| TC-UI-13 | Question editor | Add, edit, move, delete a question; take the assessment | Assessment shows the change | | ⬜ |
| TC-UI-14 | Keyboard only | Complete an assessment using only Tab, Space and Enter | Every control reachable with a visible focus outline | | ⬜ |

---

## 4. Requirements coverage

| Requirement | Covered by |
|-------------|-----------|
| Users can take the assessment and get a risk level | TC-ASM-01 – 06, TC-UI-03, TC-UI-04 |
| Personalized checklist of fixes | TC-ASM-03, TC-ASM-04, TC-RES-01 |
| Results saved and revisitable | TC-ASM-04, TC-RES-01 – 05, TC-UI-05 |
| Contact form saves messages | TC-CON-01 – 07, TC-UI-06 |
| Admin-only dashboard | TC-PAGE-02, TC-ADM-01, TC-AUTH-05 |
| Manage messages (filter, resolve, delete, export) | TC-MSG-01 – 04, TC-CSV-01 – 02, TC-UI-10 – 11 |
| Assessment history & statistics | TC-RSL-01 – 02, TC-CSV-03, TC-STAT-01 – 02, TC-UI-12 |
| Editable questions | TC-QST-01 – 04, TC-UI-13 |
| Individual admin accounts | TC-AUTH-01 – 15 |
| Email notifications | TC-MAIL-01 – 02 |
| Input validation & error handling | TC-ERR-01 – 04, TC-CON-03 – 06, TC-ASM-06, TC-MSG-03, TC-RSL-02, TC-QST-02 |
| Security | TC-SEC-01 – 03, TC-AUTH-02, TC-AUTH-13 – 14, TC-CSV-02, TC-MAIL-02, TC-CON-07 |
| Performance under load | TC-PERF-01 – 05 |

# NetGuard — Defect Log

Every defect found while testing NetGuard: how it was found, why it happened, how it was fixed, and which automated test now makes sure it doesn't come back.

**Related:** [Test Cases](TEST-CASES.md) · [Latest test results](test-results.txt)

**Severity:**
- 🔴 **Critical:** a security hole or data loss.
- 🟠 **High:** the server crashes or a core feature is wrong.
- 🟡 **Medium:** wrong behaviour that has a workaround.
- 🟢 **Low:** a cosmetic or minor issue.

---

## Summary

| ID | Title | Severity | Found | Status | Fixed in | Regression test |
|----|-------|----------|-------|--------|----------|-----------------|
| D-01 | Requests with no body crash the server (500) | 🟠 High | 2026-11-09 | ✅ Fixed | `2787b85` | TC-ERR-04 |
| D-02 | Non-text form values crash the server (500) | 🟠 High | 2026-11-09 | ✅ Fixed | `2787b85` | TC-CON-05, TC-AUTH-03 |
| D-03 | Error pages reveal stack traces and file paths | 🟡 Medium | 2026-11-09 | ✅ Fixed | `2787b85` | TC-ERR-01 |
| D-04 | Login accepts the password inside an array | 🟡 Medium | 2026-11-09 | ✅ Fixed | `2787b85` | TC-AUTH-03 |
| D-05 | No length limits on contact form fields | 🟡 Medium | 2026-11-09 | ✅ Fixed | `2787b85` | TC-CON-06, TC-ERR-02 |
| D-06 | Server trusts the risk level and score sent by the browser | 🔴 Critical | 2026-11-09 | ✅ Fixed | `2787b85`, `77952f3` | TC-ASM-05, TC-ASM-02 |
| D-07 | No protection against password guessing | 🔴 Critical | 2026-11-09 | ✅ Fixed | `2787b85` | TC-AUTH-14, TC-AUTH-15 |
| D-08 | Server advertises its software (`X-Powered-By`) and lacks security headers | 🟢 Low | 2026-11-09 | ✅ Fixed | `2787b85` | TC-SEC-03 |
| D-09 | Result links in uppercase show "not found" | 🟢 Low | 2026-11-09 | ✅ Fixed | `7983233` | TC-RES-02 |
| D-10 | Bootstrap `.placeholder` style breaks the results text | 🟢 Low | 2026-11-09 | ✅ Fixed | `6684892` | TC-UI-04 (manual) |
| D-11 | Shared admin password published in the public repo | 🔴 Critical | 2026-11-09 | ✅ Fixed | `77952f3` | TC-AUTH-01, TC-AUTH-05 |
| D-12 | Vulnerable Nodemailer and body-parser versions | 🟠 High | 2026-11-10 | ✅ Fixed | `77952f3` | `npm audit` (0 vulnerabilities) |
| D-13 | About page privacy statement became untrue | 🟡 Medium | 2026-11-10 | ✅ Fixed | `77952f3` | Manual review |
| D-14 | Records saved in the same millisecond listed oldest first | 🟢 Low | 2026-11-10 | ✅ Fixed | this commit | TC-MSG-01 |
| D-15 | Contact form has no rate limit (spam / email flooding) | 🟡 Medium | 2026-11-10 | 🔓 Open | — | — |

**Totals:** 15 logged · 14 fixed · 1 open (3 critical, 3 high, 5 medium, 4 low).

---

## Details

### D-01: Requests with no body crash the server
- **Severity:** 🟠 High
- **Found by:** external HTTP testing (sending requests without a JSON body)
- **Steps to reproduce:** `POST /login`, `/contact` or `/save-result` with no body and no `Content-Type`.
- **Expected:** a 400 error with a clear message.
- **Actual:** a 500 Internal Server Error with the message `TypeError: Cannot destructure property ... of req.body as it is undefined`.
- **Root cause:** Express 5 leaves `req.body` as `undefined` when no JSON body is sent, and the handlers read from it directly.
- **Fix:** middleware sets `req.body = {}` when there's no body, and every field is then validated. (`2787b85`)
- **Regression test:** TC-ERR-04

### D-02: Non-text form values crash the server
- **Severity:** 🟠 High
- **Found by:** negative testing with wrong data types
- **Steps:** `POST /contact` with `{"name": 123, ...}` or `{"subject": {}}`.
- **Expected:** 400 "The name field must be text."
- **Actual:** 500 `TypeError: name.trim is not a function`.
- **Root cause:** the code called `.trim()` without checking that the value was a string.
- **Fix:** a `cleanText()` helper type-checks every field before using it. (`2787b85`)
- **Regression tests:** TC-CON-05, TC-AUTH-03

### D-03: Error pages reveal stack traces and file paths
- **Severity:** 🟡 Medium (information disclosure)
- **Found by:** security testing (sending malformed JSON)
- **Steps:** `POST /contact` with the body `{"bad":`.
- **Expected:** a short JSON error.
- **Actual:** an HTML page showing the full stack trace, including `C:\Users\...\node_modules\body-parser\...`.
- **Root cause:** Express's default error handler shows stack traces when not in production mode.
- **Fix:** a custom error handler returns JSON only (400, 413 or 500) and never includes the stack. (`2787b85`)
- **Regression test:** TC-ERR-01

### D-04: Login accepts the password inside an array
- **Severity:** 🟡 Medium
- **Found by:** security testing (type confusion)
- **Steps:** `POST /login` with `{"password": ["netguard-admin"]}`.
- **Expected:** 400.
- **Actual:** 200, logged in.
- **Root cause:** `String(["netguard-admin"])` becomes `"netguard-admin"`, so the comparison passed. (The password still had to be known, so this was not a bypass.)
- **Fix:** the login requires `typeof password === "string"`, and now also a username. (`2787b85`)
- **Regression test:** TC-AUTH-03

### D-05: No length limits on contact form fields
- **Severity:** 🟡 Medium (storage abuse)
- **Found by:** boundary testing
- **Steps:** `POST /contact` with a 10,000-character name.
- **Expected:** 400 "too long".
- **Actual:** 200, and the name was saved.
- **Fix:**
  - Limits of name 100, email 254, subject 150 and message 2,000 characters.
  - A 10 KB request limit.
  - Matching `maxlength` attributes on the form fields.

  (`2787b85`)
- **Regression tests:** TC-CON-06, TC-ERR-02

### D-06: Server trusts the risk level and score sent by the browser
- **Severity:** 🔴 Critical (data integrity)
- **Found by:** security testing
- **Steps:** `POST /save-result` with `{"riskLevel": "Low", "score": 0}`.
- **Expected:** rejected.
- **Actual:** saved, so anyone could fill the statistics with fake results.
- **Root cause:** scoring happened only in the browser, and the server stored whatever it received.
- **Fix:**
  1. A first fix checked that the level matched the score. (`2787b85`)
  2. The final fix moved scoring to the server: the browser sends only answers, and the server compares them with each question's safe answer. (`77952f3`)
- **Regression tests:** TC-ASM-05, TC-ASM-02 (a–f)

### D-07: No protection against password guessing
- **Severity:** 🔴 Critical
- **Found by:** code review and security testing
- **Steps:** send unlimited wrong passwords to `POST /login`.
- **Expected:** a lockout after a few attempts.
- **Actual:** unlimited attempts were accepted.
- **Fix:**
  - 5 failed attempts lock that IP out for 15 minutes (429).
  - A successful login resets the counter.
  - Passwords are compared in constant time.

  (`2787b85`)
- **Regression tests:** TC-AUTH-14, TC-AUTH-15

### D-08: Server advertises its software and lacks security headers
- **Severity:** 🟢 Low
- **Found by:** header inspection
- **Actual:** every response included `X-Powered-By: Express`, and there were no `nosniff` or frame-protection headers.
- **Fix:** the `X-Powered-By` header is disabled, and `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` are added. (`2787b85`)
- **Regression test:** TC-SEC-03

### D-09: Result links in uppercase show "not found"
- **Severity:** 🟢 Low
- **Found by:** automated endpoint test during development of the result-link feature
- **Steps:** open `/api/results/<ID IN UPPERCASE>`.
- **Expected:** 200.
- **Actual:** 404.
- **Root cause:** the ID format check ignored case, but the lookup compared IDs exactly.
- **Fix:** the ID is lowercased before both the check and the lookup. (`7983233`)
- **Regression test:** TC-RES-02

### D-10: Bootstrap `.placeholder` style breaks the results text
- **Severity:** 🟢 Low
- **Found by:** code review while applying Bootstrap
- **Actual:** the results placeholder used the class `placeholder`, which Bootstrap 5 reserves for its grey loading-skeleton effect.
- **Fix:** the element now uses Bootstrap's `text-body-secondary` utility class instead. (`6684892`)
- **Regression test:** TC-UI-04 (manual)

### D-11: Shared admin password published in the public repo
- **Severity:** 🔴 Critical
- **Found by:** code review
- **Actual:** `app.js` fell back to the password `netguard-admin` when `ADMIN_PASSWORD` wasn't set, and the code is public on GitHub, so anyone could log in to the dashboard.
- **Fix:** individual admin accounts with scrypt-hashed passwords, stored in a git-ignored `admins.json`. New accounts start with a temporary password, and the dashboard stays locked until the person chooses their own. (`77952f3`)
- **Regression tests:** TC-AUTH-01, TC-AUTH-05, TC-AUTH-06
- **Note:** the starting password is still in the code, so accounts that haven't logged in yet should be activated before the site goes online.

### D-12: Vulnerable Nodemailer and body-parser versions
- **Severity:** 🟠 High
- **Found by:** `npm audit` after installing Nodemailer
- **Actual:** Nodemailer 6.x had several high-severity advisories (SMTP command injection, header injection and more), and body-parser 2.3.0 had a denial-of-service advisory.
- **Fix:** upgraded to Nodemailer 10.4.0 and ran `npm audit fix` (body-parser 2.4.0). `npm audit` now reports 0 vulnerabilities. (`77952f3`)

### D-13: About page privacy statement became untrue
- **Severity:** 🟡 Medium (misleading users)
- **Found by:** review after the "save answers" feature was added
- **Actual:** the FAQ said "Your individual answers ... are not saved", but answers are now stored with each result.
- **Fix:** the FAQ now says exactly what is stored and why, and that no personal details are kept with results. (`77952f3`)

### D-14: Records saved in the same millisecond listed oldest first
- **Severity:** 🟢 Low
- **Found by:** writing TC-MSG-01 ("messages are paged, newest first")
- **Steps:** save two messages within the same millisecond, then list messages.
- **Expected:** the newer message first.
- **Actual:** they kept their saved order, oldest first, because the sort sees equal timestamps.
- **Fix:** the list is reversed before the stable newest-first sort, so ties come out newest first. (this commit)
- **Regression test:** TC-MSG-01

### D-15: Contact form has no rate limit (open)
- **Severity:** 🟡 Medium
- **Found by:** review of the email notification feature
- **Risk:** a script could send thousands of messages, filling `messages.json` and, if email alerts are on, the admin's inbox.
- **Planned fix:** limit messages per IP, for example 5 per 10 minutes, the same way the login lockout works.
- **Status:** open; accepted for now because the site runs locally.

---

## Environment issues (not code defects)

| Issue | What happened | Resolution |
|-------|---------------|------------|
| Old server kept running | After `app.js` changed, a server started earlier was still on port 3000, so the new result link didn't appear. A new `node app.js` failed with `EADDRINUSE`. | Stop the old process (Ctrl+C or `Stop-Process`), then restart. Documented in the README. |
| Browser cached old `script.js` | Front-end changes didn't appear after a normal reload. | Hard refresh (Ctrl+F5). Documented in the README. |

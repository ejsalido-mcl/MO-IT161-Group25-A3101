const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'netguard-'));
process.env.RATE_LIMIT_MAX = '10000';

const { createApp } = require('../src/app');
const { QUESTIONS } = require('../src/data/questions');

let server, base;
test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

// A tiny client that remembers the session cookie, like a browser would.
function client() {
  let cookie = '';
  return async (url, opts = {}) => {
    const res = await fetch(base + url, { redirect: 'manual', ...opts, headers: { ...(opts.headers || {}), cookie } });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return res;
  };
}
const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const form = (body) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });

// Build answers where exactly `safe` questions are answered safely.
function answers(safe) {
  const out = {};
  QUESTIONS.forEach((q, i) => {
    const unsafe = q.safeAnswer === 'yes' ? 'no' : 'yes';
    out[q.id] = i < safe ? q.safeAnswer : unsafe;
  });
  return out;
}

test('all public pages render (SSR)', async () => {
  const get = client();
  for (const p of ['/', '/assessment', '/about', '/contact', '/history']) {
    const res = await get(p);
    assert.equal(res.status, 200, p);
    assert.match(await res.text(), /<title>NetGuard/);
  }
});

test('assessment page renders all 10 questions from the data layer', async () => {
  const html = await (await client()('/assessment')).text();
  assert.equal((html.match(/<fieldset/g) || []).length, 10);
});

test('unknown page -> 404 HTML, unknown API route -> 404 JSON', async () => {
  const get = client();
  const page = await get('/nope');
  assert.equal(page.status, 404);
  assert.match(await page.text(), /Not Found/);
  const api = await get('/api/nope');
  assert.equal(api.status, 404);
  assert.ok((await api.json()).error);
});

test('GET /api/questions and /api/health', async () => {
  const get = client();
  const q = await (await get('/api/questions')).json();
  assert.equal(q.length, 10);
  assert.equal((await (await get('/api/health')).json()).status, 'ok');
});

test('scoring boundaries: 10/8 Low, 7/5 Medium, 4/0 High', async () => {
  const expected = { 10: 'Low', 8: 'Low', 7: 'Medium', 5: 'Medium', 4: 'High', 0: 'High' };
  const post = client();
  for (const [safe, level] of Object.entries(expected)) {
    const res = await post('/api/assessments', json({ answers: answers(Number(safe)) }));
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.score, Number(safe));
    assert.equal(body.riskLevel, level);
    assert.equal(body.checklist.length, 10 - Number(safe));
    assert.equal(body.sessionId, undefined, 'session id must not leak');
  }
});

test('perfect score has an empty checklist', async () => {
  const body = await (await client()('/api/assessments', json({ answers: answers(10) }))).json();
  assert.deepEqual(body.checklist, []);
});

test('invalid input is rejected with field-level errors', async () => {
  const post = client();
  const missing = await post('/api/assessments', json({ answers: { q1: 'yes' } }));
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).details.length, 9);

  const bad = await post('/api/assessments', json({ answers: { ...answers(10), q4: 'maybe' } }));
  assert.equal(bad.status, 400);

  const empty = await post('/api/assessments', json({}));
  assert.equal(empty.status, 400);
});

test('malformed JSON -> 400 JSON error (not a crash)', async () => {
  const res = await client()('/api/assessments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).error);
});

test('results persist, can be fetched, listed and deleted', async () => {
  const c = client();
  const created = await (await c('/api/assessments', json({ answers: answers(6) }))).json();

  const one = await c(`/api/assessments/${created.id}`);
  assert.equal(one.status, 200);
  assert.equal((await one.json()).score, 6);

  assert.equal((await (await c('/api/assessments')).json()).length, 1);

  assert.equal((await c(`/api/assessments/${created.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await c(`/api/assessments/${created.id}`)).status, 404);
  assert.equal((await c(`/api/assessments/${created.id}`, { method: 'DELETE' })).status, 404);
});

test('data survives an application restart (stored on disk)', async () => {
  const c = client();
  const created = await (await c('/api/assessments', json({ answers: answers(3) }))).json();

  server.close();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;

  const again = await c(`/api/assessments/${created.id}`);
  assert.equal(again.status, 200);
  assert.equal((await again.json()).score, 3);
});

test("one visitor cannot read or delete another visitor's results", async () => {
  const alice = client();
  const bob = client();
  const mine = await (await alice('/api/assessments', json({ answers: answers(5) }))).json();
  assert.equal((await bob(`/api/assessments/${mine.id}`)).status, 404);
  assert.equal((await bob(`/api/assessments/${mine.id}`, { method: 'DELETE' })).status, 404);
  assert.equal((await (await bob('/api/assessments')).json()).length, 0);
  assert.equal((await alice(`/api/assessments/${mine.id}`)).status, 200);
});

test('non-UUID ids are treated as not found', async () => {
  assert.equal((await client()('/api/assessments/../../etc/passwd')).status, 404);
  assert.equal((await client()('/api/assessments/abc')).status, 404);
});

test('SSR flow: submit form -> 303 redirect -> results page -> history -> delete', async () => {
  const c = client();
  const res = await c('/assessment', form(answers(4)));
  assert.equal(res.status, 303);
  const location = res.headers.get('location');
  assert.match(location, /^\/results\/[0-9a-f-]{36}$/);

  const page = await (await c(location)).text();
  assert.match(page, /Risk Level: High/);
  assert.match(page, /You scored 4\/10/);

  const history = await (await c('/history')).text();
  assert.match(history, /4\/10/);

  const id = location.split('/').pop();
  const del = await c(`/history/${id}/delete`, { method: 'POST' });
  assert.equal(del.status, 303);
  assert.equal((await c(location)).status, 404);
});

test('SSR form with missing answers re-renders with errors and keeps choices', async () => {
  const res = await client()('/assessment', form({ q1: 'yes', q2: 'no' }));
  assert.equal(res.status, 400);
  const html = await res.text();
  assert.match(html, /Please answer question 3 with Yes or No/);
  assert.match(html, /name="q1" value="yes" checked/);
});

test('results page of someone else / unknown id -> 404', async () => {
  const owner = client();
  const loc = (await owner('/assessment', form(answers(9)))).headers.get('location');
  assert.equal((await client()(loc)).status, 404);
  assert.equal((await owner('/results/not-a-real-id')).status, 404);
});

test('contact: valid message is stored; invalid is rejected (API + form)', async () => {
  const c = client();
  const ok = await c('/api/contact', json({ name: 'Juan', email: 'juan@example.com', subject: 'Help', message: 'My router is acting weird.' }));
  assert.equal(ok.status, 201);
  const saved = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'messages.json'), 'utf8'));
  assert.equal(saved.at(-1).email, 'juan@example.com');

  const bad = await c('/api/contact', json({ name: '', email: 'nope', subject: '', message: 'short' }));
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).details.length, 4);

  const sent = await c('/contact', form({ name: 'Ana', email: 'ana@example.com', subject: 'Question', message: 'How do I update my firmware?' }));
  assert.equal(sent.status, 303);
  assert.match(await (await c('/contact?sent=1')).text(), /Your message has been received/);

  const invalid = await c('/contact', form({ name: 'Ana', email: 'bad', subject: 'Q', message: 'x' }));
  assert.equal(invalid.status, 400);
  assert.match(await invalid.text(), /valid email address/);
});

test('user input is HTML-escaped in rendered pages', async () => {
  const html = await (await client()('/contact', form({ name: '<script>alert(1)</script>', email: 'a@b.co', subject: 'x', message: 'short' }))).text();
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('concurrent writes are not lost', async () => {
  const c = client();
  await c('/api/health'); // establish the session cookie first
  await Promise.all(Array.from({ length: 15 }, () => c('/api/assessments', json({ answers: answers(7) }))));
  assert.equal((await (await c('/api/assessments')).json()).length, 15);
});

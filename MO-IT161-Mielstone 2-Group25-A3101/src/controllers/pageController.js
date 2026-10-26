const { QUESTIONS } = require('../data/questions');
const assessmentService = require('../services/assessmentService');
const contactService = require('../services/contactService');
const { httpError } = require('../utils/httpError');

const UUID_RE = /^[0-9a-f-]{36}$/;

exports.home = (req, res) => res.render('index', { title: 'Home' });
exports.about = (req, res) => res.render('about', { title: 'About Us' });

exports.assessmentForm = (req, res) =>
  res.render('assessment', { title: 'Start Assessment', questions: QUESTIONS, errors: [], values: {} });

exports.assessmentSubmit = async (req, res) => {
  const values = {};
  QUESTIONS.forEach((q) => { values[q.id] = req.body[q.id]; });

  const { errors, record } = await assessmentService.submit(req.sessionId, values);
  if (errors) {
    return res.status(400).render('assessment', { title: 'Start Assessment', questions: QUESTIONS, errors, values });
  }
  res.redirect(303, `/results/${record.id}`); // Post/Redirect/Get: refreshing won't resubmit
};

exports.result = async (req, res) => {
  const record = UUID_RE.test(req.params.id) ? await assessmentService.get(req.params.id, req.sessionId) : null;
  if (!record) throw httpError(404, 'We could not find that result. It may have been deleted.');
  res.render('result', { title: 'Your Results', record });
};

exports.history = async (req, res) => {
  const records = await assessmentService.list(req.sessionId);
  res.render('history', { title: 'My Past Results', records, deleted: req.query.deleted === '1' });
};

exports.deleteResult = async (req, res) => {
  if (UUID_RE.test(req.params.id)) await assessmentService.remove(req.params.id, req.sessionId);
  res.redirect(303, '/history?deleted=1');
};

exports.contactForm = (req, res) =>
  res.render('contact', { title: 'Contact Us', errors: [], values: {}, sent: req.query.sent === '1' });

exports.contactSubmit = async (req, res) => {
  const { errors, data } = await contactService.submit(req.body);
  if (errors) return res.status(400).render('contact', { title: 'Contact Us', errors, values: data, sent: false });
  res.redirect(303, '/contact?sent=1');
};

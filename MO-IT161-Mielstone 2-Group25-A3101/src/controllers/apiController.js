const { QUESTIONS } = require('../data/questions');
const assessmentService = require('../services/assessmentService');
const contactService = require('../services/contactService');
const { httpError } = require('../utils/httpError');

const UUID_RE = /^[0-9a-f-]{36}$/;
const checkId = (id) => { if (!UUID_RE.test(id)) throw httpError(404, 'Assessment not found.'); };

exports.health = (req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()) });

exports.questions = (req, res) =>
  res.json(QUESTIONS.map(({ id, text }) => ({ id, text, options: ['yes', 'no'] })));

exports.createAssessment = async (req, res) => {
  const { errors, record } = await assessmentService.submit(req.sessionId, req.body && req.body.answers);
  if (errors) return res.status(400).json({ error: 'Validation failed.', details: errors });
  res.status(201).json(assessmentService.toPublic(record));
};

exports.listAssessments = async (req, res) => {
  const records = await assessmentService.list(req.sessionId);
  res.json(records.map(assessmentService.toPublic));
};

exports.getAssessment = async (req, res) => {
  checkId(req.params.id);
  const record = await assessmentService.get(req.params.id, req.sessionId);
  if (!record) throw httpError(404, 'Assessment not found.');
  res.json(assessmentService.toPublic(record));
};

exports.deleteAssessment = async (req, res) => {
  checkId(req.params.id);
  const removed = await assessmentService.remove(req.params.id, req.sessionId);
  if (!removed) throw httpError(404, 'Assessment not found.');
  res.status(204).end();
};

exports.createContact = async (req, res) => {
  const { errors, record } = await contactService.submit(req.body);
  if (errors) return res.status(400).json({ error: 'Validation failed.', details: errors });
  res.status(201).json({ id: record.id, message: 'Message received.' });
};

const { QUESTIONS } = require('../data/questions');

// Validate raw answers (from a form body or JSON). Returns normalized answers + field errors.
function validate(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const answers = {};
  const errors = [];
  QUESTIONS.forEach((q, i) => {
    const value = typeof input[q.id] === 'string' ? input[q.id].trim().toLowerCase() : '';
    if (value === 'yes' || value === 'no') answers[q.id] = value;
    else errors.push({ field: q.id, message: `Please answer question ${i + 1} with Yes or No.` });
  });
  return { answers, errors };
}

// Same rules as Milestone 1: 8-10 safe = Low, 5-7 = Medium, 0-4 = High.
function calculate(answers) {
  const checklist = [];
  let score = 0;
  QUESTIONS.forEach((q) => {
    if (answers[q.id] === q.safeAnswer) score += 1;
    else checklist.push(q.fix);
  });

  const riskLevel = score >= 8 ? 'Low' : score >= 5 ? 'Medium' : 'High';
  const summaries = {
    Low: 'Your Wi-Fi setup is fairly secure.',
    Medium: 'Some settings could be improved.',
    High: 'Your network may be vulnerable.',
  };
  return { score, total: QUESTIONS.length, riskLevel, summary: `You scored ${score}/${QUESTIONS.length}. ${summaries[riskLevel]}`, checklist };
}

module.exports = { validate, calculate };

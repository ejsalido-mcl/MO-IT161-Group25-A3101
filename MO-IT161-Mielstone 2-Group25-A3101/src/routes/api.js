const router = require('express').Router();
const c = require('../controllers/apiController');
const { asyncHandler: ah } = require('../utils/httpError');

router.get('/health', c.health);
router.get('/questions', c.questions);
router.post('/assessments', ah(c.createAssessment));
router.get('/assessments', ah(c.listAssessments));
router.get('/assessments/:id', ah(c.getAssessment));
router.delete('/assessments/:id', ah(c.deleteAssessment));
router.post('/contact', ah(c.createContact));

module.exports = router;

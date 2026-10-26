const router = require('express').Router();
const c = require('../controllers/pageController');
const { asyncHandler: ah } = require('../utils/httpError');

router.get('/', c.home);
router.get('/about', c.about);
router.get('/assessment', c.assessmentForm);
router.post('/assessment', ah(c.assessmentSubmit));
router.get('/results/:id', ah(c.result));
router.get('/history', ah(c.history));
router.post('/history/:id/delete', ah(c.deleteResult));
router.get('/contact', c.contactForm);
router.post('/contact', ah(c.contactSubmit));

module.exports = router;

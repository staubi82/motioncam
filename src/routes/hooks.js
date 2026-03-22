'use strict';
const express = require('express');
const router = express.Router();
const { requireHookSecret } = require('../middleware/hookAuth');
const { motionStart, motionEnd } = require('../controllers/hooksController');

router.post('/motion-start', requireHookSecret, motionStart);
router.post('/motion-end', requireHookSecret, motionEnd);

module.exports = router;

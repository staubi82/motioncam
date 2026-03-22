'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showSettings, saveSettings, testMail, changePassword } = require('../controllers/settingsController');

router.get('/', requireLogin, showSettings);
router.post('/', requireLogin, saveSettings);
router.post('/test-mail', requireLogin, testMail);
router.post('/password', requireLogin, changePassword);

module.exports = router;

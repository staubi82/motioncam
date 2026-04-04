'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const {
  showSettings, saveSettings, testMail, changePassword, testMotion, emptyTrashNow,
} = require('../controllers/settingsController');

router.get('/', requireLogin, showSettings);
router.post('/', requireLogin, saveSettings);
router.post('/test-mail', requireLogin, testMail);
router.post('/password', requireLogin, changePassword);
router.post('/test-motion', requireLogin, testMotion);
router.post('/trash-empty', requireLogin, emptyTrashNow);

module.exports = router;

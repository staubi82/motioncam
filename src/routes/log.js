'use strict';
const express = require('express');
const router  = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showLog, getLogJson } = require('../controllers/logController');

router.get('/',    requireLogin, showLog);
router.get('/api', requireLogin, getLogJson);

module.exports = router;

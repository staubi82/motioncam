'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showLive } = require('../controllers/liveController');

router.get('/', requireLogin, showLive);

module.exports = router;

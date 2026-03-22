'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showDashboard } = require('../controllers/dashboardController');

router.get('/', requireLogin, showDashboard);

module.exports = router;

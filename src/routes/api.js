'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { proxyStream, getSnapshot, getDashboardStats } = require('../controllers/apiController');

router.get('/live/stream', requireLogin, proxyStream);
router.get('/live/snapshot', requireLogin, getSnapshot);
router.get('/dashboard/stats', requireLogin, getDashboardStats);

module.exports = router;

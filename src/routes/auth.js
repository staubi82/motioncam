'use strict';
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { showLogin, handleLogin, handleLogout } = require('../controllers/authController');
const { requireLogin } = require('../middleware/auth');

const loginLimiter = rateLimit({ windowMs: 60_000, max: 5 });

router.get('/login', showLogin);
router.post('/login', loginLimiter, handleLogin);
router.get('/logout', requireLogin, handleLogout);

module.exports = router;

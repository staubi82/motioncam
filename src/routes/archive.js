'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showArchive } = require('../controllers/archiveController');

router.get('/', requireLogin, showArchive);

module.exports = router;

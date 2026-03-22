'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showVideo, deleteVideo, downloadVideo } = require('../controllers/videoController');

router.get('/:id', requireLogin, showVideo);
router.delete('/:id', requireLogin, deleteVideo);
router.get('/:id/download', requireLogin, downloadVideo);

module.exports = router;

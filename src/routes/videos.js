'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showVideo, deleteVideo, downloadVideo, bulkDeleteVideos } = require('../controllers/videoController');

router.delete('/bulk', requireLogin, bulkDeleteVideos);
router.get('/:id', requireLogin, showVideo);
router.delete('/:id', requireLogin, deleteVideo);
router.get('/:id/download', requireLogin, downloadVideo);

module.exports = router;

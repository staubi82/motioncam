'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const {
  showVideo, deleteVideo, restoreVideo, downloadVideo, bulkDeleteVideos, bulkRestoreVideos,
} = require('../controllers/videoController');

router.delete('/bulk', requireLogin, bulkDeleteVideos);
router.patch('/bulk/restore', requireLogin, bulkRestoreVideos);
router.get('/:id', requireLogin, showVideo);
router.delete('/:id', requireLogin, deleteVideo);
router.patch('/:id/restore', requireLogin, restoreVideo);
router.get('/:id/download', requireLogin, downloadVideo);

module.exports = router;

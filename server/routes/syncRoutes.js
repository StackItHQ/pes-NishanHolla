const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

// Sync route to handle Google Sheet to MySQL table sync
router.post('/sync', syncController.syncSheetToTable);

module.exports = router;

const express = require('express');
const googleSheetsController = require('../controllers/googleSheetsController');
const processData = require('../utils/sheetProcessor');

const router = express.Router();

// Route to create or update Google Sheets and set up tracking
router.post('/create', googleSheetsController.createOrUpdateGoogleSheet);

// Route to receive Google Sheet change updates
router.get('/sync-google-sheet', (req, res) => {
  googleSheetsController.syncGoogleSheet();
  res.send('Sync process started.');
});

// Route to manually process sheets.json and test formatting
router.post('/process-sheets', (req, res) => {
  try {
    const processedData = processData(); // Manually process sheets.json
    res.status(200).send({ message: 'sheets.json processed successfully.', data: processedData });
  } catch (error) {
    res.status(500).send({ message: 'Error processing sheets.json', error: error.message });
  }
});

// Route to fetch spreadsheet info and revision history via a GET request
router.get('/spreadsheet-info', googleSheetsController.getSpreadsheetInfoAndRevisions);

module.exports = router;

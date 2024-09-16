const express = require('express');
const googleSheetsController = require('../controllers/googleSheetsController');
const processData = require('../utils/sheetProcessor');

const router = express.Router();

// Route to create or update Google Sheets and set up tracking
router.post('/create', googleSheetsController.createOrUpdateGoogleSheet);

// Route to sync Google Sheets (fetch updates if any changes were made)
router.get('/sync-google-sheet', async (req, res) => {
  try {
    await googleSheetsController.detectAndUpdateSheet();
    res.status(200).send('Sync process completed successfully.');
  } catch (error) {
    console.error('Error during sync:', error.message);
    res.status(500).send('Error during sync process.');
  }
});

// Route to manually process sheets.json and convert it to SQL format
router.post('/process-sheets', (req, res) => {
  try {
    const processedData = processData(); // Manually process sheets.json
    res.status(200).send({ message: 'sheets.json processed successfully.', data: processedData });
  } catch (error) {
    res.status(500).send({ message: 'Error processing sheets.json', error: error.message });
  }
});

// Route to fetch spreadsheet info and revision history via a GET request
router.get('/spreadsheet-info', async (req, res) => {
  try {
    await googleSheetsController.getSpreadsheetInfoAndRevisions(req, res);
  } catch (error) {
    console.error('Error fetching spreadsheet info:', error.message);
    res.status(500).send('Error fetching spreadsheet info and revisions.');
  }
});

// Route to update the latestModifiedTime if it's missing
router.get('/update-modified-time', async (req, res) => {
  try {
    await googleSheetsController.updateLatestModifiedTimeIfMissing();
    res.status(200).send('Latest modified time updated successfully.');
  } catch (error) {
    console.error('Error updating latestModifiedTime:', error.message);
    res.status(500).send('Error updating latestModifiedTime.');
  }
});

router.delete('/delete-sheet', async (req, res) => {
  try {
    // Call the deleteGoogleSheet function from the controller
    await googleSheetsController.deleteGoogleSheet();
    res.status(200).send('Google Sheet and sheetId.json deleted successfully.');
  } catch (error) {
    res.status(500).send({ message: 'Error deleting Google Sheet or sheetId.json.', error: error.message });
  }
});

module.exports = router;

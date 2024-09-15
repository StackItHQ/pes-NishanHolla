const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const serviceAccount = require('../superjoin-sheetsv.json');

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

const sheetIdFilePath = path.join(__dirname, '../uploads/sheetId.json');

// Function to read and print `spreadsheetId`, fetch its name, and print revision history
const printSpreadsheetInfoAndRevisions = async (req, res) => {
  try {
    // Read the sheetId.json file
    const sheetIdData = JSON.parse(fs.readFileSync(sheetIdFilePath, 'utf8'));
    const spreadsheetId = sheetIdData.spreadsheetId;

    // Print the spreadsheetId
    console.log(`Spreadsheet ID: ${spreadsheetId}`);

    // Fetch the spreadsheet metadata (name)
    const sheetResponse = await sheets.spreadsheets.get({ spreadsheetId });
    const spreadsheetName = sheetResponse.data.properties.title;

    // Print the spreadsheet name
    console.log(`Spreadsheet Name: ${spreadsheetName}`);

    // Fetch the revision history of the file
    const revisionResponse = await drive.revisions.list({
      fileId: spreadsheetId,
    });

    const revisions = revisionResponse.data.revisions;
    if (revisions) {
      console.log('Revision History:');
      revisions.forEach((revision, index) => {
        console.log(`Revision ${index + 1}:`);
        console.log(`ID: ${revision.id}`);
        console.log(`Modified Time: ${revision.modifiedTime}`);
        console.log(`Last Modified By: ${revision.lastModifyingUser?.displayName || 'Unknown'}`);
        console.log('---------------------------------');
      });
    } else {
      console.log('No revisions found.');
    }

    // Respond with the spreadsheet info and revision history if it's a request
    if (res) {
      res.status(200).send({
        spreadsheetId,
        spreadsheetName,
        revisions,
      });
    }
  } catch (error) {
    console.error('Error fetching spreadsheet information or revisions:', error.message);
    if (res) {
      res.status(500).send('Failed to fetch spreadsheet information.');
    }
  }
};

// Expose `printSpreadsheetInfoAndRevisions` via a GET route
exports.getSpreadsheetInfoAndRevisions = printSpreadsheetInfoAndRevisions;

exports.createOrUpdateGoogleSheet = async (req, res) => {
  try {
    const sheetsFilePath = path.join(__dirname, '../uploads/sheets.json');

    if (!fs.existsSync(sheetsFilePath)) {
      console.log('Error: sheets.json not found.');
      return res.status(400).send('sheets.json not found.');
    }

    let processedSheetData;
    try {
      processedSheetData = JSON.parse(fs.readFileSync(sheetsFilePath, 'utf8'));
      console.log('sheets.json file loaded successfully.');
    } catch (error) {
      console.log('Error parsing sheets.json:', error.message);
      return res.status(400).send('Invalid JSON format in sheets.json.');
    }

    // Sheet creation or update logic here...

    res.status(200).send('Sheet created or updated.');
  } catch (error) {
    console.error('Error creating or updating the Google Sheet:', error);
    return res.status(500).send('Failed to create or update the Google Spreadsheet.');
  }
};

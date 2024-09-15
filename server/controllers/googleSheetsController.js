const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron'); // Import node-cron for polling
const serviceAccount = require('../superjoin-sheetsv.json');

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

const sheetIdFilePath = path.join(__dirname, '../uploads/sheetId.json');
const sheetsFilePath = path.join(__dirname, '../uploads/sheets.json');

// Function to detect an update, update the latestModifiedTime, and fetch the updated spreadsheet
const detectAndUpdateSheet = async () => {
  try {
    const sheetIdData = JSON.parse(fs.readFileSync(sheetIdFilePath, 'utf8'));
    const { spreadsheetId, latestModifiedTime } = sheetIdData;

    if (!spreadsheetId) {
      throw new Error('spreadsheetId not found in sheetId.json.');
    }

    console.log(`Current latestModifiedTime in sheetId.json: ${latestModifiedTime || 'No previous timestamp set.'}`);

    const revisionsResponse = await drive.revisions.list({ fileId: spreadsheetId });
    const revisions = revisionsResponse.data.revisions;

    const latestRevision = revisions.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0];

    console.log(`Latest revision timestamp from Google Drive: ${latestRevision.modifiedTime}`);

    if (!latestModifiedTime || new Date(latestRevision.modifiedTime) > new Date(latestModifiedTime)) {
      console.log('New update detected. Updating sheetId.json and fetching the updated Google Sheet data...');

      sheetIdData.latestModifiedTime = latestRevision.modifiedTime;
      fs.writeFileSync(sheetIdFilePath, JSON.stringify(sheetIdData, null, 2));
      console.log(`Updated sheetId.json with the latest timestamp: ${latestRevision.modifiedTime}`);

      await fetchSpreadsheetData();
    } else {
      console.log('No new updates detected.');
    }
  } catch (error) {
    console.error('Error detecting update or fetching data:', error.message);
  }
};

// Function to fetch spreadsheet data and store it in sheets.json
const fetchSpreadsheetData = async () => {
  try {
    const sheetIdData = JSON.parse(fs.readFileSync(sheetIdFilePath, 'utf8'));
    const { spreadsheetId } = sheetIdData;

    if (!spreadsheetId) {
      throw new Error('spreadsheetId not found in sheetId.json.');
    }

    console.log(`Fetching data for spreadsheet ID: ${spreadsheetId}`);

    const response = await sheets.spreadsheets.get({ spreadsheetId });

    const sheetTitle = response.data.sheets[0].properties.title;
    console.log(`Fetched sheet: ${sheetTitle}`);

    const sheetDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTitle}!A1:Z1000`,
    });

    const sheetData = sheetDataResponse.data.values || [];

    const sheetsJsonData = {
      sheet: {
        title: sheetTitle,
        data: sheetData,
      },
    };

    fs.writeFileSync(sheetsFilePath, JSON.stringify(sheetsJsonData, null, 2));
    console.log('Updated sheets.json with the latest Google Sheet data.');
  } catch (error) {
    console.error('Error fetching spreadsheet data:', error.message);
  }
};

// Function to create or update Google Sheets
const createOrUpdateGoogleSheet = async (req, res) => {
  try {
    const sheetsFilePath = path.join(__dirname, '../uploads/sheets.json');

    let processedSheetData;
    try {
      processedSheetData = JSON.parse(fs.readFileSync(sheetsFilePath, 'utf8'));
    } catch (error) {
      return res.status(400).send('Invalid JSON format in sheets.json.');
    }

    const { title, columns, data } = processedSheetData.sheet;
    const rows = [columns, ...data];

    let spreadsheetId;
    const sheetIdData = JSON.parse(fs.readFileSync(sheetIdFilePath, 'utf8'));
    if (sheetIdData && sheetIdData.spreadsheetId) {
      spreadsheetId = sheetIdData.spreadsheetId;
      console.log(`Updating Google Sheet with ID: ${spreadsheetId}`);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${title}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: rows },
      });
      console.log(`Google Sheet updated: ${spreadsheetId}`);
      res.status(200).send(`Sheet updated: ${spreadsheetId}`);
    } else {
      console.log('Creating new Google Sheet...');
      const response = await sheets.spreadsheets.create({
        resource: {
          properties: { title },
          sheets: [{ properties: { title }, data: [{ rowData: rows.map(row => ({ values: row.map(cell => ({ userEnteredValue: { stringValue: cell } })) })) }] }],
        },
      });
      spreadsheetId = response.data.spreadsheetId;
      sheetIdData.spreadsheetId = spreadsheetId;
      fs.writeFileSync(sheetIdFilePath, JSON.stringify(sheetIdData, null, 2));
      res.status(200).send(`Sheet created: ${spreadsheetId}`);
    }
  } catch (error) {
    console.error('Error creating/updating Google Sheet:', error);
    res.status(500).send('Error creating/updating Google Sheet.');
  }
};

// Function to check if latestModifiedTime is missing and update it
const updateLatestModifiedTimeIfMissing = async () => {
  try {
    const sheetIdData = JSON.parse(fs.readFileSync(sheetIdFilePath, 'utf8'));
    const { spreadsheetId, latestModifiedTime } = sheetIdData;

    if (!spreadsheetId) {
      throw new Error('spreadsheetId not found in sheetId.json.');
    }

    if (!latestModifiedTime) {
      console.log('No latestModifiedTime found in sheetId.json. Fetching from revision log...');

      const revisionsResponse = await drive.revisions.list({ fileId: spreadsheetId });
      const revisions = revisionsResponse.data.revisions;

      const latestRevision = revisions.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0];

      if (latestRevision) {
        sheetIdData.latestModifiedTime = latestRevision.modifiedTime;
        fs.writeFileSync(sheetIdFilePath, JSON.stringify(sheetIdData, null, 2));
        console.log(`Updated sheetId.json with the latestModifiedTime: ${latestRevision.modifiedTime}`);
      } else {
        console.log('No revisions found for this spreadsheet.');
      }
    } else {
      console.log(`latestModifiedTime already exists in sheetId.json: ${latestModifiedTime}`);
    }
  } catch (error) {
    console.error('Error updating latestModifiedTime:', error.message);
  }
};

// Function to get spreadsheet info and revisions
const getSpreadsheetInfoAndRevisions = async (req, res) => {
  try {
    const sheetIdData = JSON.parse(fs.readFileSync(sheetIdFilePath, 'utf8'));
    const { spreadsheetId } = sheetIdData;

    const sheetResponse = await sheets.spreadsheets.get({ spreadsheetId });
    const revisionsResponse = await drive.revisions.list({ fileId: spreadsheetId });

    res.status(200).send({
      spreadsheetId,
      spreadsheetName: sheetResponse.data.properties.title,
      revisions: revisionsResponse.data.revisions,
    });
  } catch (error) {
    res.status(500).send('Error fetching spreadsheet info and revisions.');
  }
};

// Function to start polling
const startPolling = () => {
  console.log('Starting polling for Google Sheets updates...');
  
  // Poll every 10 seconds
  cron.schedule('*/10 * * * * *', async () => {
    console.log('Polling Google Sheets for updates...');
    await detectAndUpdateSheet();
  });
  
};

// Start polling when the module is loaded
startPolling();

// Exporting all functions
module.exports = {
  detectAndUpdateSheet,
  fetchSpreadsheetData,
  createOrUpdateGoogleSheet,
  updateLatestModifiedTimeIfMissing,
  getSpreadsheetInfoAndRevisions,
};

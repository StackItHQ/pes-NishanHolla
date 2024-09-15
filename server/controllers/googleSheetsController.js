const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const cron = require('node-cron');
const serviceAccount = require('../superjoin-sheetsv.json');
const processData = require('../utils/sheetProcessor');

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

const sheetIdFilePath = path.join(__dirname, '../uploads/sheetId.json');
const sheetsFilePath = path.join(__dirname, '../uploads/sheets.json');
const sqlFilePath = path.join(__dirname, '../uploads/sql.json');

// Function to fetch and update the Google Sheet data (Sync)
const syncGoogleSheet = async () => {
  try {
    // Read sheetId.json to get the spreadsheetId and latest modified time
    const sheetIdData = JSON.parse(fs.readFileSync(sheetIdFilePath, 'utf8'));
    const { spreadsheetId } = sheetIdData;

    if (!spreadsheetId) {
      throw new Error('spreadsheetId not found in sheetId.json.');
    }

    // Check if latestModifiedTime exists in sheetId.json; if not, initialize it
    if (!sheetIdData.latestModifiedTime) {
      console.log('No previous latestModifiedTime found. Initializing field.');
      sheetIdData.latestModifiedTime = null;
    }

    console.log(`Current latestModifiedTime in sheetId.json: ${sheetIdData.latestModifiedTime || 'No previous timestamp set.'}`);

    // Fetch the revision log from Google Drive
    const revisionsResponse = await drive.revisions.list({ fileId: spreadsheetId });
    const revisions = revisionsResponse.data.revisions;

    // Print the entire revision log
    console.log('Revision Log:');
    revisions.forEach((revision, index) => {
      console.log(`Revision ${index + 1}:`);
      console.log(`  ID: ${revision.id}`);
      console.log(`  Modified Time: ${revision.modifiedTime}`);
      console.log(`  Last Modified By: ${revision.lastModifyingUser?.displayName || 'Unknown'}`);
    });

    // Sort the revisions by modified time (descending)
    const latestRevision = revisions.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0];

    console.log(`Latest revision timestamp from Google Drive: ${latestRevision.modifiedTime}`);

    // Check if this is the first time syncing or if the latest revision is newer
    if (!sheetIdData.latestModifiedTime || new Date(latestRevision.modifiedTime) > new Date(sheetIdData.latestModifiedTime)) {
      console.log('New update detected in the Google Sheet. Syncing...');

      // Fetch the updated spreadsheet and update sheets.json, sql.json, and your database logic
      const response = await sheets.spreadsheets.get({ spreadsheetId });
      fs.writeFileSync(sheetsFilePath, JSON.stringify(response.data, null, 2));
      console.log('Updated sheets.json with the latest Google Sheet data.');

      // Transform sheets.json into sql.json (assuming processData() does that)
      const processedData = processData();
      fs.writeFileSync(sqlFilePath, JSON.stringify(processedData, null, 2));
      console.log('Updated sql.json with transformed data.');

      // Update the latestModifiedTime in sheetId.json
      sheetIdData.latestModifiedTime = latestRevision.modifiedTime;
      fs.writeFileSync(sheetIdFilePath, JSON.stringify(sheetIdData, null, 2));
      console.log(`Updated sheetId.json with the latest timestamp: ${latestRevision.modifiedTime}`);
    } else {
      console.log('No new updates detected.');
    }
  } catch (error) {
    console.error('Error during sync process:', error.message);
  }
};

// Function to create or update Google Sheets
const createOrUpdateGoogleSheet = async (req, res) => {
  try {
    const sheetsFilePath = path.join(__dirname, '../uploads/sheets.json');

    // Read data from sheets.json
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

const updateLatestModifiedTimeIfMissing = async () => {
  try {
    // Read sheetId.json to get the spreadsheetId and latest modified time
    const sheetIdData = JSON.parse(fs.readFileSync(sheetIdFilePath, 'utf8'));
    const { spreadsheetId, latestModifiedTime } = sheetIdData;

    if (!spreadsheetId) {
      throw new Error('spreadsheetId not found in sheetId.json.');
    }

    // Check if latestModifiedTime exists, if not, fetch it from revision log
    if (!latestModifiedTime) {
      console.log('No latestModifiedTime found in sheetId.json. Fetching from revision log...');

      // Fetch the revision log from Google Drive
      const revisionsResponse = await drive.revisions.list({ fileId: spreadsheetId });
      const revisions = revisionsResponse.data.revisions;

      // Sort the revisions by modified time (descending) and get the latest one
      const latestRevision = revisions.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0];

      if (latestRevision) {
        // Update sheetId.json with the latest modified time
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

updateLatestModifiedTimeIfMissing();

// Export functions
exports.syncGoogleSheet = syncGoogleSheet;
exports.createOrUpdateGoogleSheet = createOrUpdateGoogleSheet;
exports.getSpreadsheetInfoAndRevisions = getSpreadsheetInfoAndRevisions;

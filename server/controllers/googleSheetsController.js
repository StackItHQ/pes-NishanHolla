const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron'); // Import node-cron for polling
const serviceAccount = require('../superjoin-sheetsv.json');
const sheetToSql = require('../utils/sheetToSql');
const sqlController = require('./mySqlController'); // Assuming you have this for MySQL

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
    console.log(spreadsheetId+' '+latestModifiedTime);
    if (!spreadsheetId) {
      throw new Error('spreadsheetId not found in sheetId.json.');
    }

    console.log(`Current latestModifiedTime in sheetId.json: ${latestModifiedTime || 'No previous timestamp set.'}`);

    // Fetch the revision log from Google Drive
    const revisionsResponse = await drive.revisions.list({ fileId: spreadsheetId });
    const revisions = revisionsResponse.data.revisions;

    // Sort the revisions by modified time (descending) and get the latest one
    const latestRevision = revisions.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0];

    console.log(`Latest revision timestamp from Google Drive: ${latestRevision.modifiedTime}`);

    // Compare the latest revision time with the one stored in sheetId.json
    if (new Date(latestRevision.modifiedTime) > new Date(latestModifiedTime)) {
      console.log('New update detected. Updating sheetId.json and fetching the updated Google Sheet data...');

      // Update the latestModifiedTime in sheetId.json
      sheetIdData.latestModifiedTime = latestRevision.modifiedTime;
      fs.writeFileSync(sheetIdFilePath, JSON.stringify(sheetIdData, null, 2));
      console.log(`Updated sheetId.json with the latest timestamp: ${latestRevision.modifiedTime}`);

      // Fetch the updated Google Sheet data since an update is detected
      await fetchSpreadsheetData();
      
      await sqlController.processSqlJsonFile();  // Assuming this creates the table based on 'sql.json'
      console.log(`Data has been updated into the table.`);

    } else {
      console.log('No new updates detected. Skipping fetching the sheet.');
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

    sheetToSql(); // Convert sheets.json to sql.json
    console.log('sheetToSql function executed, transformed sheets.json to sql.json.');

  } catch (error) {
    console.error('Error fetching spreadsheet data:', error.message);
  }
};

// Function to create or update Google Sheets
const createOrUpdateGoogleSheet = async (req, res) => {
  try {
    const sheetsFilePath = path.join(__dirname, '../uploads/sheets.json');
    const sheetIdFilePath = path.join(__dirname, '../uploads/sheetId.json'); // Ensure this path is correct

    let processedSheetData;
    try {
      processedSheetData = JSON.parse(fs.readFileSync(sheetsFilePath, 'utf8'));
    } catch (error) {
      return res.status(400).send('Invalid JSON format in sheets.json.');
    }

    const { title, columns } = processedSheetData.sheet;
    const data = processedSheetData.data;

    // Ensure data is correctly structured
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).send('Invalid columns format in sheets.json.');
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).send('Invalid data format in sheets.json.');
    }

    // Prepare rows for Google Sheets
    const rows = [columns, ...data];

    let spreadsheetId;
    let sheetIdData = {};
    try {
      sheetIdData = JSON.parse(fs.readFileSync(sheetIdFilePath, 'utf8'));
    } catch (error) {
      console.log('No existing sheet ID found, creating a new sheet.');
    }

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
      sheetIdData.latestModifiedTime = new Date().toISOString();
      fs.writeFileSync(sheetIdFilePath, JSON.stringify(sheetIdData, null, 2));
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
      sheetIdData.latestModifiedTime = new Date().toISOString();
      fs.writeFileSync(sheetIdFilePath, JSON.stringify(sheetIdData, null, 2));

      // Share the new Google Sheet with hollanishan@gmail.com
      await drive.permissions.create({
        fileId: spreadsheetId,
        resource: {
          role: 'writer',
          type: 'user',
          emailAddress: 'hollanishan@gmail.com',
        },
        sendNotificationEmail: true,
      });

      res.status(200).send(`Sheet created and shared: ${spreadsheetId}`);
    }
  } catch (error) {
    console.error('Error creating/updating Google Sheet:', error);
    if (!res.headersSent) {
      res.status(500).send('Error creating/updating Google Sheet.');
    }
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
    try {
      console.log('Polling Google Sheets for updates...');
      await detectAndUpdateSheet();
    } catch (error) {
      console.error('Error during polling:', error.message);
    }
  });
};

const deleteGoogleSheet = async () => {
  try {
    // Read sheetId.json to get the spreadsheetId (fileId in Drive)
    const sheetIdData = JSON.parse(fs.readFileSync(sheetIdFilePath, 'utf8'));
    const { spreadsheetId } = sheetIdData;

    if (!spreadsheetId) {
      throw new Error('spreadsheetId not found in sheetId.json.');
    }

    console.log(`Deleting Google Sheet with ID: ${spreadsheetId}`);

    // Call the Drive API to delete the Google Sheet
    await drive.files.delete({
      fileId: spreadsheetId,
    });

    console.log(`Google Sheet with ID ${spreadsheetId} deleted successfully.`);

    // Check if sheetId.json exists, then delete it
    if (fs.existsSync(sheetIdFilePath)) {
      fs.unlinkSync(sheetIdFilePath); // Remove the sheetId.json file
      console.log('sheetId.json removed successfully.');
    } else {
      console.log('sheetId.json file not found.');
    }
  } catch (error) {
    console.error('Error deleting Google Sheet or sheetId.json:', error.message);
  }
};

// updateLatestModifiedTimeIfMissing();
// Start polling when the module is loaded
startPolling();
// detectAndUpdateSheet();

// Exporting all functions
module.exports = {
  detectAndUpdateSheet,
  fetchSpreadsheetData,
  createOrUpdateGoogleSheet,
  updateLatestModifiedTimeIfMissing,
  getSpreadsheetInfoAndRevisions,
  deleteGoogleSheet,
};

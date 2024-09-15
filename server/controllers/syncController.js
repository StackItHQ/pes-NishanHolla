const { google } = require('googleapis');
const mysql = require('mysql');
const pool = require('../utils/mySqlSingleton');
const sheets = google.sheets('v4');

// Function to fetch Google Sheet data
exports.syncSheetToTable = async (req, res) => {
  try {
    const { sheetId, sheetName } = req.body;

    // Step 1: Fetch data from Google Sheet
    const auth = await getAuthenticatedClient(); // Your OAuth2 or JWT setup
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: sheetName, // Range should be 'Sheet1' or similar
      auth: auth
    });
    const sheetData = response.data.values;

    // Step 2: Sync with MySQL Table
    const currentTableData = await pool.query(`SELECT * FROM ${sheetName}`);
    sheetData.forEach(async (row, index) => {
      const [column1, column2, column3] = row;
      const existingRow = currentTableData[index];
      if (!existingRow || existingRow.column1 !== column1 || existingRow.column2 !== column2) {
        await pool.query(
          `UPDATE ${sheetName} SET column1 = ?, column2 = ?, column3 = ? WHERE id = ?`,
          [column1, column2, column3, index + 1]
        );
      }
    });

    res.status(200).json({ message: 'Synchronization successful!' });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Synchronization failed' });
  }
};

// Helper function to authenticate
async function getAuthenticatedClient() {
  // OAuth2 or JWT setup for service account (using superjoin-sheetsv2.json)
}

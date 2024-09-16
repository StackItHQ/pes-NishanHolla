const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron'); // For scheduling periodic tasks
const serviceAccount = require('../superjoin-sheetsv.json'); // Your Google service account credentials

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Function to upload data from sheets.json to Google Sheets
exports.uploadSheetFromJSON = async (req, res) => {
  try {
    // Read the sheets.json file
    const sheetsFilePath = path.join(__dirname, '../uploads/sheets.json');
    const sheetData = JSON.parse(fs.readFileSync(sheetsFilePath, 'utf8'));

    // Create a new Google Sheet
    const response = await sheets.spreadsheets.create({
      resource: {
        properties: {
          title: sheetData.sheet.title,
        },
        sheets: [
          {
            properties: {
              title: sheetData.sheet.title,
            },
            data: [
              {
                rowData: [
                  {
                    values: sheetData.sheet.columns.map(col => ({
                      userEnteredValue: { stringValue: col },
                    })),
                  },
                  ...sheetData.data[sheetData.sheet.columns[0]].map((_, rowIndex) => ({
                    values: sheetData.sheet.columns.map(col => ({
                      userEnteredValue: { stringValue: sheetData.data[col][rowIndex] },
                    })),
                  })),
                ],
              },
            ],
          },
        ],
      },
    });

    const spreadsheetId = response.data.spreadsheetId;
    console.log(`Spreadsheet created with ID: ${spreadsheetId}`);
    res.status(200).send(`Spreadsheet created successfully with ID: ${spreadsheetId}`);
  } catch (error) {
    console.error('Error uploading the sheet:', error);
    res.status(500).send('Error uploading the sheet');
  }
};

// Function to check for changes in sheets.json
const loadLocalSheetData = () => {
  const sheetsFilePath = path.join(__dirname, '../uploads/sheets.json');
  if (fs.existsSync(sheetsFilePath)) {
    const data = fs.readFileSync(sheetsFilePath, 'utf8');
    return JSON.parse(data);
  }
  return null;
};

// Function to compare the data and detect changes
const hasSheetChanged = (oldData, newData) => {
  return JSON.stringify(oldData) !== JSON.stringify(newData);
};

// Polling function to check for changes every minute
// const pollForChanges = async () => {
//   let previousSheetData = loadLocalSheetData();

//   cron.schedule('* * * * *', async () => {
//     console.log('Polling for changes in sheets.json...');

//     const currentSheetData = loadLocalSheetData();

//     if (hasSheetChanged(previousSheetData, currentSheetData)) {
//       console.log('Changes detected in sheets.json, updating Google Sheets...');

//       try {
//         // Assuming you already have the spreadsheetId from the initial creation
//         const spreadsheetId = currentSheetData.sheet.spreadsheetId;

//         // Clear the existing sheet data (optional, depending on your use case)
//         await sheets.spreadsheets.values.clear({
//           spreadsheetId: spreadsheetId,
//           range: `${currentSheetData.sheet.title}!A1:Z1000`, // Clear an appropriate range
//         });

//         // Re-upload the updated data to the Google Sheet
//         await sheets.spreadsheets.values.update({
//           spreadsheetId: spreadsheetId,
//           range: `${currentSheetData.sheet.title}!A1`,
//           valueInputOption: 'USER_ENTERED',
//           resource: {
//             values: [
//               currentSheetData.sheet.columns,
//               ...currentSheetData.data[currentSheetData.sheet.columns[0]].map((_, rowIndex) => (
//                 currentSheetData.sheet.columns.map(col => currentSheetData.data[col][rowIndex])
//               )),
//             ],
//           },
//         });

//         console.log(`Spreadsheet with ID: ${spreadsheetId} updated successfully`);
//       } catch (error) {
//         console.error('Error updating the sheet:', error);
//       }

//       // Update the previous sheet data to the current data after updating the sheet
//       previousSheetData = currentSheetData;
//     } else {
//       console.log('No changes detected.');
//     }
//   });
// };

// // Start polling for changes when the server starts
// pollForChanges();

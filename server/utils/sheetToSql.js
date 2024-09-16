const fs = require('fs');
const path = require('path');

const sheetsFilePath = path.join(__dirname, '../uploads/sheets.json');
const sqlFilePath = path.join(__dirname, '../uploads/sql.json');

// Function to transform sheets.json into sql.json
const sheetToSql = () => {
  try {
    // Read sheets.json
    const sheetsData = JSON.parse(fs.readFileSync(sheetsFilePath, 'utf8'));

    // Extract the title and data from sheets.json
    const { title, data } = sheetsData.sheet;

    // Extract the headers from the first row
    const headers = data[0]; // First row is assumed to be headers ["Name", "Value"]

    // Extract the actual data (rows start from index 1)
    const rows = data.slice(1);

    // Define the structure of the SQL table
    const sqlTable = {
      table: {
        name: "new_table", // You can replace this with a more dynamic name if needed
        columns: [
          {
            name: "id",
            type: "INT AUTO_INCREMENT PRIMARY KEY"
          },
          {
            name: headers[0], // "Name" column from the sheet
            type: "VARCHAR(255) NOT NULL"
          },
          {
            name: headers[1], // "Value" column from the sheet
            type: "VARCHAR(255)"
          }
        ]
      },
      data: rows.map(row => ({
        [headers[0]]: row[0], // Map Name
        [headers[1]]: row[1], // Map Value
      }))
    };

    // Write the transformed SQL data to sql.json
    fs.writeFileSync(sqlFilePath, JSON.stringify(sqlTable, null, 2));
    console.log('SQL JSON created successfully and saved to sql.json.');

  } catch (error) {
    console.error('Error transforming sheets.json to sql.json:', error.message);
  }
};

module.exports = sheetToSql;

const express = require('express');
const mySqlController = require('../controllers/mySqlController'); // Import from mySqlController
const logMiddleware = require('../middlewares/logMiddleware'); // Import logMiddleware

const router = express.Router();

// Middleware to check MySQL connection
const checkMySqlConncMiddleware = async (req, res, next) => {
  try {
    await mySqlController.checkMySqlConnc();
    next(); // Connection is successful, proceed to next middleware or route handler
  } catch (err) {
    res.status(500).send('Error connecting to MySQL.');
  }
};

// Example route to check if MySQL is running
router.get('/check', async (req, res) => {
  try {
    await mySqlController.checkMySqlConnc();
    res.send('MySQL connection is active.');
  } catch (err) {
    res.status(500).send('Error connecting to MySQL.');
  }
});

// Route to create or overwrite a table and insert data using sql.json
router.post('/create-table', logMiddleware, checkMySqlConncMiddleware, async (req, res) => {
  try {
    // No need to log the request body, we're using sql.json
    await mySqlController.processSqlJsonFile();
    res.send('Table created or overwritten and data inserted successfully using sql.json.');
  } catch (err) {
    console.error('Error:', err); // Log the error to the console
    res.status(500).send('Error creating or overwriting table and inserting data.');
  }
});

// Route to get all data from a table
router.get('/get-data/:tableName', logMiddleware, checkMySqlConncMiddleware, async (req, res) => {
  try {
    const tableName = req.params.tableName;
    const data = await mySqlController.getAllDataFromTable(tableName);
    res.json(data); // Send the data as JSON response
  } catch (err) {
    console.error('Error:', err); // Log the error
    res.status(500).send('Error fetching data.');
  }
});

router.delete('/delete-table/:tableName', async (req, res) => {
  const { tableName } = req.params;

  try {
    if (!tableName) {
      return res.status(400).send('Table name is required');
    }

    // Call the deleteTable function
    await mySqlController.deleteTable(tableName);
    res.status(200).send(`Table ${tableName} deleted successfully.`);
  } catch (error) {
    res.status(500).send({ message: `Error deleting table ${tableName}.`, error: error.message });
  }
});

module.exports = router;

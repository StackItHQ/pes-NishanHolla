const express = require('express');
const fileRoutes = require('./routes/fileRoutes');
const mySqlRoutes = require('./routes/mySqlRoutes');
const syncRoutes = require('./routes/syncRoutes');
const googleSheetsRoutes = require('./routes/googleSheetsRoutes'); // Import Google Sheets routes
const logMiddleware = require('./middlewares/logMiddleware'); // Import logMiddleware
const { google } = require('googleapis'); // Google OAuth
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware setup
app.use(express.json());

// Apply logMiddleware globally to log all routes
app.use(logMiddleware);

// Google OAuth Setup
let oauth2Client;

// Load client_secret.json
function loadClientCredentials() {
  const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'client_secret.json')));
  const { client_id, client_secret, redirect_uris } = credentials.web;
  
  oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0] // This should be "http://localhost:3000/oauth2callback"
  );
}

// Initialize OAuth 2.0 Client with credentials from client_secret.json
loadClientCredentials();

// OAuth authentication route
app.get('/auth', (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes
  });

  res.redirect(url); // Redirect the user to Google's OAuth 2.0 server
});

// OAuth callback route to handle the authorization code
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const { tokens } = await oauth2Client.getToken(code); // Get token using the code
    oauth2Client.setCredentials(tokens);

    // Save tokens to disk (you can also use a database here)
    fs.writeFileSync('tokens.json', JSON.stringify(tokens));

    res.send('Authentication successful! You can now access Google Sheets API.');
  } catch (err) {
    console.error('Error during OAuth callback:', err);
    res.status(500).send('Authentication failed.');
  }
});

// Define the routes
app.use('/files', fileRoutes);
app.use('/mysql', mySqlRoutes);
app.use('/sync', syncRoutes);
app.use('/sheets', googleSheetsRoutes);  // Add the Google Sheets routes

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

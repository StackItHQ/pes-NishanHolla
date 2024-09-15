const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  sheetId: { type: String, required: true },
  sheetName: { type: String, required: true },
  range: { type: String }, // Could be the A1 notation of the changed range
  oldValues: { type: Array, required: true }, // Array of old values before the update
  newValues: { type: Array, required: true }, // Array of new values after the update
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SyncLog', syncLogSchema);

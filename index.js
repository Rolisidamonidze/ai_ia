const functions = require('firebase-functions');
const app = require('./server');

// Expose Express API as a single Cloud Function with secrets
exports.app = functions
  .runWith({
    secrets: ['API_KEY']
  })
  .https.onRequest(app);


const functions = require('firebase-functions');
const app = require('./server');

// Expose Express API as a single Cloud Function
exports.app = functions.https.onRequest(app);

const { onRequest } = require('firebase-functions/v2/https');
const app = require('./server');

// Expose Express API as a single Cloud Function with secrets
exports.app = onRequest(
  {
    secrets: ['API_KEY'],
    timeoutSeconds: 300,
    memory: '512MiB'
  },
  app
);


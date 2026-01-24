# Firebase Setup and Deployment Guide

## Prerequisites
1. Node.js installed (v18 or higher recommended)
2. Firebase CLI installed: `npm install -g firebase-tools`
3. A Firebase project created at https://console.firebase.google.com

## Initial Firebase Setup

### 1. Login to Firebase
```bash
firebase login
```

### 2. Initialize Firebase Project
The configuration files are already set up, but you need to:

1. Go to https://console.firebase.google.com
2. Create a new Firebase project (or use existing)
3. Enable these services:
   - **Firestore Database** (for storing item metadata)
   - **Storage** (for storing audio and text files)
   - **Cloud Functions** (for running the Express server)
   - **Hosting** (for serving the frontend)

### 3. Update Firebase Project ID
Edit `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID` with your actual project ID:
```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

### 4. Create Service Account (for local development)
1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file as `serviceAccountKey.json` in your project root
4. **IMPORTANT**: Never commit this file to git!

### 5. Configure Environment Variables
Update your `.env` file:
```env
API_KEY=your_openai_api_key
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
PORT=3000
```

For production (Firebase Functions), set environment variables:
```bash
firebase functions:config:set openai.key="your_openai_api_key"
firebase functions:config:set storage.bucket="your-project-id.appspot.com"
```

## Local Development

### Run locally with Firebase
```bash
npm start
```

The app will:
- Use Firebase if properly configured
- Fall back to local file storage if Firebase is not configured

### Test with Firebase Emulators
```bash
npm run serve
```

## Deployment

### 1. Build and Deploy Everything
```bash
npm run deploy
```

This deploys:
- Cloud Functions (Express server)
- Firestore rules
- Storage rules
- Hosting

### 2. Deploy Only Functions
```bash
firebase deploy --only functions
```

### 3. Deploy Only Hosting
```bash
firebase deploy --only hosting
```

### 4. Deploy Only Database Rules
```bash
firebase deploy --only firestore,storage
```

## Post-Deployment

### Set Production Environment Variables
```bash
firebase functions:config:set openai.key="your_openai_api_key"
firebase deploy --only functions
```

### View Your App
After deployment, Firebase will provide URLs:
- **Hosting URL**: `https://your-project-id.web.app`
- **Functions URL**: `https://us-central1-your-project-id.cloudfunctions.net/app`

## Security Notes

### Production Security Rules
Before going live, update the security rules:

**firestore.rules**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      // Require authentication
      allow read, write: if request.auth != null;
    }
  }
}
```

**storage.rules**:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /audio/{itemId} {
      allow read: if true;  // Public read for audio playback
      allow write: if request.auth != null;
    }
    
    match /text/{itemId} {
      allow read: if true;  // Public read
      allow write: if request.auth != null;
    }
  }
}
```

## Troubleshooting

### Check Function Logs
```bash
firebase functions:log
```

### View Config
```bash
firebase functions:config:get
```

### Verify Deployment
```bash
curl https://your-project-id.web.app/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "hasApiKey": true,
  "firebaseInitialized": true
}
```

## Cost Considerations

Firebase offers a free tier (Spark Plan), but for production you'll need the Blaze Plan:
- **Cloud Functions**: Pay per invocation and compute time
- **Storage**: First 5GB free, then $0.026/GB
- **Firestore**: 50k reads/20k writes per day free
- **Hosting**: 10GB/month free

Monitor your usage at: https://console.firebase.google.com

## Migration from Local Storage

Your existing items in `saved-items/` folder won't automatically migrate. Options:
1. Keep using local storage in development
2. Write a migration script to upload existing items to Firebase
3. Start fresh with Firebase

## Additional Resources
- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Functions Guide](https://firebase.google.com/docs/functions)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Storage Documentation](https://firebase.google.com/docs/storage)

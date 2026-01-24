# Quick Deployment Steps

Follow these steps to deploy your app to Firebase:

## 1. Complete Firebase Setup

```bash
# Login to Firebase
firebase login

# Update .firebaserc with your project ID
# Edit .firebaserc and replace YOUR_FIREBASE_PROJECT_ID with your actual project ID
```

## 2. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project" or select existing project
3. Enable these services:
   - ✅ Firestore Database
   - ✅ Storage
   - ✅ Cloud Functions
   - ✅ Hosting

## 3. Update Configuration Files

### Update .firebaserc
```json
{
  "projects": {
    "default": "YOUR-PROJECT-ID-HERE"
  }
}
```

### Update .env file
```env
API_KEY=your_openai_api_key
FIREBASE_STORAGE_BUCKET=YOUR-PROJECT-ID.appspot.com
```

## 4. Set Firebase Environment Config

```bash
# Set OpenAI API key for Cloud Functions
firebase functions:config:set openai.key="your_openai_api_key"

# Verify it's set
firebase functions:config:get
```

## 5. Deploy to Firebase

```bash
# Deploy everything (hosting, functions, database rules)
firebase deploy

# OR deploy separately:
# firebase deploy --only hosting
# firebase deploy --only functions
# firebase deploy --only firestore,storage
```

## 6. Verify Deployment

After deployment completes, Firebase will show your URLs:

```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/YOUR-PROJECT-ID/overview
Hosting URL: https://YOUR-PROJECT-ID.web.app
```

Visit the Hosting URL to see your app live!

## 7. Test the Deployment

```bash
# Check health endpoint
curl https://YOUR-PROJECT-ID.web.app/health

# Should return:
# {"status":"healthy","timestamp":"...","hasApiKey":true,"firebaseInitialized":true}
```

## Common Issues

### "Firebase project not found"
- Make sure you've updated `.firebaserc` with your actual project ID
- Run `firebase projects:list` to see available projects

### "Functions deployment failed"
- Check that you've set the OpenAI API key: `firebase functions:config:get`
- View logs: `firebase functions:log`

### "Permission denied"
- Update your Firestore and Storage rules in Firebase Console
- Or deploy rules: `firebase deploy --only firestore,storage`

### "Build failed"
- Make sure all dependencies are installed: `npm install`
- Check Node version: `node --version` (should be 18+)

## Need More Help?

See the complete guide in [FIREBASE_SETUP.md](FIREBASE_SETUP.md)

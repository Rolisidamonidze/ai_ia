# 🚀 Automatic Firebase Deployment Guide

This app uses **GitHub Actions** to automatically deploy to Firebase on every git push to the `main` branch. No manual deployment commands needed!

## Prerequisites

1. **GitHub Repository**: Your code is pushed to a GitHub repository
2. **Firebase Project**: Created at https://console.firebase.google.com
3. **Blaze Plan**: Firebase project upgraded to Blaze (pay-as-you-go) plan
   - Required for Cloud Functions
   - Generous free tier (2M function invocations/month, 50k Firestore reads/day, 5GB storage)
   - Usually free for small projects

## Setup Instructions

### Step 1: Upgrade Firebase to Blaze Plan

1. Go to https://console.firebase.google.com/project/gpt-to-video/billing/plan
2. Click "Upgrade" to switch from Spark to Blaze
3. Follow the prompts (you'll need to add a payment method)
4. ✅ You won't be charged unless you exceed free tier limits

### Step 2: Generate Firebase Token for CI/CD

1. Login to Firebase locally:
   ```bash
   firebase login
   ```

2. Generate a CI token:
   ```bash
   firebase login:ci
   ```
   
3. **Copy the entire token** (it's long, includes special characters)
   - Don't share this token or commit it anywhere
   - It allows automated deployments

### Step 3: Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Create a secret with:
   - **Name**: `FIREBASE_TOKEN`
   - **Value**: (paste the token from Step 2)
5. Click **Add secret**

### Step 4: Update .firebaserc (if needed)

Make sure `.firebaserc` has your correct Firebase project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

You can find your project ID in Firebase Console or by running:
```bash
firebase projects:list
```

### Step 5: Deploy!

Just push your code to GitHub:

```bash
git push origin main
```

That's it! GitHub Actions will automatically:
1. Build your app
2. Run tests (if any)
3. Deploy to Firebase Hosting
4. Deploy Cloud Functions
5. Deploy Firestore and Storage rules

## Monitoring Deployments

### Check Deployment Status

1. Go to your GitHub repository
2. Click the **Actions** tab
3. You'll see the deployment workflow running
4. Click on it to see detailed logs
5. ✅ Green checkmark = successful deployment
6. ❌ Red X = deployment failed (check logs)

### View Live App

After successful deployment:
- **Frontend**: https://your-project-id.web.app
- **API/Functions**: Same domain, automatically available
- **Console**: https://console.firebase.google.com/project/your-project-id

## What Gets Deployed

The GitHub Actions workflow deploys:

- ✅ **Frontend** (Firebase Hosting)
  - All files in `/public` directory
  - Serves index.html for all routes (SPA support)

- ✅ **Backend/API** (Cloud Functions)
  - Express server in `server.js`
  - Runs as a Cloud Function
  - Automatically handles requests to `/api/**`

- ✅ **Database Rules** (Firestore)
  - Rules from `firestore.rules`
  - Indexes from `firestore.indexes.json`

- ✅ **Storage Rules** (Cloud Storage)
  - Rules from `storage.rules`
  - Handles file uploads/downloads

- ✅ **Configuration**
  - Environment variables
  - Firebase settings

## Environment Variables & Secrets

### For Cloud Functions

The following environment variables are needed for your Cloud Functions:

```bash
# Set your OpenAI API key for Cloud Functions:
firebase functions:config:set openai.key="your_openai_api_key"

# Verify it's set:
firebase functions:config:get
```

This should be done **once** in your Firebase project. The deployed Cloud Function will have access to it.

### In GitHub Actions

You can also set additional secrets in GitHub:
1. **Settings** → **Secrets and variables** → **Actions**
2. Add any other secrets your app needs
3. Reference them in the workflow as: `${{ secrets.SECRET_NAME }}`

## Troubleshooting

### Deployment Shows Failed in GitHub Actions

1. Click on the failed action
2. Expand the logs to see what went wrong
3. Common issues:
   - **"FIREBASE_TOKEN not found"**: Make sure you added the secret in GitHub
   - **"Project not found"**: Check `.firebaserc` has correct project ID
   - **"Permission denied"**: Firebase token expired, run `firebase login:ci` again

### App Deploys but Returns Errors

1. Check Firebase Console → Functions → Logs
2. Check Hosting logs in Firebase Console
3. Look for error messages in browser DevTools

### How to Fix and Redeploy

```bash
# Fix the issue
git add .
git commit -m "Fix: description"

# Push to deploy again
git push origin main
```

GitHub Actions will automatically run and deploy again.

## Manual Deployment (if needed)

If you ever need to deploy manually:

```bash
# Login if needed
firebase login

# Deploy everything
firebase deploy

# Or deploy specific services:
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore
firebase deploy --only storage
```

## Cost Breakdown

For typical personal projects:

| Service | Free Tier | Typical Cost |
|---------|-----------|--------------|
| Cloud Functions | 2M invocations/month | Free (per project) |
| Firestore | 50k reads/20k writes/day | Free |
| Storage | 5GB/month | Free |
| Hosting | 1GB/month | Free |
| **Total Monthly** | **All Free** | **Usually $0** |

See [Firebase Pricing](https://firebase.google.com/pricing) for details.

## Next Steps

1. ✅ Complete setup steps above
2. ✅ Test deployment by pushing a small change
3. ✅ Monitor GitHub Actions and Firebase Console
4. ✅ Share your live app URL!

## Need Help?

- **Firebase Docs**: https://firebase.google.com/docs
- **GitHub Actions**: https://docs.github.com/en/actions
- **Firebase CLI**: https://firebase.google.com/docs/cli

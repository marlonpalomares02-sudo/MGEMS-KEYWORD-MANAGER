# Mgemz Beta Testing System Setup Guide

## 🎯 Overview

This guide walks you through setting up the Firebase beta testing system for the Mgemz Keyword Manager Chrome extension. The system provides secure 7-day trials with anti-tampering protection and password-based unlocking.

## 📋 Prerequisites

### Required Accounts
- **Google Account**: For Firebase and Chrome Web Store
- **Firebase Project**: Project ID should be `mgemz-beta`
- **Billing Enabled**: Required for Cloud Functions (pay-as-you-go)

### Required Tools
- **Node.js** (v14 or higher)
- **Firebase CLI**: `npm install -g firebase-tools`
- **Chrome Developer Account**: For extension publishing

## 🚀 Quick Start (5 minutes)

### 1. Firebase Project Setup
```bash
# Login to Firebase
firebase login

# Create new project (if not exists)
firebase projects:create mgemz-beta

# Select project
firebase use mgemz-beta
```

### 2. Deploy Beta System
```bash
# Navigate to firebase directory
cd firebase

# Make deployment script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### 3. Test the System
```bash
# Run comprehensive tests
node test-beta-system.js
```

## 🔧 Detailed Setup

### Step 1: Firebase Configuration

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Click "Create Project"
   - Name: "Mgemz Beta System"
   - Project ID: `mgemz-beta`
   - Enable Google Analytics (optional)

2. **Enable Billing**
   - Go to Project Settings → Billing
   - Add billing account (required for Cloud Functions)
   - Set up budget alerts to avoid unexpected charges

3. **Enable Required Services**
   - Firestore Database (Native mode)
   - Cloud Functions
   - Authentication (optional, for admin access)

### Step 2: Deploy Functions

1. **Install Dependencies**
   ```bash
   cd firebase/functions
   npm install
   cd ..
   ```

2. **Deploy Firestore Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Deploy Cloud Functions**
   ```bash
   firebase deploy --only functions
   ```

### Step 3: Configure Extension

1. **Update Manifest**
   The manifest.json has been updated to use the new background script:
   ```json
   "background": {
     "service_worker": "background_scripts/backgroundWithBeta.js"
   }
   ```

2. **Configure Firebase Endpoints**
   The beta manager automatically uses the correct Firebase endpoints:
   - `https://us-central1-mgemz-beta.cloudfunctions.net/initializeBetaTrial`
   - `https://us-central1-mgemz-beta.cloudfunctions.net/validateTrialStatus`
   - `https://us-central1-mgemz-beta.cloudfunctions.net/validatePassword`

### Step 4: Test Integration

1. **Load Extension in Chrome**
   - Open Chrome Extensions page: `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select the extension directory

2. **Test Trial Flow**
   - Install extension (should initialize trial)
   - Check console logs for trial status
   - Wait 7 days or simulate expiration
   - Test password unlocking

3. **Verify Security**
   - Try reinstalling extension (should maintain trial status)
   - Test password usage limits
   - Check suspicious activity logging

## 🔐 Security Configuration

### Firestore Rules
The deployed rules provide:
- **Read Access**: Only authenticated devices can read their own data
- **Write Access**: Only server-side functions can write trial data
- **Validation**: All writes are validated server-side

### Password Management
- **3 Passwords**: Each limited to 3 uses total
- **Usage Tracking**: Monitored across all devices
- **Automatic Invalidation**: Passwords become invalid after 3 uses

### Device Fingerprinting
- **Canvas Fingerprinting**: Unique browser canvas signature
- **WebGL Fingerprinting**: Graphics hardware identification
- **Font Detection**: Installed fonts analysis
- **Hardware Profiling**: CPU, memory, screen resolution

## 📊 Monitoring & Analytics

### Firebase Console
- **Functions Dashboard**: Monitor function execution
- **Firestore Usage**: Track database reads/writes
- **Error Reporting**: View function errors
- **Performance**: Monitor response times

### Key Metrics
- Trial initialization rate
- Password usage patterns
- Extension unlock success rate
- Suspicious activity alerts

### Alerts Setup
Set up Firebase alerts for:
- Function execution errors
- High database usage
- Suspicious activity spikes
- Budget thresholds

## 🛠️ Troubleshooting

### Common Issues

**Extension Not Initializing Trial**
- Check Firebase function deployment status
- Verify device fingerprint generation
- Review extension background script logs

**Password Validation Failing**
- Confirm password is correct (case-sensitive)
- Check if usage limit has been reached
- Verify device ID consistency

**Trial Status Not Updating**
- Check Firestore rules allow reads
- Verify function execution logs
- Test with fresh device fingerprint

**Functions Not Deploying**
- Ensure billing is enabled
- Check Firebase project permissions
- Verify Node.js dependencies

### Debug Mode
Enable detailed logging:
```javascript
// In background script
console.log('🔍 Debug:', {
    deviceId: deviceId,
    trialStatus: trialStatus,
    passwordResult: passwordResult
});
```

## 🔑 Password Reference

### Valid Passwords (3 uses each)
1. `Mgems091285`
2. `Gems850912`
3. `WelcomeVxi128509`

### Usage Limits
- Each password can be used **3 times total** across all devices
- After 3 uses, password becomes permanently invalid
- Usage is tracked server-side and cannot be reset

## 📈 Scaling & Maintenance

### Performance Optimization
- Functions are deployed in `us-central1` region
- Firestore uses automatic scaling
- Consider regional deployment for global users

### Cost Management
- Monitor Firebase usage dashboard
- Set up budget alerts
- Optimize function execution time
- Use Firestore indexes for complex queries

### Security Updates
- Regular security rule reviews
- Monitor for new attack vectors
- Update device fingerprinting techniques
- Review password policies

## 🔄 Updates & Deployment

### Updating Functions
```bash
# Make changes to functions/index.js
# Deploy updates
firebase deploy --only functions
```

### Updating Extension
```bash
# Make changes to extension files
# Reload extension in Chrome
# Test beta system integration
```

### Rollback Procedures
```bash
# Rollback functions to previous version
firebase rollback --project mgemz-beta

# Or redeploy specific function version
```

## 📞 Support

### Firebase Support
- **Documentation**: [firebase.google.com/docs](https://firebase.google.com/docs)
- **Support**: Firebase console support tab
- **Community**: Stack Overflow, Firebase Discord

### Extension Support
- **Chrome Extension Docs**: [developer.chrome.com](https://developer.chrome.com)
- **Web Store Support**: Chrome Web Store developer dashboard

---

**Setup Completed**: ✅ Your beta testing system is now ready for production use!

**Next Steps**:
1. Test the complete user flow
2. Monitor usage patterns
3. Collect user feedback
4. Plan for full release

**Estimated Time**: 15-30 minutes for complete setup and testing
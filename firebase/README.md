# Firebase Beta Testing System

This directory contains the Firebase backend infrastructure for the Mgemz Keyword Manager Chrome extension's beta testing system.

## 🎯 System Overview

The beta testing system provides:
- **7-day trial period** with automatic locking after expiration
- **Anti-reinstallation protection** via device fingerprinting
- **3 unlock passwords** with 3-use limits each
- **Server-side validation** to prevent client-side tampering
- **Suspicious activity monitoring** and logging

## 📁 Directory Structure

```
firebase/
├── functions/                    # Firebase Cloud Functions
│   ├── index.js                 # Main functions implementation
│   └── package.json             # Functions dependencies
├── firestore.rules              # Firestore security rules
├── firestore.indexes.json       # Firestore indexes
├── firebase.json               # Firebase project configuration
├── deploy.sh                   # Deployment script
├── test-beta-system.js         # Comprehensive test suite
└── README.md                   # This file
```

## 🔧 Functions Overview

### 1. `initializeBetaTrial`
- **Purpose**: Creates a new 7-day trial for a device
- **Input**: Device fingerprint, extension ID
- **Output**: Trial status, days remaining
- **Security**: Prevents duplicate trials for same device

### 2. `validateTrialStatus`
- **Purpose**: Checks if a trial is still active
- **Input**: Device ID, extension ID
- **Output**: Trial active status, days remaining
- **Security**: Server-side validation prevents tampering

### 3. `validatePassword`
- **Purpose**: Validates unlock passwords
- **Input**: Password, device ID, extension ID
- **Output**: Success/failure, usage count
- **Security**: Tracks usage, limits to 3 uses per password

### 4. `generateDeviceFingerprint`
- **Purpose**: Creates unique device identifier
- **Input**: Device fingerprint data
- **Output**: Unique device ID
- **Security**: Combines multiple device characteristics

### 5. `monitorSuspiciousActivity`
- **Purpose**: Logs and alerts on suspicious behavior
- **Input**: Activity type, device ID, details
- **Output**: Success confirmation
- **Security**: Helps identify abuse patterns

## 🔐 Security Features

### Device Fingerprinting
- Canvas fingerprinting
- WebGL fingerprinting
- Font detection
- Screen resolution
- Timezone detection
- Hardware characteristics

### Anti-Tampering Measures
- Server-side trial validation
- Encrypted data storage
- Device fingerprint verification
- Usage tracking and limits

### Password System
- 3 unique passwords provided
- Each password limited to 3 uses
- Usage tracking per password
- Automatic invalidation after limit

## 🚀 Deployment Instructions

### Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project created (project ID: `mgemz-beta`)
- Billing enabled (required for Cloud Functions)

### Quick Deployment
```bash
# Make the deployment script executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

### Manual Deployment
```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy functions
firebase deploy --only functions
```

## 🧪 Testing

### Run Test Suite
```bash
# Run the comprehensive test suite
node test-beta-system.js
```

### Test Individual Functions
```bash
# Test device fingerprinting
curl -X POST https://us-central1-mgemz-beta.cloudfunctions.net/generateDeviceFingerprint \
  -H "Content-Type: application/json" \
  -d '{"fingerprintData": {"screenResolution": "1920x1080", "timezone": "America/New_York"}}'

# Test trial initialization
curl -X POST https://us-central1-mgemz-beta.cloudfunctions.net/initializeBetaTrial \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test-device-id", "extensionId": "test-extension-id"}'
```

## 📊 Firestore Collections

### `beta_trials`
Stores trial information for each device:
```javascript
{
  deviceId: string,
  extensionId: string,
  trialStartDate: timestamp,
  trialEndDate: timestamp,
  trialActive: boolean,
  daysRemaining: number,
  deviceFingerprint: object,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `password_usage`
Tracks password usage:
```javascript
{
  password: string,
  deviceId: string,
  extensionId: string,
  usageCount: number,
  maxUsage: number,
  lastUsedAt: timestamp,
  createdAt: timestamp
}
```

### `suspicious_activity`
Logs suspicious behavior:
```javascript
{
  deviceId: string,
  activityType: string,
  details: object,
  timestamp: timestamp,
  severity: string
}
```

## 🔑 Passwords

The system is configured with 3 passwords, each limited to 3 uses:

1. `Mgems091285` - 3 uses max
2. `Gems850912` - 3 uses max  
3. `WelcomeVxi128509` - 3 uses max

## 📈 Monitoring

### Firebase Console
- **Functions Dashboard**: View function execution metrics
- **Firestore Database**: Monitor trial data and usage
- **Authentication**: Track user access patterns
- **Monitoring**: Set up alerts for suspicious activity

### Key Metrics to Monitor
- Trial initialization rate
- Password usage patterns
- Suspicious activity alerts
- Function execution errors
- Firestore read/write operations

## 🛠️ Troubleshooting

### Common Issues

**Function Deployment Fails**
- Check Firebase billing is enabled
- Verify project ID in firebase.json
- Check function syntax and dependencies

**Trial Not Initializing**
- Verify device fingerprint is being sent
- Check Firestore rules allow writes
- Review function logs in Firebase console

**Password Validation Fails**
- Confirm password is correct
- Check usage limits haven't been exceeded
- Verify device ID is consistent

**Extension Not Unlocking**
- Check trial status response
- Verify password validation success
- Review extension background script logs

### Debug Mode
Enable debug logging in the extension:
```javascript
// In background script
console.log('🔍 Beta System Debug:', {
    deviceId: deviceId,
    trialStatus: trialStatus,
    passwordResult: passwordResult
});
```

## 🔗 Integration

### Chrome Extension Integration
The extension uses the `BetaManager` class in `background_scripts/betaManager.js` to:
- Generate device fingerprints
- Initialize trials
- Validate trial status
- Handle password unlocking
- Monitor suspicious activity

### API Endpoints
All functions are accessible via HTTPS endpoints:
- `https://us-central1-mgemz-beta.cloudfunctions.net/initializeBetaTrial`
- `https://us-central1-mgemz-beta.cloudfunctions.net/validateTrialStatus`
- `https://us-central1-mgemz-beta.cloudfunctions.net/validatePassword`
- `https://us-central1-mgemz-beta.cloudfunctions.net/generateDeviceFingerprint`
- `https://us-central1-mgemz-beta.cloudfunctions.net/monitorSuspiciousActivity`

## 📋 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Firebase function logs
3. Run the test suite to identify issues
4. Contact development team with error details

## 🔄 Updates

To update the beta system:
1. Make changes to functions code
2. Test locally with Firebase emulators
3. Deploy updates using deployment script
4. Test in production environment
5. Monitor for any issues

---

**Last Updated**: December 2025  
**Version**: 1.0.0  
**Status**: Production Ready
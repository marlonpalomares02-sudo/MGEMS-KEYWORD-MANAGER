#!/bin/bash

# Firebase Beta System Deployment Script
# This script deploys the Firebase functions and configures the beta testing system

echo "🚀 Starting Firebase Beta System Deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "🔑 Please login to Firebase..."
    firebase login
fi

# Navigate to functions directory
cd functions

# Install dependencies
echo "📦 Installing Firebase functions dependencies..."
npm install

# Navigate back to firebase root
cd ..

# Deploy Firestore rules
echo "🔥 Deploying Firestore security rules..."
firebase deploy --only firestore:rules

# Deploy functions
echo "⚡ Deploying Cloud Functions..."
firebase deploy --only functions

# Create project configuration
echo "📝 Creating project configuration..."
cat > ../popup/firebase-config.js << 'EOF'
// Firebase configuration for Mgemz Beta System
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "mgemz-beta",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

// Firebase functions endpoints
const firebaseEndpoints = {
    initializeBetaTrial: 'https://us-central1-mgemz-beta.cloudfunctions.net/initializeBetaTrial',
    validateTrialStatus: 'https://us-central1-mgemz-beta.cloudfunctions.net/validateTrialStatus',
    validatePassword: 'https://us-central1-mgemz-beta.cloudfunctions.net/validatePassword',
    generateDeviceFingerprint: 'https://us-central1-mgemz-beta.cloudfunctions.net/generateDeviceFingerprint',
    monitorSuspiciousActivity: 'https://us-central1-mgemz-beta.cloudfunctions.net/monitorSuspiciousActivity'
};
EOF

echo "✅ Firebase Beta System deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Update the Firebase configuration in popup/firebase-config.js with your actual Firebase project details"
echo "2. Test the beta system with the provided test script"
echo "3. Monitor the Firebase console for usage and security events"
echo ""
echo "🔐 Passwords configured:"
echo "   - Mgems091285 (3 uses max)"
echo "   - Gems850912 (3 uses max)" 
echo "   - WelcomeVxi128509 (3 uses max)"
echo ""
echo "📊 Firebase Console: https://console.firebase.google.com/project/mgemz-beta"
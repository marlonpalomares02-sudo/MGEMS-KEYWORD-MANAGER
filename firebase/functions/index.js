const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

// Constants
const VALID_PASSWORDS = ['Mgems091285', 'Gems850912', 'WelcomeVxi128509'];
const TRIAL_DURATION_DAYS = 7;

/**
 * Initialize beta trial for a new device
 */
exports.initializeBetaTrial = functions.https.onCall(async (data, context) => {
  try {
    const { deviceId, extensionId, fingerprintData } = data;
    
    // Validate input
    if (!deviceId || !extensionId || !fingerprintData) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }
    
    // Check if device is blacklisted
    const deviceDoc = await admin.firestore().collection('device_fingerprints').doc(deviceId).get();
    if (deviceDoc.exists && deviceDoc.data().blacklisted) {
      throw new functions.https.HttpsError('permission-denied', 'Device is blacklisted');
    }
    
    // Check for existing trials
    const existingTrial = await admin.firestore()
      .collection('beta_trials')
      .where('deviceId', '==', deviceId)
      .where('status', 'in', ['active', 'expired'])
      .get();
      
    if (!existingTrial.empty) {
      const trialData = existingTrial.docs[0].data();
      
      // Check if trial is still valid
      if (trialData.status === 'active' && trialData.trialEndDate.toDate() > new Date()) {
        return { 
          success: true, 
          trialActive: true, 
          daysRemaining: Math.ceil((trialData.trialEndDate.toDate() - new Date()) / (1000 * 60 * 60 * 24))
        };
      }
      
      // Trial expired - don't allow new trial
      if (trialData.status === 'expired') {
        throw new functions.https.HttpsError('permission-denied', 'Trial period already used');
      }
    }
    
    // Create new trial
    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate.getTime() + (TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000));
    
    const newTrial = {
      deviceId,
      extensionId,
      trialStartDate: admin.firestore.Timestamp.fromDate(trialStartDate),
      trialEndDate: admin.firestore.Timestamp.fromDate(trialEndDate),
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      unlockCount: 0,
      lastAccess: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: context.rawRequest.ip || 'unknown',
      userAgent: context.rawRequest.get('User-Agent') || 'unknown'
    };
    
    await admin.firestore().collection('beta_trials').add(newTrial);
    
    return { 
      success: true, 
      trialActive: true, 
      daysRemaining: TRIAL_DURATION_DAYS 
    };
    
  } catch (error) {
    console.error('Error initializing beta trial:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Validate current trial status
 */
exports.validateTrialStatus = functions.https.onCall(async (data, context) => {
  try {
    const { deviceId, extensionId } = data;
    
    if (!deviceId || !extensionId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }
    
    const trialSnapshot = await admin.firestore()
      .collection('beta_trials')
      .where('deviceId', '==', deviceId)
      .where('extensionId', '==', extensionId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
      
    if (trialSnapshot.empty) {
      return { trialActive: false, reason: 'no_trial_found' };
    }
    
    const trialData = trialSnapshot.docs[0].data();
    const now = new Date();
    
    // Update last access
    await trialSnapshot.docs[0].ref.update({ 
      lastAccess: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    if (trialData.status === 'locked') {
      return { trialActive: false, reason: 'trial_locked', unlockCount: trialData.unlockCount };
    }
    
    if (trialData.status === 'expired' || trialData.trialEndDate.toDate() < now) {
      // Mark as expired
      await trialSnapshot.docs[0].ref.update({ 
        status: 'expired',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { trialActive: false, reason: 'trial_expired' };
    }
    
    const daysRemaining = Math.ceil((trialData.trialEndDate.toDate() - now) / (1000 * 60 * 60 * 24));
    
    return { 
      trialActive: true, 
      daysRemaining, 
      trialStartDate: trialData.trialStartDate,
      trialEndDate: trialData.trialEndDate
    };
    
  } catch (error) {
    console.error('Error validating trial status:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Validate password and unlock extension
 */
exports.validatePassword = functions.https.onCall(async (data, context) => {
  try {
    const { password, deviceId, extensionId } = data;
    
    if (!password || !deviceId || !extensionId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }
    
    // Validate password
    if (!VALID_PASSWORDS.includes(password)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid password');
    }
    
    // Check password usage limits
    const usageSnapshot = await admin.firestore()
      .collection('password_usage')
      .where('password', '==', password)
      .get();
      
    const totalUses = usageSnapshot.size;
    
    if (totalUses >= 3) {
      throw new functions.https.HttpsError('resource-exhausted', 'Password usage limit exceeded');
    }
    
    // Check if this device already used this password
    const deviceUsage = usageSnapshot.docs.find(doc => 
      doc.data().deviceId === deviceId && 
      doc.data().password === password
    );
    
    if (deviceUsage) {
      throw new functions.https.HttpsError('already-exists', 'Password already used on this device');
    }
    
    // Record password usage
    await admin.firestore().collection('password_usage').add({
      password,
      deviceId,
      extensionId,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: context.rawRequest.ip || 'unknown'
    });
    
    // Unlock the trial
    const trialSnapshot = await admin.firestore()
      .collection('beta_trials')
      .where('deviceId', '==', deviceId)
      .where('status', '==', 'locked')
      .get();
      
    if (!trialSnapshot.empty) {
      await trialSnapshot.docs[0].ref.update({
        status: 'unlocked',
        unlockCount: admin.firestore.FieldValue.increment(1),
        unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return { success: true, message: 'Extension unlocked successfully' };
    
  } catch (error) {
    console.error('Error validating password:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Generate device fingerprint from device data
 */
exports.generateDeviceFingerprint = functions.https.onCall(async (data, context) => {
  try {
    const { fingerprintData } = data;
    
    if (!fingerprintData) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing fingerprint data');
    }
    
    // Create hash from fingerprint data
    const fingerprintString = JSON.stringify(fingerprintData);
    const deviceId = crypto.createHash('sha256').update(fingerprintString).digest('hex');
    
    // Store fingerprint
    await admin.firestore().collection('device_fingerprints').doc(deviceId).set({
      deviceId,
      fingerprintData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      blacklisted: false
    }, { merge: true });
    
    return { deviceId };
    
  } catch (error) {
    console.error('Error generating device fingerprint:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Monitor suspicious activity
 */
exports.monitorSuspiciousActivity = functions.https.onCall(async (data, context) => {
  try {
    const { deviceId, activityType, details } = data;
    
    if (!deviceId || !activityType) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }
    
    // Log suspicious activity
    await admin.firestore().collection('suspicious_activity').add({
      deviceId,
      activityType,
      details,
      reportedAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: context.rawRequest.ip || 'unknown'
    });
    
    // Check if device should be blacklisted
    const recentActivity = await admin.firestore()
      .collection('suspicious_activity')
      .where('deviceId', '==', deviceId)
      .where('reportedAt', '>', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .get();
      
    if (recentActivity.size >= 5) {
      // Blacklist device
      await admin.firestore().collection('device_fingerprints').doc(deviceId).update({
        blacklisted: true,
        blacklistedAt: admin.firestore.FieldValue.serverTimestamp(),
        blacklistReason: 'suspicious_activity'
      });
      
      // Lock all trials for this device
      const trials = await admin.firestore()
        .collection('beta_trials')
        .where('deviceId', '==', deviceId)
        .where('status', '==', 'active')
        .get();
        
      const batch = admin.firestore().batch();
      trials.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'locked',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      await batch.commit();
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('Error monitoring suspicious activity:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
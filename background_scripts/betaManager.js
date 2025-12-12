/**
 * BetaManager - Handles beta trial functionality and security
 */
class BetaManager {
  constructor() {
    this.firebaseEndpoint = 'https://us-central1-mgemz-beta.cloudfunctions.net';
    this.deviceFingerprint = null;
    this.trialStatus = null;
    this.isInitialized = false;
    this.storageKeys = {
      deviceFingerprint: 'beta_device_fingerprint',
      trialStatus: 'beta_trial_status',
      lastCheck: 'beta_last_check',
      encryptedData: 'beta_encrypted_data'
    };
  }

  /**
   * Initialize the beta manager
   */
  async initialize() {
    try {
      console.log('🚀 Initializing BetaManager...');
      
      // Check if already initialized
      if (this.isInitialized) {
        return this.trialStatus;
      }

      // Load cached data first
      await this.loadCachedData();
      
      // Generate or load device fingerprint
      this.deviceFingerprint = await this.getOrGenerateFingerprint();
      
      // Check trial status
      this.trialStatus = await this.checkTrialStatus();
      
      // Set up periodic checks
      this.setupPeriodicChecks();
      
      this.isInitialized = true;
      console.log('✅ BetaManager initialized successfully');
      
      return this.trialStatus;
    } catch (error) {
      console.error('❌ Failed to initialize BetaManager:', error);
      throw error;
    }
  }

  /**
   * Get or generate device fingerprint
   */
  async getOrGenerateFingerprint() {
    try {
      // Check local storage first
      const cachedFingerprint = await this.getStorageData(this.storageKeys.deviceFingerprint);
      if (cachedFingerprint) {
        console.log('📱 Using cached device fingerprint');
        return cachedFingerprint;
      }

      console.log('🔍 Generating new device fingerprint...');
      const fingerprintData = await this.generateFingerprintData();
      
      // Get fingerprint from server
      const response = await this.callFirebaseFunction('generateDeviceFingerprint', {
        fingerprintData
      });
      
      const deviceId = response.deviceId;
      
      // Store locally
      await this.setStorageData(this.storageKeys.deviceFingerprint, deviceId);
      
      console.log('🔐 Device fingerprint generated:', deviceId);
      return deviceId;
      
    } catch (error) {
      console.error('❌ Failed to generate device fingerprint:', error);
      throw error;
    }
  }

  /**
 * Generate comprehensive device fingerprint data (Service Worker Compatible)
   */
  async generateFingerprintData() {
    try {
      // Service worker compatible fingerprint data
      const fingerprintData = {
        // Basic browser info (available in service worker)
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: self.navigator.language,
        platform: self.navigator.platform,
        userAgent: self.navigator.userAgent,
        cores: self.navigator.hardwareConcurrency || 4,
        memory: self.navigator.deviceMemory || 8,
        
        // Extension-specific info
        extensionId: chrome.runtime.id,
        manifestVersion: chrome.runtime.getManifest().manifest_version,
        extensionVersion: chrome.runtime.getManifest().version,
        
 // Screen info (if available through chrome API)
        screenInfo: await this.getScreenInfo(),
        
        // Generate deterministic fingerprint
        deterministicFingerprint: await this.generateDeterministicFingerprint(),
        
        // Timestamp for uniqueness
        timestamp: Date.now()
      };
      
      console.log('🎯 Fingerprint data collected (Service Worker)');
      return fingerprintData;
      
    } catch (error) {
      console.error('❌ Failed to generate fingerprint data:', error);
      return {
        timezone: 'unknown',
        language: 'unknown',
        platform: 'unknown',
        userAgent: 'unknown',
        cores: 4,
        memory: 8,
        extensionId: chrome.runtime.id,
        manifestVersion: 3,
        extensionVersion: 'unknown',
        screenInfo: 'unknown',
        deterministicFingerprint: 'fallback_' + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get screen info (Service Worker Compatible)
   */
  async getScreenInfo() {
    try {
      // Try to get screen info from chrome API if available
      if (chrome.system && chrome.system.display) {
        const displays = await chrome.system.display.getInfo();
        if (displays && displays.length > 0) {
          const primary = displays[0];
          return `${primary.bounds.width}x${primary.bounds.height}`;
        }
      }
      
      // Fallback to basic info
      return 'service_worker_fallback';
    } catch (error) {
      console.warn('⚠️ Screen info failed:', error);
      return 'unknown';
    }
  }

  /**
   * Generate deterministic fingerprint (Service Worker Compatible)
   */
  async generateDeterministicFingerprint() {
    try {
      // Create a deterministic fingerprint based on available service worker data
      const components = [
        self.navigator.userAgent,
        self.navigator.language,
        self.navigator.platform,
        chrome.runtime.id,
        new Date().getTimezoneOffset(),
        self.navigator.hardwareConcurrency || 4,
        self.navigator.deviceMemory || 8
      ];
      
      // Simple hash function
      const hash = this.simpleHash(components.join('|'));
      
      return `sw_${hash}`;
    } catch (error) {
      console.warn('⚠️ Deterministic fingerprint failed:', error);
      return `sw_fallback_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Simple hash function for deterministic fingerprinting
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check trial status with server
   */
  async checkTrialStatus() {
    try {
      console.log('🔍 Checking trial status...');
      
      const response = await this.callFirebaseFunction('validateTrialStatus', {
        deviceId: this.deviceFingerprint,
        extensionId: chrome.runtime.id
      });
      
      console.log('📊 Trial status:', response);
      
      // Cache the status
      await this.setStorageData(this.storageKeys.trialStatus, response);
      await this.setStorageData(this.storageKeys.lastCheck, Date.now());
      
      return response;
      
    } catch (error) {
      console.error('❌ Failed to check trial status:', error);
      
      // Return cached status if available
      const cachedStatus = await this.getStorageData(this.storageKeys.trialStatus);
      if (cachedStatus) {
        console.log('📋 Using cached trial status');
        return cachedStatus;
      }
      
      // Default to trial active for first run
      return { trialActive: true, daysRemaining: 7 };
    }
  }

  /**
   * Unlock extension with password
   */
  async unlockWithPassword(password) {
    try {
      console.log('🔓 Attempting to unlock with password...');
      
      const response = await this.callFirebaseFunction('validatePassword', {
        password,
        deviceId: this.deviceFingerprint,
        extensionId: chrome.runtime.id
      });
      
      if (response.success) {
        console.log('✅ Extension unlocked successfully');
        
        // Update local status
        this.trialStatus = { trialActive: true, daysRemaining: 999 };
        await this.setStorageData(this.storageKeys.trialStatus, this.trialStatus);
        
        // Reload extension to enable features
        chrome.runtime.reload();
      }
      
      return response;
      
    } catch (error) {
      console.error('❌ Failed to unlock extension:', error);
      throw error;
    }
  }

  /**
   * Call Firebase function
   */
  async callFirebaseFunction(functionName, data) {
    try {
      const response = await fetch(`${this.firebaseEndpoint}/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return await response.json();
      
    } catch (error) {
      console.error(`❌ Firebase function ${functionName} failed:`, error);
      throw error;
    }
  }

  /**
   * Set up periodic trial status checks
   */
  setupPeriodicChecks() {
    // Check every hour
    setInterval(async () => {
      try {
        await this.checkTrialStatus();
      } catch (error) {
        console.error('❌ Periodic trial check failed:', error);
      }
    }, 60 * 60 * 1000);

    // Check on extension startup
    chrome.runtime.onStartup.addListener(async () => {
      try {
        await this.checkTrialStatus();
      } catch (error) {
        console.error('❌ Startup trial check failed:', error);
      }
    });
  }

  /**
   * Handle trial expiration
   */
  handleTrialExpired() {
    console.log('🔒 Trial expired - locking extension features');
    
    // Set up message listener for trial status checks
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'checkTrialStatus') {
        sendResponse({ 
          trialActive: false, 
          reason: this.trialStatus.reason,
          showUnlockDialog: true 
        });
      }
    });
  }

  /**
   * Get storage data
   */
  async getStorageData(key) {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key]);
        });
      });
    } catch (error) {
      console.warn('⚠️ Failed to get storage data:', error);
      return null;
    }
  }

  /**
   * Set storage data
   */
  async setStorageData(key, value) {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          resolve();
        });
      });
    } catch (error) {
      console.warn('⚠️ Failed to set storage data:', error);
    }
  }

  /**
   * Load cached data
   */
  async loadCachedData() {
    try {
      const cachedStatus = await this.getStorageData(this.storageKeys.trialStatus);
      if (cachedStatus) {
        this.trialStatus = cachedStatus;
      }
      
      const cachedFingerprint = await this.getStorageData(this.storageKeys.deviceFingerprint);
      if (cachedFingerprint) {
        this.deviceFingerprint = cachedFingerprint;
      }
      
      console.log('📋 Cached data loaded');
    } catch (error) {
      console.warn('⚠️ Failed to load cached data:', error);
    }
  }

  /**
   * Get current trial status
   */
  getTrialStatus() {
    return this.trialStatus;
  }

  /**
   * Check if trial is active
   */
  isTrialActive() {
    return this.trialStatus && this.trialStatus.trialActive;
  }

  /**
   * Get days remaining
   */
  getDaysRemaining() {
    return this.trialStatus ? this.trialStatus.daysRemaining : 0;
  }
}

// Initialize beta manager
const betaManager = new BetaManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BetaManager;
}
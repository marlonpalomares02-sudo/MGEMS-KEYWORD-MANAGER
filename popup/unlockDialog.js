/**
 * Unlock Dialog JavaScript
 */

// Firebase configuration
const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "mgemz-beta",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let app, functions;

try {
    app = firebase.initializeApp(FIREBASE_CONFIG);
    functions = firebase.functions();
    functions.useEmulator("localhost", 5001); // For local testing
} catch (error) {
    console.warn('Firebase not available, using direct API calls');
}

// DOM elements
const passwordInput = document.getElementById('passwordInput');
const unlockButton = document.getElementById('unlockButton');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const passwordStrength = document.getElementById('passwordStrength');
const contactSupport = document.getElementById('contactSupport');

// Password usage tracking
let passwordUsage = {
    'Mgems091285': 3,
    'Gems850912': 3,
    'WelcomeVxi128509': 3
};

// Initialize the unlock dialog
document.addEventListener('DOMContentLoaded', function() {
    initializeUnlockDialog();
    loadPasswordUsage();
    setupEventListeners();
});

/**
 * Initialize the unlock dialog
 */
function initializeUnlockDialog() {
    console.log('🔓 Initializing unlock dialog...');
    
    // Check if we're in development mode
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🛠️ Development mode detected');
        // In development, allow any password for testing
        window.IS_DEVELOPMENT = true;
    }
    
    // Focus on password input
    setTimeout(() => {
        passwordInput.focus();
    }, 100);
}

/**
 * Load password usage from server
 */
async function loadPasswordUsage() {
    try {
        console.log('📊 Loading password usage...');
        
        // For now, we'll use default values
        // In production, this would come from Firebase
        updatePasswordUsageDisplay();
        
    } catch (error) {
        console.error('❌ Failed to load password usage:', error);
        // Use default values on error
        updatePasswordUsageDisplay();
    }
}

/**
 * Update password usage display
 */
function updatePasswordUsageDisplay() {
    const usageElements = [
        document.getElementById('usage1'),
        document.getElementById('usage2'),
        document.getElementById('usage3')
    ];
    
    const passwords = Object.keys(passwordUsage);
    
    usageElements.forEach((element, index) => {
        if (element && passwords[index]) {
            const remaining = passwordUsage[passwords[index]];
            element.textContent = `Uses remaining: ${remaining}`;
            
            // Update visual indicator
            if (remaining <= 0) {
                element.classList.add('expired');
                element.parentElement.classList.add('disabled');
            } else if (remaining <= 1) {
                element.classList.add('warning');
            } else {
                element.classList.add('active');
            }
        }
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Password input events
    passwordInput.addEventListener('input', handlePasswordInput);
    passwordInput.addEventListener('keypress', handlePasswordKeypress);
    
    // Unlock button
    unlockButton.addEventListener('click', handleUnlockClick);
    
    // Contact support button
    contactSupport.addEventListener('click', handleContactSupport);
    
    // Prevent form submission
    document.addEventListener('submit', (e) => {
        e.preventDefault();
        handleUnlockClick();
    });
}

/**
 * Handle password input changes
 */
function handlePasswordInput() {
    const password = passwordInput.value.trim();
    
    // Clear previous messages
    hideMessages();
    
    // Validate password
    if (password.length === 0) {
        unlockButton.disabled = true;
        passwordInput.classList.remove('error', 'success');
        return;
    }
    
    // Check if password is valid
    const isValidPassword = isValidPasswordFormat(password);
    
    if (isValidPassword) {
        passwordInput.classList.remove('error');
        passwordInput.classList.add('success');
        unlockButton.disabled = false;
        
        // Show password strength
        updatePasswordStrength(password);
    } else {
        passwordInput.classList.remove('success');
        passwordInput.classList.add('error');
        unlockButton.disabled = true;
    }
}

/**
 * Handle password keypress
 */
function handlePasswordKeypress(e) {
    if (e.key === 'Enter') {
        handleUnlockClick();
    }
}

/**
 * Handle unlock button click
 */
async function handleUnlockClick() {
    const password = passwordInput.value.trim();
    
    if (!password) {
        showError('Please enter a password');
        return;
    }
    
    if (!isValidPasswordFormat(password)) {
        showError('Invalid password format');
        return;
    }
    
    // Check if password has uses remaining
    if (!window.IS_DEVELOPMENT && passwordUsage[password] <= 0) {
        showError('This password has reached its usage limit');
        return;
    }
    
    // Show loading state
    setLoadingState(true);
    
    try {
        console.log('🔓 Attempting to unlock with password...');
        
        // In development mode, simulate successful unlock
        if (window.IS_DEVELOPMENT) {
            await simulateUnlock(password);
            return;
        }
        
        // Call Firebase function
        const result = await unlockWithFirebase(password);
        
        if (result.success) {
            handleSuccessfulUnlock(password);
        } else {
            showError(result.message || 'Unlock failed');
        }
        
    } catch (error) {
        console.error('❌ Unlock failed:', error);
        showError('Unlock failed. Please try again or contact support.');
    } finally {
        setLoadingState(false);
    }
}

/**
 * Check if password format is valid
 */
function isValidPasswordFormat(password) {
    const validPasswords = ['Mgems091285', 'Gems850912', 'WelcomeVxi128509'];
    return validPasswords.includes(password);
}

/**
 * Update password strength indicator
 */
function updatePasswordStrength(password) {
    const strength = calculatePasswordStrength(password);
    
    passwordStrength.className = 'password-strength';
    
    if (strength > 0.8) {
        passwordStrength.classList.add('strong');
    } else if (strength > 0.5) {
        passwordStrength.classList.add('medium');
    } else {
        passwordStrength.classList.add('weak');
    }
}

/**
 * Calculate password strength
 */
function calculatePasswordStrength(password) {
    let strength = 0;
    
    // Length
    if (password.length >= 12) strength += 0.3;
    else if (password.length >= 8) strength += 0.2;
    
    // Complexity
    if (/[a-z]/.test(password)) strength += 0.2;
    if (/[A-Z]/.test(password)) strength += 0.2;
    if (/[0-9]/.test(password)) strength += 0.2;
    if (/[^A-Za-z0-9]/.test(password)) strength += 0.1;
    
    return Math.min(strength, 1.0);
}

/**
 * Simulate unlock in development mode
 */
async function simulateUnlock(password) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update usage count
    passwordUsage[password]--;
    updatePasswordUsageDisplay();
    
    // Show success
    showSuccess('✅ Extension unlocked successfully! (Development Mode)');
    
    // Reload extension after delay
    setTimeout(() => {
        if (chrome && chrome.runtime) {
            chrome.runtime.reload();
        } else {
            window.location.reload();
        }
    }, 2000);
}

/**
 * Unlock with Firebase
 */
async function unlockWithFirebase(password) {
    try {
        // Call Firebase function directly
        const response = await fetch(`${FIREBASE_CONFIG.projectId}/validatePassword`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                password: password,
                deviceId: await getDeviceId(),
                extensionId: chrome.runtime.id
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('❌ Firebase unlock failed:', error);
        throw error;
    }
}

/**
 * Handle successful unlock
 */
function handleSuccessfulUnlock(password) {
    console.log('✅ Extension unlocked successfully');
    
    // Update usage count
    passwordUsage[password]--;
    updatePasswordUsageDisplay();
    
    // Show success message
    showSuccess('🎉 Extension unlocked successfully! Reloading...');
    
    // Store unlock status
    localStorage.setItem('extension_unlocked', 'true');
    localStorage.setItem('unlock_time', Date.now().toString());
    
    // Reload extension after delay
    setTimeout(() => {
        if (chrome && chrome.runtime) {
            chrome.runtime.reload();
        } else {
            window.location.reload();
        }
    }, 2000);
}

/**
 * Get device ID (simplified for demo)
 */
async function getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('device_id', deviceId);
    }
    
    return deviceId;
}

/**
 * Handle contact support
 */
function handleContactSupport() {
    console.log('📧 Contacting support...');
    
    // In a real implementation, this would open a support form or email
    const supportEmail = 'support@mgemz.com';
    const subject = encodeURIComponent('Mgemz Keyword Manager - Unlock Assistance');
    const body = encodeURIComponent(
        `Hello,\n\nI need assistance unlocking the Mgemz Keyword Manager extension.\n\n` +
        `Device ID: ${localStorage.getItem('device_id') || 'unknown'}\n` +
        `Extension ID: ${chrome.runtime.id}\n` +
        `Browser: ${navigator.userAgent}\n\n` +
        `Please help me unlock the extension.\n\nThank you!`
    );
    
    window.open(`mailto:${supportEmail}?subject=${subject}&body=${body}`);
}

/**
 * Show error message
 */
function showError(message) {
    hideMessages();
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(hideMessages, 5000);
}

/**
 * Show success message
 */
function showSuccess(message) {
    hideMessages();
    successMessage.textContent = message;
    successMessage.style.display = 'block';
}

/**
 * Hide all messages
 */
function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

/**
 * Set loading state
 */
function setLoadingState(loading) {
    if (loading) {
        unlockButton.disabled = true;
        unlockButton.classList.add('loading');
        document.querySelector('.button-text').style.display = 'none';
        document.querySelector('.button-loading').style.display = 'inline-block';
        passwordInput.disabled = true;
    } else {
        unlockButton.disabled = false;
        unlockButton.classList.remove('loading');
        document.querySelector('.button-text').style.display = 'inline-block';
        document.querySelector('.button-loading').style.display = 'none';
        passwordInput.disabled = false;
    }
}

// Additional CSS for password usage indicators
const style = document.createElement('style');
style.textContent = `
    .usage-count.expired {
        color: #dc3545;
        font-weight: bold;
    }
    
    .usage-count.warning {
        color: #ffc107;
        font-weight: bold;
    }
    
    .usage-count.active {
        color: #28a745;
        font-weight: bold;
    }
    
    .password-item.disabled {
        opacity: 0.5;
        pointer-events: none;
    }
    
    .password-item.disabled code {
        background: #f8f9fa;
        color: #6c757d;
    }
`;
document.head.appendChild(style);
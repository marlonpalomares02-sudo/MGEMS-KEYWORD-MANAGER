console.log('Background script with beta manager loaded');

// Load beta manager script at the top level (service worker compatible)
let betaManager = null;
let isExtensionUnlocked = false;

// Try to load beta manager, but allow fallback
try {
  console.log('📦 Attempting to load betaManager.js...');
  importScripts('betaManager.js');
  console.log('✅ Beta manager script loaded successfully at top level');
  console.log('🔍 BetaManager class available:', typeof BetaManager);
} catch (error) {
  console.error('❌ Failed to load beta manager script at top level:', error);
  console.error('📋 Error details:', error.message);
  console.error('🗂️ Error stack:', error.stack);
  console.log('🔧 Proceeding in development mode without beta manager');
  // Allow extension to run without beta manager
  isExtensionUnlocked = true;
}

// Global error handler for the background script
self.addEventListener('error', (event) => {
  console.error('Unhandled error in background script:', event.error);
});

let keywords = [];

// Promisified storage access
const storage = {
  get: (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve)),
  set: (items) => new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  })
};

/**
 * Initialize beta manager and check trial status
 */
async function initializeBetaSystem() {
  try {
    console.log('🚀 Initializing beta system...');
    
    // Check if BetaManager is available (already loaded at top level)
    if (typeof BetaManager === 'undefined') {
      console.warn('⚠️ BetaManager class is not available - running in development mode');
      isExtensionUnlocked = true;
      await initializeExtension();
      return;
    }
    
    console.log('✅ BetaManager class is available');
    
    // Initialize beta manager instance
    betaManager = new BetaManager();
    const trialStatus = await betaManager.initialize();
    
    console.log('📊 Trial status:', trialStatus);
    
    // Check if extension is unlocked
    isExtensionUnlocked = trialStatus.trialActive;
    
    if (!isExtensionUnlocked) {
      console.log('🔒 Extension is locked - trial expired or not activated');
      // Extension will remain in locked state
    } else {
      console.log('🔓 Extension is unlocked - trial active');
      // Initialize extension functionality
      await initializeExtension();
    }
    
    console.log('✅ Beta system initialization completed');
    
  } catch (error) {
    console.error('❌ Failed to initialize beta system:', error);
    console.error('📋 Error details:', error.message);
    console.error('🗂️ Error stack:', error.stack);
    
    // Fallback: allow extension to run in development mode
    console.warn('⚠️ Allowing extension to run in fallback mode');
    // Fallback: allow extension to run (for development)
    isExtensionUnlocked = true;
    initializeExtension(); // Don't await in fallback mode
  }
}

/**
 * Initialize extension functionality (only if unlocked)
 */
async function initializeExtension() {
  console.log('🔧 Initializing extension functionality...');
  
  setupContextMenu();
  await loadSavedKeywords();
  
  // Set up tab change listeners to update context menu visibility
  chrome.tabs.onActivated.addListener((activeInfo) => {
    updateContextMenuForTab(activeInfo.tabId);
  });
  
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      updateContextMenuForTab(tabId);
    }
  });
  
  // Update context menu for currently active tab
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs[0]) {
      updateContextMenuForTab(tabs[0].id);
    }
  } catch (error) {
    console.log('Error getting current tab:', error.message);
  }
}

// Function to update badge
async function updateBadge() {
  const count = keywords.length;
  console.log('Updating badge count to:', count);
  await chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}

// Load saved keywords
async function loadSavedKeywords() {
  const data = await storage.get(['keywords']);
  keywords = data.keywords || [];
  console.log('Loaded keywords:', keywords.length);
  await updateBadge();
}

// Setup context menu - now dynamic based on tab URL
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    // Create context menu for selection context
    chrome.contextMenus.create({
      id: "addKeyword",
      title: "Add to Keyword Manager",
      contexts: ["selection"]
    });
    
    // Create context menu for bulk addition (page context)
    chrome.contextMenus.create({
      id: "addBulkKeywords",
      title: "Add All Selected Keywords",
      contexts: ["page"]
    });
  });
}

// Update context menu visibility based on current tab
async function updateContextMenuForTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url) return;
    
    // Check if this is a Google Ads/Keyword Planner page
    const isGoogleAdsPage = /https?:\/\/ads\.google\.com/.test(tab.url) ||
                           /https?:\/\/ads\.google\.co\.[a-z]{2}/.test(tab.url) ||
                           /https?:\/\/keywordplanner\.google\.com/.test(tab.url) ||
                           /https?:\/\/ads\.googleapis\.com/.test(tab.url);
    
    console.log('Tab URL:', tab.url, 'Is Google Ads page:', isGoogleAdsPage);
    
    // Update context menu visibility for both menu items
    chrome.contextMenus.update("addKeyword", {
      visible: isGoogleAdsPage
    }, () => {
      if (chrome.runtime.lastError) {
        console.log('Context menu update error:', chrome.runtime.lastError.message);
      }
    });
    
    chrome.contextMenus.update("addBulkKeywords", {
      visible: isGoogleAdsPage
    }, () => {
      if (chrome.runtime.lastError) {
        console.log('Bulk context menu update error:', chrome.runtime.lastError.message);
      }
    });
    
  } catch (error) {
    console.log('Error updating context menu for tab:', error.message);
  }
}

// Extension startup
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed');
  await initializeBetaSystem();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension startup');
  await initializeBetaSystem();
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!isExtensionUnlocked) {
    console.log('Extension is locked - ignoring context menu click');
    return;
  }
  
  if (info.menuItemId === "addKeyword" && info.selectionText) {
    const keywordText = info.selectionText.trim();
    console.log('Adding keyword from context menu:', keywordText);

    // Enhanced validation for Google Keyword Planner context
    if (tab && tab.url) {
      const isGoogleAdsPage = /https?:\/\/ads\.google\.com/.test(tab.url) ||
                             /https?:\/\/ads\.google\.co\.[a-z]{2}/.test(tab.url) ||
                             /https?:\/\/keywordplanner\.google\.com/.test(tab.url) ||
                             /https?:\/\/ads\.googleapis\.com/.test(tab.url);
      
      if (isGoogleAdsPage) {
        // For Google Ads pages, validate that the selection looks like a keyword
        const invalidPatterns = [
          /^(Keywords?|Keyword text|Search terms?|Volume|Competition|Avg\.?\s*CPC|Top\s*of\s*page\s*bid|Account|Campaign|Ad\s*group)$/i,
          /^(Select\s+all|Select\s+keyword|Actions|Download|Edit|Remove)$/i,
          /^\s*\d+\s*$/, // Pure numbers
          /^\$\d+/, // Currency amounts
          /^\d+\.?\d*%$/, // Percentages
          /^\d+\.?\d*[KMkm]$/, // Numbers with K/M suffixes
          /^[\s\-\–—]+$/, // Just dashes or spaces
        ];
        
        const isValidKeyword = !invalidPatterns.some(pattern => pattern.test(keywordText));
        
        if (!isValidKeyword) {
          console.log('Filtered out non-keyword text:', keywordText);
          // Still add it but mark it as potentially invalid
          const keywordObject = {
            text: keywordText,
            timestamp: Date.now(),
            source: 'google_ads_context_menu',
            isValid: false
          };
          addKeyword(keywordObject);
          return;
        }
      }
    }

    const keywordObject = {
      text: keywordText,
      timestamp: Date.now(),
      source: 'context_menu'
    };
    
    addKeyword(keywordObject);
  }
  
  if (info.menuItemId === "addBulkKeywords") {
    console.log('Bulk keyword addition requested');
    // Send message to content script to handle bulk addition
    chrome.tabs.sendMessage(tab.id, { action: 'triggerBulkKeywordAddition' }).catch(error => {
      console.error('Failed to send bulk keywords message:', error);
    });
  }
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  // Check trial status for certain actions
  if (['addKeyword', 'getKeywords', 'generateSuggestions', 'generateAds'].includes(request.action)) {
    if (!isExtensionUnlocked) {
      sendResponse({ 
        success: false, 
        error: 'Extension is locked. Please unlock to continue using features.',
        showUnlockDialog: true 
      });
      return;
    }
  }
  
  (async () => {
    try {
      let response;
      switch (request.action) {
        case 'addKeyword':
          response = await addKeyword(request.keyword);
          break;
        case 'getKeywords':
          console.log('Received getKeywords request');
          response = { success: true, keywords: keywords, count: keywords.length };
          break;
        case 'removeKeyword':
          response = await removeKeyword(request.keyword);
          break;
        case 'clearKeywords':
          response = await clearKeywords();
          break;
        case 'exportKeywords':
          response = await exportKeywords(request.matchType);
          break;
        case 'addKeywordsBulk':
          response = await addKeywordsBulk(request.keywords);
          break;
        case 'checkTrialStatus':
          if (betaManager) {
            response = betaManager.getTrialStatus();
          } else {
            response = { trialActive: isExtensionUnlocked, timeRemaining: 'Unlimited (Development Mode)' };
          }
          break;
        case 'unlockExtension':
          if (betaManager) {
            response = await betaManager.unlockWithPassword(request.password);
            if (response.success) {
              isExtensionUnlocked = true;
              await initializeExtension();
            }
          } else {
            // Development mode - accept any password
            isExtensionUnlocked = true;
            await initializeExtension();
            response = { success: true, message: 'Extension unlocked in development mode' };
          }
          break;
        default:
          response = { success: false, error: 'Unknown action' };
      }
      
      sendResponse(response);
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // Keep message channel open for async response
});

// Keyword management functions
async function addKeyword(keywordObject) {
  if (!keywordObject || !keywordObject.text) {
    return { success: false, error: 'Invalid keyword data' };
  }

  const isDuplicate = keywords.some(k => k.text === keywordObject.text);
  if (isDuplicate) {
    return { success: false, error: 'Keyword already exists' };
  }

  const newKeyword = { ...keywordObject, matchType: keywordObject.matchType || 'broad' };
  keywords.push(newKeyword);

  await storage.set({ keywords });
  await updateBadge();
  
  // Notify popups/other parts of the extension
  chrome.runtime.sendMessage({ action: 'keywordsUpdated' }).catch(() => {});
  
  return { success: true };
}

async function addKeywordsBulk(keywordObjects) {
  console.log('Received addKeywordsBulk request:', keywordObjects);
  let totalAdded = 0;
  const duplicates = [];
  
  for (const keywordObject of keywordObjects) {
    const isDuplicate = keywords.some(k => k.text === keywordObject.text);
    if (!isDuplicate) {
      const newKeyword = { ...keywordObject, matchType: keywordObject.matchType || 'broad' };
      keywords.push(newKeyword);
      totalAdded++;
    } else {
      duplicates.push(keywordObject.text);
    }
  }
  
  if (totalAdded > 0) {
    await storage.set({ keywords });
    await updateBadge();
    
    // Notify popups/other parts of the extension
    chrome.runtime.sendMessage({ action: 'keywordsUpdated' }).catch(() => {});
  }
  
  return { 
    success: true, 
    totalAdded: totalAdded,
    duplicates: duplicates
  };
}

async function removeKeyword(keywordText) {
  const initialLength = keywords.length;
  keywords = keywords.filter(k => k.text !== keywordText);
  
  if (keywords.length < initialLength) {
    await storage.set({ keywords });
    await updateBadge();
    
    // Notify popups/other parts of the extension
    chrome.runtime.sendMessage({ action: 'keywordsUpdated' }).catch(() => {});
    
    return { success: true };
  }
  
  return { success: false, error: 'Keyword not found' };
}

async function clearKeywords() {
  keywords = [];
  await storage.set({ keywords });
  await updateBadge();
  
  // Notify popups/other parts of the extension
  chrome.runtime.sendMessage({ action: 'keywordsUpdated' }).catch(() => {});
  
  return { success: true };
}

async function exportKeywords(matchType) {
  const keywordsToExport = matchType === 'all' ? keywords : keywords.filter(k => k.matchType === matchType);
  
  if (keywordsToExport.length === 0) {
    return { success: false, error: 'No keywords to export' };
  }
  
  const csvContent = keywordsToExport.map(k => k.text).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const filename = `keywords_${matchType}_${new Date().toISOString().split('T')[0]}.csv`;
  
  try {
    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
    
    return { success: true, count: keywordsToExport.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
console.log('Background script with beta manager loaded');

// Global error handler for the background script
self.addEventListener('error', (event) => {
  console.error('Unhandled error in background script:', event.error);
});

let keywords = [];
let betaManager = null;
let isExtensionUnlocked = false;

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
    
    // Load beta manager
    await loadBetaManager();
    
    // Initialize beta manager
    betaManager = new BetaManager();
    const trialStatus = await betaManager.initialize();
    
    console.log('📊 Trial status:', trialStatus);
    
    // Check if extension is unlocked
    isExtensionUnlocked = trialStatus.trialActive;
    
    if (!isExtensionUnlocked) {
      console.log('🔒 Extension is locked - trial expired or not activated');
      // Extension will remain in locked state
    } else {
      console.log('✅ Extension is unlocked and active');
      // Continue with normal initialization
      await initializeExtension();
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize beta system:', error);
    // Fallback: allow extension to run (for development)
    isExtensionUnlocked = true;
    await initializeExtension();
  }
}

/**
 * Load beta manager script
 */
async function loadBetaManager() {
  try {
    // Use importScripts for service worker context
    importScripts(chrome.runtime.getURL('background_scripts/betaManager.js'));
    console.log('✅ Beta manager script loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load beta manager script:', error);
    throw error;
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
  await updateBadge();
}

// Setup context menu - now dynamic based on tab URL
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    // Create context menu only for selection context
    chrome.contextMenus.create({
      id: "addKeyword",
      title: "Add to Keyword Manager",
      contexts: ["selection"]
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
    
    // Update context menu visibility
    chrome.contextMenus.update("addKeyword", {
      visible: isGoogleAdsPage
    }, () => {
      if (chrome.runtime.lastError) {
        console.log('Context menu update error:', chrome.runtime.lastError.message);
      }
    });
    
  } catch (error) {
    console.log('Error updating context menu for tab:', error.message);
  }
}

// Extension installation/startup handlers
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  initializeBetaSystem();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup');
  initializeBetaSystem();
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
            source: 'context_menu',
            potentiallyInvalid: true
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

    // Prevent script execution on restricted pages by whitelisting protocols
    if (!tab || !tab.id || !tab.url || !/^(https?|file):/.test(tab.url)) {
      console.log('Cannot execute highlight script on a restricted page:', tab ? tab.url : 'unknown');
      return;
    }

    // Inject content script to highlight the selection
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (keyword) => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        try {
          const range = selection.getRangeAt(0);
          const span = document.createElement('span');
          span.style.cssText = `
            background-color: #FFF9C4 !important;
            border: 2px solid #FFEB3B !important;
            border-radius: 3px !important;
            animation: pulse 0.5s !important;
          `;
          range.surroundContents(span);
          setTimeout(() => {
            if (span && span.parentNode) {
              const parent = span.parentNode;
              parent.insertBefore(document.createTextNode(span.textContent), span);
              parent.removeChild(span);
            }
          }, 2000);
        } catch (e) {
          console.log('Complex selection, unable to highlight.');
        }
      },
      args: [keywordText]
    }).catch(error => console.error('Failed to execute highlight script:', error));
  }
});

// Main message handler with beta checking
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
            response = { trialActive: isExtensionUnlocked };
          }
          break;
        case 'unlockExtension':
          if (betaManager) {
            response = await betaManager.unlockWithPassword(request.password);
            if (response.success) {
              isExtensionUnlocked = true;
              await initializeExtension(); // Initialize extension after unlock
            }
          } else {
            response = { success: false, error: 'Beta manager not initialized' };
          }
          break;
        default:
          console.log('Unknown action:', request.action);
          response = { success: false, error: 'Unknown action' };
      }
      sendResponse(response);
    } catch (error) {
      console.error(`Error handling action "${request.action}":`, error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // Keep the message channel open for async response
});

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
      keywords.push({ ...keywordObject, matchType: keywordObject.matchType || 'broad' });
      totalAdded++;
    } else {
      duplicates.push(keywordObject.text);
    }
  }
  
  if (totalAdded > 0) {
    await storage.set({ keywords });
    await updateBadge();
    chrome.runtime.sendMessage({ action: 'keywordsUpdated' }).catch(() => {});
  }
  
  return { success: true, totalAdded, duplicates };
}

async function removeKeyword(keywordToRemove) {
  console.log('Received removeKeyword request:', keywordToRemove);
  const keywordText = typeof keywordToRemove === 'string' ? keywordToRemove : keywordToRemove.text;
  const initialCount = keywords.length;
  keywords = keywords.filter(k => k.text !== keywordText);
  
  if (keywords.length < initialCount) {
    await storage.set({ keywords });
    await updateBadge();
    chrome.runtime.sendMessage({ action: 'keywordsUpdated' }).catch(() => {}); // Notify UI
    showNotification('Success', `Keyword removed. ${keywords.length} keywords remaining.`);
    return { success: true, count: keywords.length };
  }
  
  return { success: false, error: 'Keyword not found' };
}

async function clearKeywords() {
  console.log('Received clearKeywords request');
  keywords = [];
  await storage.set({ keywords: [] });
  await updateBadge();
  return { success: true };
}

function formatKeywordByMatchType(keyword, matchType) {
  switch (matchType) {
    case 'phrase': return `"${keyword}"`;
    case 'exact': return `[${keyword}]`;
    default: return keyword;
  }
}

async function exportKeywords(matchType) {
  try {
    // Get keywords
    const keywordsText = keywords.map(k => formatKeywordByMatchType(k.text, matchType || k.matchType)).join('\n');
    
    // Get stored ads data
    const { generatedHeadlines, generatedDescriptions, generatedCallToActions } = await chrome.storage.local.get([
      'generatedHeadlines', 'generatedDescriptions', 'generatedCallToActions'
    ]);
    
    // Build comprehensive export content
    let exportContent = '';
    
    // Add high-intent keywords section
    exportContent += 'HIGH-INTENT KEYWORDS\n';
    exportContent += '===================\n';
    exportContent += keywordsText;
    exportContent += '\n\n';
    
    // Add headlines section
    if (generatedHeadlines && generatedHeadlines.length > 0) {
      exportContent += 'AD HEADLINES\n';
      exportContent += '=============\n';
      exportContent += generatedHeadlines.join('\n');
      exportContent += '\n\n';
    }
    
    // Add descriptions section
    if (generatedDescriptions && generatedDescriptions.length > 0) {
      exportContent += 'AD DESCRIPTIONS\n';
      exportContent += '================\n';
      exportContent += generatedDescriptions.join('\n');
      exportContent += '\n\n';
    }
    
    // Add call-to-actions section
    if (generatedCallToActions && generatedCallToActions.length > 0) {
      exportContent += 'CALL-TO-ACTIONS (CTAs)\n';
      exportContent += '======================\n';
      exportContent += generatedCallToActions.join('\n');
      exportContent += '\n\n';
    }
    
    const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(exportContent);

    const downloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: dataUri,
        filename: `google-ads-export-${new Date().toISOString().split('T')[0]}.txt`,
        saveAs: true
      }, (id) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(id);
        }
      });
    });

    if (downloadId === undefined) {
      throw new Error('Download failed to start. The browser may have blocked it.');
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to export keywords:', error);
    throw new Error(`Unable to download file: ${error.message}`);
  }
}

function showNotification(title, message) {
  // Try with icon first, fallback to no icon if download fails
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon48.png"),
      title: title,
      message: message
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('Notification with icon failed:', chrome.runtime.lastError.message);
        // Fallback: create notification without icon
        chrome.notifications.create({
          type: "basic",
          title: title,
          message: message
        });
      }
    });
  } catch (error) {
    console.error('Notification creation failed:', error);
    // Final fallback: create notification without icon
    chrome.notifications.create({
      type: "basic",
      title: title,
      message: message
    });
  }
}
console.log('Background script loaded');

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

// Function to update badge
async function updateBadge() {
  const count = keywords.length;
  console.log('Updating badge count to:', count);
  await chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}

// Load saved keywords
async function loadSavedKeywords() {
  const result = await storage.get(['keywords']);
  if (result.keywords) {
    console.log('Loaded keywords from storage:', result.keywords);
    keywords = result.keywords;
    await updateBadge();
  }
}

// Setup context menu
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "addKeyword",
      title: "Add to Keyword Manager",
      contexts: ["selection"]
    });
  });
}

// Initialize extension
async function initialize() {
  console.log('Extension initializing...');
  setupContextMenu();
  await loadSavedKeywords();
}

chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "addKeyword" && info.selectionText) {
    const keywordText = info.selectionText.trim();
    console.log('Adding keyword from context menu:', keywordText);
    
    const keywordObject = {
      text: keywordText,
      timestamp: Date.now(),
      source: 'context_menu'
    };
    
    addKeyword(keywordObject);
    
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

// Main message handler using async/await for proper response handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
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

function exportKeywords(matchType) {
  return new Promise((resolve, reject) => {
    const text = keywords.map(k => formatKeywordByMatchType(k.text, matchType || k.matchType)).join('\n');
    const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);

    chrome.downloads.download({
      url: dataUri,
      filename: `keywords-${new Date().toISOString().split('T')[0]}.txt`,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to export keywords:', chrome.runtime.lastError);
        reject(new Error(`Unable to download file: ${chrome.runtime.lastError.message}`));
      } else if (downloadId === undefined) {
        // Fallback for when download fails without setting lastError
        reject(new Error('Download failed to start. The browser may have blocked it.'));
      } else {
        resolve({ success: true });
      }
    });
  });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: title,
    message: message
  });
}

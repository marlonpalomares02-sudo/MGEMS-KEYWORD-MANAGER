console.log('Content script loaded');
// Track Ctrl key state
let isCtrlPressed = false;

// Track processed keywords to avoid duplicates
const processedKeywords = new Set();

// Global extension context validation utility
const extensionUtils = {
  // Check if extension context is valid
  isValidContext: () => {
    try {
      // Check if chrome.runtime exists and has an id
      if (!chrome || !chrome.runtime) {
        return false;
      }
      // Try to access the runtime id - this will throw if context is invalid
      const id = chrome.runtime.id;
      return !!id;
    } catch (error) {
      // Any error accessing chrome.runtime indicates invalid context
      return false;
    }
  },
  
  // Safe wrapper for runtime.sendMessage with automatic fallback
  safeSendMessage: async (message, fallbackAction = null) => {
    if (!extensionUtils.isValidContext()) {
      console.log('Extension context invalid - using fallback');
      if (fallbackAction) {
        await fallbackAction();
      }
      // Return success response instead of throwing error
      return { success: true, fallbackUsed: true };
    }
    
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.log('Extension context invalidation error caught:', error.message);
      if (error.message.includes('Extension context invalidated') || 
          error.message.includes('message channel closed') ||
          error.message.includes('receiving end does not exist')) {
        if (fallbackAction) {
          await fallbackAction();
        }
        // Return a success response instead of throwing error
        return { success: true, fallbackUsed: true };
      }
      throw error;
    }
  },
  
  // Safe wrapper for storage operations
  safeStorageSet: async (items, fallbackAction = null) => {
    if (!extensionUtils.isValidContext()) {
      if (fallbackAction) {
        await fallbackAction();
      }
      return false;
    }
    
    try {
      await chrome.storage.local.set(items);
      return true;
    } catch (error) {
      if (error.message.includes('Extension context invalidated') && fallbackAction) {
        await fallbackAction();
      }
      return false;
    }
  }
};

// Listen for Ctrl key press/release
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    console.log('Ctrl key pressed');
    isCtrlPressed = true;
    document.body.classList.add('ctrl-pressed');
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'Control') {
    console.log('Ctrl key released');
    isCtrlPressed = false;
    document.body.classList.remove('ctrl-pressed');
  }
});

// Reset Ctrl state when window loses focus
window.addEventListener('blur', () => {
  isCtrlPressed = false;
  document.body.classList.remove('ctrl-pressed');
});

// Auto-highlight and save selected keywords
// Enhanced to filter out non-keyword text in Google Keyword Planner
document.addEventListener('mouseup', (event) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length > 2 && (isGoogleAdsPage() || isKeywordPlannerPage())) {
    // Enhanced validation for Google Keyword Planner context
    if (isKeywordPlannerPage()) {
      // Filter out common column headers and non-keyword text
      const invalidPatterns = [
        /^(Keywords?|Keyword text|Search terms?|Volume|Competition|Avg\.?\s*CPC|Top\s*of\s*page\s*bid|Account|Campaign|Ad\s*group)$/i,
        /^(Select\s+all|Select\s+keyword|Actions|Download|Edit|Remove)$/i,
        /^\s*\d+\s*$/, // Pure numbers
        /^\$\d+/, // Currency amounts
        /^\d+\.?\d*%$/, // Percentages
        /^\d+\.?\d*[KMkm]$/, // Numbers with K/M suffixes
        /^[\s\-\–—]+$/, // Just dashes or spaces
      ];
      
      // Check if the selection is within a table header or contains only invalid patterns
      const isValidKeyword = !invalidPatterns.some(pattern => pattern.test(selectedText));
      
      // Additional check: see if the selection is within a table cell that contains keywords
      const selectionContainer = selection.getRangeAt(0).commonAncestorContainer;
      const tableCell = selectionContainer.nodeType === Node.TEXT_NODE 
        ? selectionContainer.parentElement.closest('td, th')
        : selectionContainer.closest('td, th');
      
      if (tableCell) {
        const isHeaderCell = tableCell.tagName === 'TH' || 
                             tableCell.closest('thead') !== null ||
                             tableCell.textContent.trim().match(/^(Keywords?|Volume|Competition|Avg\.?\s*CPC)$/i);
        
        if (isHeaderCell || !isValidKeyword) {
          console.log('Filtered out non-keyword selection:', selectedText);
          return; // Don't process this selection
        }
      }
      
      if (!isValidKeyword) {
        console.log('Filtered out invalid keyword pattern:', selectedText);
        return; // Don't process this selection
      }
    }
    
    addKeyword(selectedText, event.target);
  }
});

// Handle checkbox clicks in Keyword Planner
document.addEventListener('click', (event) => {
  console.log('Click event detected:', event.target, 'Type:', event.target.type, 'Role:', event.target.getAttribute('role'));
  
  // Enhanced checkbox detection for Google Keyword Planner
  const isCheckbox = event.target.type === 'checkbox' || 
                    event.target.getAttribute('role') === 'checkbox' ||
                    event.target.closest('[role="checkbox"]') !== null;
  
  if (isCheckbox) {
    console.log('Checkbox clicked, checking if on Keyword Planner page...');
    
    if (isKeywordPlannerPage()) {
      console.log('On Keyword Planner page, processing checkbox click...');
      
      // Find the row - try multiple approaches
      let row = event.target.closest('tr');
      if (!row) {
        row = event.target.closest('[role="row"]');
      }
      if (!row) {
        // Look for parent container that might contain keyword data
        row = event.target.closest('div[data-keyword], div[data-text], .keyword-row');
      }
      
      if (row) {
        console.log('Found row:', row);
        
        // Enhanced keyword detection for current Google Keyword Planner
        let keywordCell = null;
        let keyword = '';
        
        // Method 1: Try standard table cells
        const cells = row.querySelectorAll('td');
        console.log('Found cells:', cells.length);
        
        if (cells.length > 0) {
          // Try second column first (most common for keywords)
          keywordCell = cells[1] || cells[0];
          
          // Search through all cells to find the best keyword candidate
          for (let i = 0; i < cells.length; i++) {
            const cellText = cells[i].textContent.trim();
            console.log(`Cell ${i + 1} text:`, cellText);
            
            // Skip cells with numbers, percentages, currency, or very short text
            if (cellText && 
                !cellText.match(/^[0-9,.-]+$/) && // Not just numbers
                !cellText.includes('%') && 
                !cellText.includes('$') && 
                !cellText.includes('₹') && 
                !cellText.includes('€') &&
                !cellText.includes('£') &&
                !cellText.match(/^(Low|Medium|High)$/i) && // Not competition level
                cellText.length > 2) {
              keywordCell = cells[i];
              keyword = cellText;
              console.log('Selected keyword cell:', keyword);
              break;
            }
          }
        }
        
        // Method 2: Try data attributes or specific selectors
        if (!keyword) {
          const keywordElement = row.querySelector('[data-keyword], [data-text], .keyword-text, .keyword-cell');
          if (keywordElement) {
            keyword = keywordElement.textContent.trim() || keywordElement.getAttribute('data-keyword') || keywordElement.getAttribute('data-text');
            keywordCell = keywordElement;
            console.log('Found keyword via data attributes:', keyword);
          }
        }
        
        // Method 3: Look for any text that looks like a keyword
        if (!keyword) {
          const allText = row.textContent.trim();
          const words = allText.split(/\s+/);
          // Find the longest meaningful text that's not a number or metric
          for (const word of words) {
            if (word.length > 2 && !word.match(/^[0-9,.-]+$/) && !word.includes('%') && !word.includes('$')) {
              keyword = word;
              console.log('Found keyword via text analysis:', keyword);
              break;
            }
          }
        }
        
        
        if (keyword && keywordCell) {
          console.log('Checkbox clicked for keyword:', keyword, 'Checked:', event.target.checked || event.target.getAttribute('aria-checked') === 'true');
          
          const isChecked = event.target.checked || 
                           event.target.getAttribute('aria-checked') === 'true' ||
                           event.target.classList.contains('checked');
          
          if (isChecked) {
            // Use the new selection manager for individual selections
            keywordSelectionManager.addKeyword(keyword, keywordCell || row);
            addKeyword(keyword, keywordCell || row);
          } else {
            // Remove from selection manager
            keywordSelectionManager.removeKeyword(keyword, keywordCell || row);
            // Use safe message sending to handle extension context invalidation
            extensionUtils.safeSendMessage({ action: 'removeKeyword', keyword: keyword }, () => {
              console.log('Extension context invalidated, keyword removal failed');
            });
          }
        } else {
          console.log('Could not find keyword in row:', row);
          console.log('All text in row:', row.textContent.trim());
          console.log('All cells in row:', Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim()));
          
          // Fallback: try to extract any meaningful text
          const fallbackText = row.textContent.trim().split(/\s+/)[0];
          if (fallbackText && fallbackText.length > 2) {
            console.log('Using fallback keyword:', fallbackText);
            const isChecked = event.target.checked || 
                             event.target.getAttribute('aria-checked') === 'true' ||
                             event.target.classList.contains('checked');
            if (isChecked) {
              keywordSelectionManager.addKeyword(fallbackText, row);
              addKeyword(fallbackText, row);
            }
          }
        }
      } else {
        console.log('Could not find parent row for checkbox');
        console.log('Event target:', event.target);
        console.log('Parent elements:', event.target.parentElement);
      }
    } else {
      console.log('Not on Keyword Planner page');
    }
  }
});

// Handle double-click for quick keyword selection
document.addEventListener('dblclick', (event) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length > 2 && (isGoogleAdsPage() || isKeywordPlannerPage())) {
    // Apply same filtering logic as mouseup for consistency
    if (isKeywordPlannerPage()) {
      const invalidPatterns = [
        /^(Keywords?|Keyword text|Search terms?|Volume|Competition|Avg\.?\s*CPC|Top\s*of\s*page\s*bid|Account|Campaign|Ad\s*group)$/i,
        /^(Select\s+all|Select\s+keyword|Actions|Download|Edit|Remove)$/i,
        /^\s*\d+\s*$/, // Pure numbers
        /^\$\d+/, // Currency amounts
        /^\d+\.?\d*%$/, // Percentages
        /^\d+\.?\d*[KMkm]$/, // Numbers with K/M suffixes
        /^[\s\-\–—]+$/, // Just dashes or spaces
      ];
      
      const isValidKeyword = !invalidPatterns.some(pattern => pattern.test(selectedText));
      
      if (!isValidKeyword) {
        console.log('Filtered out invalid keyword pattern on double-click:', selectedText);
        return;
      }
    }
    
    addKeyword(selectedText, event.target);
  }
});

// Check if we're on Google Ads
function isGoogleAdsPage() {
  return window.location.hostname.includes('ads.google.com') ||
         document.querySelector('[data-test-id], .ads-container, .campaign-row') !== null;
}

// Check if we're on Keyword Planner
function isKeywordPlannerPage() {
  const isCorrectURL = window.location.hostname.includes('keywordplanner.google.com') ||
         (window.location.hostname.includes('ads.google.com') && window.location.pathname.includes('keywordplanner'));
  
  const hasKeywordElements = document.querySelector('.keyword-cell, .keyword-row, .keyword-text, [data-keyword]') !== null;
  
  // Enhanced detection for current Google Keyword Planner interface
  const hasKeywordTable = document.querySelector('table') !== null && 
                         (document.querySelector('input[type="checkbox"]') !== null ||
                          document.querySelector('[role="checkbox"]') !== null);
  
  console.log('Page detection:', {
    url: window.location.href,
    isCorrectURL,
    hasKeywordElements,
    hasKeywordTable,
    checkboxes: document.querySelectorAll('input[type="checkbox"]').length
  });
  
  return isCorrectURL || hasKeywordElements || hasKeywordTable;
}

function addKeyword(keyword, targetElement) {
  const keywordObject = {
    text: keyword,
    timestamp: Date.now(),
    source: 'google_ads'
  };

  // Use safe message sending to handle extension context invalidation
  extensionUtils.safeSendMessage({ action: 'addKeyword', keyword: keywordObject }, () => {
    // Fallback: save to localStorage if extension context is invalid
    saveKeywordToLocalStorage(keywordObject);
    showQuickNotification(`Added: ${keyword} (saved locally)`, targetElement);
  }).then((response) => {
    if (response && response.success) {
      highlightElement(targetElement, keyword);
      showQuickNotification(`Added: ${keyword}`, targetElement);
      // Send keywordsUpdated message safely
      extensionUtils.safeSendMessage({ action: 'keywordsUpdated' });
    } else if (response && response.error === 'Keyword already exists') {
      showQuickNotification('Keyword already exists', targetElement, true);
    } else {
      showQuickNotification('Failed to save keyword', targetElement, true);
    }
  }).catch(() => {
    // Fallback: save to localStorage if extension context is invalid
    saveKeywordToLocalStorage(keywordObject);
    showQuickNotification(`Added: ${keyword} (saved locally)`, targetElement);
  });
}

// Highlight the selected element
function highlightElement(element, keyword) {
  // Find the best element to highlight
  const targetElement = findBestHighlightTarget(element);
  
  // Apply highlight class
  targetElement.classList.add('keyword-highlight');
  
  // Create a temporary highlight overlay for visual feedback
  const overlay = document.createElement('div');
  overlay.className = 'keyword-overlay';
  overlay.style.cssText = `
    position: absolute;
    background: rgba(255, 235, 59, 0.3);
    border: 2px solid #FFEB3B;
    border-radius: 4px;
    pointer-events: none;
    z-index: 9999;
    transition: opacity 0.3s ease;
  `;
  
  // Position the overlay
  const rect = targetElement.getBoundingClientRect();
  overlay.style.left = (rect.left + window.scrollX) + 'px';
  overlay.style.top = (rect.top + window.scrollY) + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
  
  document.body.appendChild(overlay);
  
  // Remove highlights after animation
  setTimeout(() => {
    targetElement.classList.remove('keyword-highlight');
    if (overlay.parentNode) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }
  }, 2000);
}

// Find the best element to highlight
function findBestHighlightTarget(element) {
  // Look for keyword-specific containers
  let target = element.closest('.keyword-cell, [data-keyword], .keyword-row, .keyword-text');
  
  if (!target) {
    // Look for table cells or list items
    target = element.closest('td, li, .cell, .item');
  }
  
  if (!target) {
    // Look for divs with text content
    target = element.closest('div[class*="keyword"], div[class*="text"], span[class*="keyword"]');
  }
  
  // Fallback to the original element
  return target || element;
}

// Add multiple keywords at once with enhanced functionality
async function addMultipleKeywords(keywordsData) {
  try {
    // Extract keyword objects from the data
    const keywordObjects = keywordsData.map(data => ({
      text: data.text,
      timestamp: Date.now(),
      source: 'bulk_selection',
      isNew: true,
      keywordData: data.keywordData || null
    }));

    // Send bulk keywords to background script
    const response = await extensionUtils.safeSendMessage({
      action: 'addKeywordsBulk',
      keywords: keywordObjects
    });

    if (response && response.success) {
      console.log(`Added ${response.totalAdded} keywords from bulk selection`);
      
      // Highlight all added keywords
      keywordsData.forEach(data => {
        if (data.keywordCell) {
          highlightElement(data.keywordCell, data.text);
        }
      });
      
      // Notify all extension components about the update
      extensionUtils.safeSendMessage({ action: 'keywordsUpdated' });
      
      return response;
    } else {
      console.error('Failed to add keywords:', response);
      return { success: false, error: 'Failed to add keywords' };
    }
  } catch (error) {
    console.error('Bulk keyword addition error:', error);
    return { success: false, error: error.message };
  }
}

// Enhanced multiple keyword selection system
class KeywordSelectionManager {
  constructor() {
    this.selectedKeywords = new Set();
    this.isBulkSelection = false;
    this.selectionStartTime = null;
    this.lastSelectionTime = null;
  }

  // Add keyword to selection
  addKeyword(keyword, element) {
    if (this.isValidKeyword(keyword)) {
      this.selectedKeywords.add(keyword);
      this.highlightSelectedElement(element, true);
      this.showSelectionFeedback(`+1 keyword selected (${this.selectedKeywords.size} total)`);
    }
  }

  // Remove keyword from selection
  removeKeyword(keyword, element) {
    this.selectedKeywords.delete(keyword);
    this.highlightSelectedElement(element, false);
    this.showSelectionFeedback(`-1 keyword removed (${this.selectedKeywords.size} remaining)`);
  }

  // Check if keyword is valid
  isValidKeyword(keyword) {
    const invalidPatterns = [
      /^(Keywords?|Keyword text|Search terms?|Volume|Competition|Avg\.?\s*CPC|Top\s*of\s*page\s*bid|Account|Campaign|Ad\s*group)$/i,
      /^(Select\s+all|Select\s+keyword|Actions|Download|Edit|Remove)$/i,
      /^\s*\d+\s*$/, // Pure numbers
      /^\$\d+/, // Currency amounts
      /^\d+\.?\d*%$/, // Percentages
      /^\d+\.?\d*[KMkm]$/, // Numbers with K/M suffixes
      /^[\s\-\–—]+$/, // Just dashes or spaces
    ];
    
    return keyword && keyword.length > 2 && !invalidPatterns.some(pattern => pattern.test(keyword));
  }

  // Highlight selected elements
  highlightSelectedElement(element, isSelected) {
    const targetElement = this.findBestHighlightTarget(element);
    if (isSelected) {
      targetElement.classList.add('keyword-selected');
      targetElement.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
      targetElement.style.borderLeft = '3px solid #4CAF50';
    } else {
      targetElement.classList.remove('keyword-selected');
      targetElement.style.backgroundColor = '';
      targetElement.style.borderLeft = '';
    }
  }

  // Find best element to highlight
  findBestHighlightTarget(element) {
    let target = element.closest('.keyword-cell, [data-keyword], .keyword-row, .keyword-text, td, tr');
    if (!target) {
      target = element.closest('td, li, .cell, .item');
    }
    return target || element;
  }

  // Show selection feedback
  showSelectionFeedback(message) {
    this.showQuickNotification(message, null, false, 1500);
  }

  // Show quick notification
  showQuickNotification(message, targetElement, isError = false, duration = 2000) {
    const notification = document.createElement('div');
    notification.className = 'quick-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isError ? '#f44336' : '#4CAF50'};
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  // Process bulk selection
  async processBulkSelection() {
    if (this.selectedKeywords.size === 0) return;

    const keywordsArray = Array.from(this.selectedKeywords).map(keyword => ({
      text: keyword,
      timestamp: Date.now(),
      source: 'bulk_selection',
      isNew: true
    }));

    try {
      // Send bulk keywords to background script
      const response = await extensionUtils.safeSendMessage({
        action: 'addKeywordsBulk',
        keywords: keywordsArray
      });

      if (response && response.success) {
        this.showQuickNotification(`✅ Added ${response.totalAdded} keywords successfully!`, null, false, 3000);
        
        // Clear selection after successful addition
        this.clearSelection();
        
        // Notify all extension components about the update
        extensionUtils.safeSendMessage({ action: 'keywordsUpdated' });
      } else {
        this.showQuickNotification('❌ Failed to add keywords', null, true);
      }
    } catch (error) {
      console.error('Bulk selection error:', error);
      this.showQuickNotification('❌ Error adding keywords', null, true);
    }
  }

  // Clear current selection
  clearSelection() {
    // Remove visual highlights
    document.querySelectorAll('.keyword-selected').forEach(element => {
      element.classList.remove('keyword-selected');
      element.style.backgroundColor = '';
      element.style.borderLeft = '';
    });
    
    this.selectedKeywords.clear();
    this.isBulkSelection = false;
  }

  // Get current selection count
  getSelectionCount() {
    return this.selectedKeywords.size;
  }
}

// Initialize keyword selection manager
const keywordSelectionManager = new KeywordSelectionManager();

// Handle select all checkboxes in Keyword Planner
async function handleSelectAllCheckboxes(isChecked) {
  try {
    const keywordRows = document.querySelectorAll('tr.keyword-row, tr[data-keyword], .keyword-table tbody tr, tbody tr');
    
    if (isChecked) {
      // Select all - capture all keywords
      const keywordsToAdd = [];
      
      for (const row of keywordRows) {
        const keywordCell = row.querySelector('td:first-child, .keyword-cell, [data-keyword]');
        const checkbox = row.querySelector('input[type="checkbox"]');
        
        if (keywordCell && checkbox && !checkbox.checked) {
          const keywordText = keywordCell.textContent.trim();
          if (keywordText) {
            const bidLow = row.querySelector('td:nth-child(8)')?.textContent.trim();
            const bidHigh = row.querySelector('td:nth-child(9)')?.textContent.trim();
            
            const keywordData = {
              keyword: keywordText,
              searchVolume: searchVolume || 'N/A',
              competition: competition || 'N/A',
              bidLow: bidLow || 'N/A',
              bidHigh: bidHigh || 'N/A'
            };
            
            keywordsToAdd.push({
              text: keywordText,
              keywordData: keywordData,
              row: row,
              keywordCell: keywordCell // Pass keywordCell for highlighting
            });
            
            // Check the checkbox and mark as selected
            checkbox.checked = true;
            if (keywordCell) {
              keywordCell.classList.add('keyword-highlight');
            }
          }
        }
      }
      
      // Add all keywords in bulk
      if (keywordsToAdd.length > 0) {
        await addMultipleKeywords(keywordsToAdd);
        
        // Use keyword selection manager for enhanced feedback
        keywordSelectionManager.showQuickNotification(
          `✅ Added ${keywordsToAdd.length} keywords successfully!`, 
          null, 
          false, 
          3000
        );
      }
      
    } else {
      // Deselect all - remove all keywords
      for (const row of keywordRows) {
        const keywordCell = row.querySelector('td:first-child, .keyword-cell, [data-keyword]');
        const checkbox = row.querySelector('input[type="checkbox"]');
        
        if (keywordCell && checkbox && checkbox.checked) {
          const keywordText = keywordCell.textContent.trim();
          if (keywordText) {
            // Remove from extension storage using safe message sending
            extensionUtils.safeSendMessage({
              action: 'removeKeyword',
              keyword: keywordText
            }, () => {
              console.log('Extension context invalidated, keyword removal failed');
            });
            
            // Uncheck and remove selection
            checkbox.checked = false;
            if (keywordCell) {
              keywordCell.classList.remove('keyword-highlight');
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error handling select all:', error);
  }
}

// Add multiple keywords at once with enhanced error handling
async function addMultipleKeywords(keywordsToAdd) {
  console.log('addMultipleKeywords called with', keywordsToAdd.length, 'keywords');
  try {
    // Check if extension context is still valid - if not, handle gracefully
    if (!extensionUtils.isValidContext()) {
      showQuickNotification('Extension disconnected. Please refresh the page.', document.body, true);
      // Save all keywords to localStorage as fallback
      keywordsToAdd.forEach(({text, keywordData}) => {
        const keywordObject = {
          text: text,
          timestamp: Date.now(),
          source: 'keyword_planner',
          ...keywordData
        };
        saveKeywordToLocalStorage(keywordObject);
      });
      showQuickNotification(`${keywordsToAdd.length} keywords saved locally due to extension disconnect`, document.body, false);
      return;
    }
    
    // Prepare keywords for bulk addition
    const keywordsForBulk = [];
    const elementsToHighlight = []; // Changed from rowsToHighlight
    
    for (const {text, keywordData, row, keywordCell} of keywordsToAdd) { // Added keywordCell
      const keywordObject = {
        text: text,
        timestamp: Date.now(),
        source: 'keyword_planner',
        ...keywordData
      };
      keywordsForBulk.push(keywordObject);
      if (keywordCell) { // Highlight the keywordCell
        elementsToHighlight.push(keywordCell);
      } else {
        elementsToHighlight.push(row); // Fallback to row if keywordCell not found
      }
    }
    
    // Send bulk add request using safe messaging
    console.log(`Sending bulk add request for ${keywordsForBulk.length} keywords`);
    
    const fallbackAction = () => {
      keywordsForBulk.forEach(keywordObj => saveKeywordToLocalStorage(keywordObj));
    };
    
    const response = await extensionUtils.safeSendMessage({
      action: 'addKeywordsBulk',
      keywords: keywordsForBulk
    }, fallbackAction);
    
    if (response && response.success) {
      // Highlight all elements that were successfully added
      elementsToHighlight.forEach(el => {
        el.classList.add('keyword-highlight');
      });
      
      if (response.totalAdded > 0) {
        showQuickNotification(`Added ${response.totalAdded} keywords`, document.body);
        
        // Show duplicate notification if any
        if (response.duplicates && response.duplicates.length > 0) {
          setTimeout(() => {
            showQuickNotification(`${response.duplicates.length} duplicates skipped`, document.body, false);
          }, 1000);
        }
      } else if (response.duplicates && response.duplicates.length > 0) {
        showQuickNotification(`All ${response.duplicates.length} keywords were already added`, document.body, false);
      }
      
    } else if (response && response.error && response.error.includes('Extension context invalidated')) {
      showQuickNotification('Extension disconnected. Please refresh the page.', document.body, true);
      return;
    }
    
  } catch (error) {
    if (error.message.includes('Extension context invalidated')) {
      console.error('Extension context invalidated during bulk keyword addition');
      showQuickNotification('Extension disconnected during bulk operation', document.body, true);
    } else {
      console.error('Error adding multiple keywords:', error);
      showQuickNotification('Failed to add keywords', document.body, true);
    }
  }
}

// Show a quick notification
function showQuickNotification(message, targetElement, isError = false) {
  const notification = document.createElement('div');
  notification.className = 'keyword-notification';
  
  // Split message into keyword and details
  const lines = message.split('\n');
  const keywordLine = lines[0];
  const details = lines.slice(1).join(' ');
  
  // Create keyword element
  const keywordElement = document.createElement('span');
  keywordElement.className = 'keyword';
  keywordElement.textContent = keywordLine;
  notification.appendChild(keywordElement);
  
  // Add details if present
  if (details) {
    const detailsElement = document.createElement('span');
    detailsElement.className = 'details';
    detailsElement.textContent = details;
    notification.appendChild(detailsElement);
  }
  
  // Position near the target element
  const rect = targetElement.getBoundingClientRect();
  notification.style.cssText = `
    position: fixed;
    top: ${rect.bottom + window.scrollY + 10}px;
    left: ${rect.left + window.scrollX}px;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.3s ease;
    background: ${isError ? '#dc3545' : 'rgba(66, 133, 244, 0.95)'};
  `;
  
  document.body.appendChild(notification);
  
  // Fade in
  setTimeout(() => notification.style.opacity = '1', 0);
  
  // Remove after delay
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'highlightKeyword') {
    const elements = document.querySelectorAll(`[data-keyword="${message.keyword}"]`);
    elements.forEach(el => highlightElement(el, message.keyword));
    // No async response needed for this action
    return false;
  }
  // Only return true if we need to send an async response
  return false;
});

// Watch for manual checkbox selections and capture multiple keywords
function setupCheckboxObserver() {
  let processingCheckboxes = false;
  let lastProcessedTime = 0;
  
  const observer = new MutationObserver(async (mutations) => {
    // Debounce to avoid multiple rapid triggers
    const now = Date.now();
    if (processingCheckboxes || now - lastProcessedTime < 300) return;
    processingCheckboxes = true;
    lastProcessedTime = now;
    
    try {
      // Instead of looking at individual mutations, capture ALL checked checkboxes
      const allCheckedKeywords = [];
      const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
      
      for (const checkbox of checkboxes) {
        if (!checkbox.matches('[aria-label*="Select all"], [title*="Select all"], .select-all-checkbox')) {
          const row = checkbox.closest('tr, .keyword-row');
          if (row) {
            const keywordCell = row.querySelector('td:first-child, .keyword-cell');
            const keywordText = keywordCell?.textContent.trim();
            
            if (keywordText) {
              const searchVolume = row.querySelector('td:nth-child(2)')?.textContent.trim();
              const competition = row.querySelector('td:nth-child(5)')?.textContent.trim();
              const bidLow = row.querySelector('td:nth-child(8)')?.textContent.trim();
              const bidHigh = row.querySelector('td:nth-child(9)')?.textContent.trim();
              
              // Check if this keyword has already been processed to avoid duplicates
              if (!processedKeywords.has(keywordText)) {
                allCheckedKeywords.push({
                  text: keywordText,
                  keywordData: {
                    keyword: keywordText,
                    searchVolume: searchVolume || 'N/A',
                    competition: competition || 'N/A',
                    bidLow: bidLow || 'N/A',
                    bidHigh: bidHigh || 'N/A'
                  },
                  row: row,
                  keywordCell: keywordCell // Pass keywordCell for highlighting
                });
                processedKeywords.add(keywordText);
              }
            }
          }
        }
      }
      
      // Process all checked keywords in bulk
      if (allCheckedKeywords.length > 0) {
        console.log(`Processing ${allCheckedKeywords.length} keywords:`, allCheckedKeywords.map(k => k.text));
        await addMultipleKeywords(allCheckedKeywords);
      } else {
        console.log('No new keywords to process');
      }
      
    } catch (error) {
      console.error('Error processing checkbox changes:', error);
    } finally {
      processingCheckboxes = false;
    }
  });
  
  // Start observing checkboxes
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    observer.observe(checkbox, { attributes: true });
  });
}

// Function to capture all currently checked keywords
async function captureAllCheckedKeywords() {
  try {
    const checkedKeywords = [];
    const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    
    for (const checkbox of checkboxes) {
      if (!checkbox.matches('[aria-label*="Select all"], [title*="Select all"], .select-all-checkbox')) {
        const row = checkbox.closest('tr, .keyword-row');
        if (row) {
          const keywordCell = row.querySelector('td:first-child, .keyword-cell');
          const keywordText = keywordCell?.textContent.trim();
          
          if (keywordText) {
            const searchVolume = row.querySelector('td:nth-child(2)')?.textContent.trim();
            const competition = row.querySelector('td:nth-child(5)')?.textContent.trim();
            const bidLow = row.querySelector('td:nth-child(8)')?.textContent.trim();
            const bidHigh = row.querySelector('td:nth-child(9)')?.textContent.trim();
            
            // Check if this keyword has already been processed to avoid duplicates
            if (!processedKeywords.has(keywordText)) {
              checkedKeywords.push({
                text: keywordText,
                keywordData: {
                  keyword: keywordText,
                  searchVolume: searchVolume || 'N/A',
                  competition: competition || 'N/A',
                  bidLow: bidLow || 'N/A',
                  bidHigh: bidHigh || 'N/A'
                },
                row: row,
                keywordCell: keywordCell // Pass keywordCell for highlighting
              });
              processedKeywords.add(keywordText);
            }
          }
        }
      }
    }
    
    if (checkedKeywords.length > 0) {
      await addMultipleKeywords(checkedKeywords);
    }
    
  } catch (error) {
    console.error('Error capturing checked keywords:', error);
  }
}

// Initialize checkbox observer when page loads
if (isKeywordPlannerPage()) {
  setTimeout(() => {
    setupCheckboxObserver();
    // Also capture any already checked keywords when page loads
    captureAllCheckedKeywords();
    
    // Set up periodic checks to ensure all checked keywords are captured
    setInterval(() => {
      if (!document.hidden) {
        captureAllCheckedKeywords();
        // Also sync localStorage keywords if extension context is available
        syncLocalStorageKeywords();
      }
    }, 5000); // Check every 5 seconds
    
    // Sync on initial load as well
    syncLocalStorageKeywords();
    
  }, 2000); // Wait for page to fully load
}

// Save keyword to localStorage as fallback when extension context is invalid
function saveKeywordToLocalStorage(keywordObject) {
  try {
    const savedKeywords = JSON.parse(localStorage.getItem('googleAdsKeywords') || '[]');
    // Check for duplicates
    const isDuplicate = savedKeywords.some(k => k.text === keywordObject.text);
    if (!isDuplicate) {
      savedKeywords.push(keywordObject);
      localStorage.setItem('googleAdsKeywords', JSON.stringify(savedKeywords));
      console.log('Keyword saved to localStorage fallback:', keywordObject.text);
      
      // Try to sync immediately if extension context is available
      setTimeout(() => {
        if (extensionUtils.isValidContext()) {
          syncLocalStorageKeywords();
        }
      }, 1000);
    }
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

// Sync localStorage keywords back to extension when context is restored
function syncLocalStorageKeywords() {
  try {
    const savedKeywords = JSON.parse(localStorage.getItem('googleAdsKeywords') || '[]');
    if (savedKeywords.length > 0 && chrome.runtime?.id) {
      console.log('Syncing', savedKeywords.length, 'keywords from localStorage to extension');
      
      // Use safe message sending for bulk keyword sync
      extensionUtils.safeSendMessage({
        action: 'addKeywordsBulk',
        keywords: savedKeywords
      }, () => {
        console.log('Extension context invalidated, keeping keywords in localStorage');
      }).then((response) => {
        if (response && response.success) {
          // Clear localStorage after successful sync
          localStorage.removeItem('googleAdsKeywords');
          console.log('LocalStorage keywords synced successfully');
          
          // Force update the popup UI by sending keywordsUpdated message
          extensionUtils.safeSendMessage({ action: 'keywordsUpdated' });
        }
      }).catch(error => {
        console.error('Failed to sync localStorage keywords:', error);
      });
    }
  } catch (error) {
    console.error('Error syncing localStorage keywords:', error);
  }
}

// Clean up any lingering highlights on page unload
window.addEventListener('beforeunload', () => {
  document.querySelectorAll('.keyword-highlight, .keyword-overlay, .keyword-notification, .selected').forEach(el => {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });
  
  // Clear processed keywords on page unload
  processedKeywords.clear();
});

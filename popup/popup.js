console.log('Popup script loaded');

// Global error handler for the popup
window.addEventListener('error', (event) => {
  console.error('Unhandled error in popup:', event.error);
  // Optionally, you could display a user-friendly error message here
});

// Update keyword counter with animation
function updateKeywordCounter(count) {
  const counterElement = document.getElementById('keyword-count');
  const counterContainer = document.querySelector('.keyword-counter');
  
  if (counterElement) {
    // Add animation class
    counterContainer.classList.add('updated');
    
    // Update the count with a subtle animation
    counterElement.textContent = count;
    
    // Remove animation class after animation completes
    setTimeout(() => {
      counterContainer.classList.remove('updated');
    }, 500);
    
    // Add a subtle pulse effect for new keywords
    if (count > 0) {
      counterContainer.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
      setTimeout(() => {
        counterContainer.style.background = 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))';
      }, 1000);
    }
  }
}

// Show quick notification in popup
function showQuickNotification(message, isError = false, duration = 2000) {
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

// Keyword intent classification functions
function getIntentIcon(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  
  // Transactional intent indicators
  if (lowerKeyword.includes('buy') || lowerKeyword.includes('purchase') || lowerKeyword.includes('order')) {
    return '💰';
  }
  if (lowerKeyword.includes('hire') || lowerKeyword.includes('book') || lowerKeyword.includes('schedule')) {
    return '📅';
  }
  if (lowerKeyword.includes('price') || lowerKeyword.includes('cost') || lowerKeyword.includes('quote')) {
    return '💵';
  }
  if (lowerKeyword.includes('near me') || lowerKeyword.includes('local') || lowerKeyword.includes('nearby')) {
    return '📍';
  }
  if (lowerKeyword.includes('urgent') || lowerKeyword.includes('emergency') || lowerKeyword.includes('same day')) {
    return '⚡';
  }
  if (lowerKeyword.includes('best') || lowerKeyword.includes('top') || lowerKeyword.includes('review')) {
    return '⭐';
  }
  if (lowerKeyword.includes('professional') || lowerKeyword.includes('certified') || lowerKeyword.includes('licensed')) {
    return '✅';
  }
  if (lowerKeyword.includes('comparison') || lowerKeyword.includes('vs') || lowerKeyword.includes('compare')) {
    return '⚖️';
  }
  
  return '🎯'; // Default high-intent indicator
}

function getIntentDescription(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  
  if (lowerKeyword.includes('buy') || lowerKeyword.includes('purchase')) {
    return 'Purchase intent - ready to buy';
  }
  if (lowerKeyword.includes('hire') || lowerKeyword.includes('book')) {
    return 'Service booking intent';
  }
  if (lowerKeyword.includes('price') || lowerKeyword.includes('cost')) {
    return 'Price comparison intent';
  }
  if (lowerKeyword.includes('near me') || lowerKeyword.includes('local')) {
    return 'Local service intent';
  }
  if (lowerKeyword.includes('urgent') || lowerKeyword.includes('emergency')) {
    return 'Urgent need - high conversion potential';
  }
  if (lowerKeyword.includes('best') || lowerKeyword.includes('top')) {
    return 'Quality-focused intent';
  }
  if (lowerKeyword.includes('professional') || lowerKeyword.includes('certified')) {
    return 'Professional service intent';
  }
  if (lowerKeyword.includes('comparison') || lowerKeyword.includes('vs')) {
    return 'Comparison shopping intent';
  }
  
  return 'High commercial intent';
}

function getIntentScore(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  let score = 5; // Base score for being AI-suggested
  
  // High-value transactional modifiers
  if (lowerKeyword.includes('buy') || lowerKeyword.includes('purchase') || lowerKeyword.includes('order')) score += 3;
  if (lowerKeyword.includes('hire') || lowerKeyword.includes('book')) score += 3;
  if (lowerKeyword.includes('price') || lowerKeyword.includes('cost') || lowerKeyword.includes('quote')) score += 2;
  if (lowerKeyword.includes('near me') || lowerKeyword.includes('local')) score += 2;
  if (lowerKeyword.includes('urgent') || lowerKeyword.includes('emergency') || lowerKeyword.includes('same day')) score += 3;
  if (lowerKeyword.includes('best') || lowerKeyword.includes('top')) score += 1;
  if (lowerKeyword.includes('professional') || lowerKeyword.includes('certified') || lowerKeyword.includes('licensed')) score += 2;
  if (lowerKeyword.includes('comparison') || lowerKeyword.includes('vs')) score += 1;
  
  // Long-tail bonus (3-5 words typically convert better)
  const wordCount = keyword.split(' ').length;
  if (wordCount >= 3 && wordCount <= 5) score += 1;
  if (wordCount > 5) score += 2; // Very specific, high intent
  
  return Math.min(score, 10); // Cap at 10
}

function filterHighIntentKeywords(keywords) {
  return keywords.filter(keyword => {
    const score = getIntentScore(keyword);
    return score >= 7; // Only show high-intent keywords (7+ out of 10)
  });
}

function sortKeywordsByIntent(keywords) {
  return keywords.sort((a, b) => {
    const scoreA = getIntentScore(a);
    const scoreB = getIntentScore(b);
    return scoreB - scoreA; // Highest intent first
  });
}

function createIntentScoreElement(score) {
  const scoreElement = document.createElement('div');
  scoreElement.className = 'intent-score';
  
  // Determine background color based on score
  let backgroundColor;
  if (score >= 8) {
    backgroundColor = 'linear-gradient(135deg, #4CAF50, #45a049)'; // Green for high intent
  } else if (score >= 6) {
    backgroundColor = 'linear-gradient(135deg, #FFA726, #FF9800)'; // Orange for medium intent
  } else {
    backgroundColor = 'linear-gradient(135deg, #FF5722, #F44336)'; // Red for low intent
  }
  
  scoreElement.style.cssText = `
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: ${backgroundColor};
    color: white;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    opacity: 0.9;
    z-index: 1;
  `;
  scoreElement.textContent = score;
  scoreElement.title = `Intent Score: ${score}/10 - ${score >= 8 ? 'High' : score >= 6 ? 'Medium' : 'Low'} Commercial Intent`;
  return scoreElement;
}

function validateAdContent(headlines, descriptions, callToActions) {
  const issues = [];
  
  // Validate headlines
  headlines.forEach((headline, index) => {
    if (headline.length > 28) {
      issues.push(`Headline ${index + 1} exceeds 28 characters: "${headline}" (${headline.length} chars)`);
    }
  });
  
  // Validate descriptions
  descriptions.forEach((description, index) => {
    if (description.length > 88) {
      issues.push(`Description ${index + 1} exceeds 88 characters: "${description}" (${description.length} chars)`);
    }
  });
  
  // Validate CTAs
  callToActions.forEach((cta, index) => {
    if (cta.length > 15) {
      issues.push(`CTA ${index + 1} exceeds 15 characters: "${cta}" (${cta.length} chars)`);
    }
  });
  
  return issues;
}

function truncateToFit(text, maxLength) {
  if (text.length <= maxLength) return text;
  
  // Try to truncate at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated.substring(0, maxLength - 3) + '...';
}

function getPainPointTemplates(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  
  // Common pain points by industry/category
  const templates = {
    // Service-based pain points
    'plumber': {
      headlines: [
        'Burst Pipe? Fix In 1 Hour',
        '$99 Drain Cleaning Today',
        '24/7 Emergency Plumber Near',
        'Save $200 On Water Heaters',
        'Leaking Faucet? Call Now',
        'Clogged Drain? We Fix Fast',
        'Water Heater Broken? Help!',
        'Pipe Burst? Emergency Service',
        'Plumbing Emergency? Call 24/7',
        'Sewer Backup? We Clean Now'
      ],
      descriptions: [
        'Licensed plumbers fix leaks fast. 24/7 service. $49 service call. Guaranteed work. Call now.',
        'Water heater broken? Same-day installation. Energy-efficient models. Save on bills. Book today.',
        'Clogged drain ruining your day? Professional cleaning in 1 hour. $79 flat rate. Satisfaction guaranteed.',
        'Burst pipe flooding your home? Emergency response in 30 minutes. Insurance approved. Call immediately.'
      ],
      ctas: [
        'Get Quote Now',
        'Call 24/7',
        'Book Service',
        'Emergency Help',
        'Fix Today'
      ]
    },
    
    // Product/ecommerce pain points
    'shoes': {
      headlines: [
        'New Shoes 50% Off Today',
        'Comfort Shoes Sale Ends Soon',
        'Running Shoes? Free Shipping',
        'Work Boots 30% Off Limited',
        'Sneaker Sale - Last Day!',
        'Orthopedic Shoes Pain Relief',
        'Wide Shoes Available Now',
        'Kids Shoes Buy 1 Get 1 Free',
        'Designer Shoes 40% Off',
        'Shoes Hurt? Try Comfort Fit'
      ],
      descriptions: [
        'Quality shoes at discount prices. Free shipping on orders over $50. 30-day return policy. Shop now.',
        'Foot pain from bad shoes? Orthopedic comfort shoes designed by podiatrists. Relief guaranteed.',
        'Hard to find wide shoes? Extended sizes in stock. Comfortable fit. Order your perfect size today.',
        'Kids outgrowing shoes fast? Affordable quality footwear. Buy one get one 50% off this week only.'
      ],
      ctas: [
        'Shop Now',
        'Order Today',
        'Get 50% Off',
        'Buy Shoes',
        'Shop Sale'
      ]
    },
    
    // Emergency services
    'emergency': {
      headlines: [
        'Emergency? Help In 15 Minutes',
        '24/7 Emergency Service Available',
        'Urgent Care No Wait Time',
        'Emergency Dentist Open Now',
        'Locksmith Emergency 24/7',
        'AC Emergency Repair Today',
        'Heating Emergency? Fix Fast',
        'Electrical Emergency? Call Now',
        'Roof Emergency? We Respond Fast',
        'Car Emergency? Tow Truck Near'
      ],
      descriptions: [
        'Emergency situation? Fast response team ready 24/7. Certified professionals. Insurance accepted. Call immediately.',
        'Locked out? Emergency locksmith arrives in 20 minutes. No damage guarantee. Fair pricing. Available now.',
        'Medical emergency? Urgent care with no appointment needed. Board-certified doctors. Short wait times.',
        'AC broken in summer heat? Emergency repair within 2 hours. Licensed technicians. Warranty included.'
      ],
      ctas: [
        'Call 911',
        'Emergency Help',
        'Get Help Now',
        'Call Immediately',
        'Urgent Help'
      ]
    }
  };
  
  // Find matching template or return generic
  for (const [key, template] of Object.entries(templates)) {
    if (lowerKeyword.includes(key)) {
      return template;
    }
  }
  
  // Generic pain point templates
  return {
    headlines: [
      'Save Time And Money Today',
      'Professional Service Guaranteed',
      'Get Results Fast - Call Now',
      'Affordable Quality Solutions',
      'Expert Help Available 24/7',
      'Stress-Free Service Promise',
      'Your Problem Solved Today',
      'Trusted By Thousands Locally',
      'Quick Fix For Your Issue',
      'Premium Service Fair Prices'
    ],
    descriptions: [
      'Professional service with guaranteed results. Fast response time. Competitive pricing. Satisfaction assured. Contact us today.',
      'Quality solutions for your needs. Experienced team ready to help. Affordable rates. Get your free quote now.',
      'Stop wasting time and money. Expert service that delivers results. Proven track record. Call for immediate assistance.',
      'Your satisfaction is our priority. Professional team with years of experience. Fair pricing. Schedule your service today.'
    ],
    ctas: [
      'Get Quote',
      'Call Now',
      'Learn More',
      'Contact Us',
      'Get Started'
    ]
  };
}

document.addEventListener('DOMContentLoaded', () => {
 try {
    // UI Elements
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const capitalizeKeywordsCheckbox = document.getElementById('capitalize-keywords');
  const gradientStartInput = document.getElementById('gradient-start');
  const gradientEndInput = document.getElementById('gradient-end');
  const fontSelect = document.getElementById('font-select');
  const fontSizeInput = document.getElementById('font-size');
  const deepseekApiKeyInput = document.getElementById('deepseek-api-key');
  const saveApiKeyBtn = document.getElementById('save-api-key-btn');
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const saveGeminiApiKeyBtn = document.getElementById('save-gemini-api-key-btn');
  const clearStorageBtn = document.getElementById('clear-storage-btn');
  const exportBtn = document.getElementById('export-btn');
  const getSuggestionsBtn = document.getElementById('get-suggestions-btn');
  const suggestionsContainer = document.getElementById('suggestions-container');
  const matchTypeControls = document.querySelectorAll('input[name="match-type"]');
  const keywordsContainer = document.getElementById('keywords-container');
  const copyAllBtn = document.getElementById('copy-all-btn');
  const removeAllBtn = document.getElementById('remove-all-btn');
  const bulkPasteArea = document.getElementById('bulk-paste-area');
  const bulkPasteBtn = document.getElementById('bulk-paste-btn');
  const regenerateBtn = document.getElementById('regenerate-btn');
  const generateAdsBtn = document.getElementById('generate-ads-btn');
  const adsContainer = document.getElementById('ads-container');
  const headlinesContainer = document.getElementById('headlines-container');
  const descriptionsContainer = document.getElementById('descriptions-container');
  const regenerateAdsBtn = document.getElementById('regenerate-ads-btn');
  const downloadSuggestionsBtn = document.getElementById('download-suggestions-btn');
  const downloadHeadlinesBtn = document.getElementById('download-headlines-btn');
  const downloadDescriptionsBtn = document.getElementById('download-descriptions-btn');
  const downloadCtaBtn = document.getElementById('download-cta-btn');
  const ctaContainer = document.getElementById('cta-container');


  let currentMatchType = 'phrase';

  // Initialize
  loadSettings();
  updateKeywordsList();
  restoreSavedData();

  // Event Listeners
  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
    
    // Add/remove overlay for better UX
    if (!settingsPanel.classList.contains('hidden')) {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.id = 'settings-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        z-index: 999;
        cursor: pointer;
      `;
      overlay.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
        overlay.remove();
      });
      document.body.appendChild(overlay);
    } else {
      // Remove overlay
      const overlay = document.getElementById('settings-overlay');
      if (overlay) overlay.remove();
    }
  });

  capitalizeKeywordsCheckbox.addEventListener('change', () => {
    saveSettings();
    updateKeywordsList();
  });

  gradientStartInput.addEventListener('input', saveSettings);
  gradientEndInput.addEventListener('input', saveSettings);
  fontSelect.addEventListener('change', saveSettings);
  fontSizeInput.addEventListener('input', saveSettings);

  saveApiKeyBtn.addEventListener('click', () => {
    const apiKey = deepseekApiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.local.set({ deepseekApiKey: apiKey }, () => {
        showNotification('Success', 'API Key saved.');
      });
    }
  });

  saveGeminiApiKeyBtn.addEventListener('click', () => {
    const apiKey = geminiApiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
        showNotification('Success', 'Gemini API Key saved.');
      });
    }
  });

  clearStorageBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all saved AI suggestions and generated ads? This action cannot be undone.')) {
      chrome.storage.local.remove(['aiSuggestions', 'generatedHeadlines', 'generatedDescriptions'], () => {
        // Clear the UI
        suggestionsContainer.innerHTML = '';
        document.getElementById('suggestions-details').classList.add('hidden');
        regenerateBtn.classList.add('hidden');
        
        const headlinesContainer = document.getElementById('headlines-container');
        const descriptionsContainer = document.getElementById('descriptions-container');
        const adsContainer = document.getElementById('ads-container');
        
        if (headlinesContainer) headlinesContainer.innerHTML = '';
        if (descriptionsContainer) descriptionsContainer.innerHTML = '';
        if (adsContainer) adsContainer.classList.add('hidden');
        document.getElementById('regenerate-ads-btn').classList.add('hidden');
        
        showNotification('Success', 'Saved data cleared successfully.');
      });
    }
  });

  getSuggestionsBtn.addEventListener('click', async () => {
    const btn = getSuggestionsBtn;
    const originalHTML = btn.innerHTML;
    
    // Add loading state
    btn.innerHTML = '<span class="loading-spinner"></span> Generating...';
    btn.disabled = true;
    
    try {
      await getAIKeywordSuggestions();
    } finally {
      // Restore original state
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  });

  regenerateBtn.addEventListener('click', getAIKeywordSuggestions);
  downloadSuggestionsBtn.addEventListener('click', () => downloadFile(suggestionsContainer, 'keyword-suggestions'));

  generateAdsBtn.addEventListener('click', generateAds);

  regenerateAdsBtn.addEventListener('click', generateAds);
  downloadHeadlinesBtn.addEventListener('click', () => downloadFile(headlinesContainer, 'headlines'));
  downloadDescriptionsBtn.addEventListener('click', () => downloadFile(descriptionsContainer, 'descriptions'));
  downloadCtaBtn.addEventListener('click', () => downloadFile(ctaContainer, 'call-to-actions'));

  matchTypeControls.forEach(control => {
    control.addEventListener('change', (e) => {
      currentMatchType = e.target.value;
      chrome.storage.local.set({ matchType: currentMatchType });
      updateKeywordsList();
    });
  });

  exportBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'exportKeywords',
        matchType: currentMatchType
      });

      if (response && response.success) {
        showNotification('Success', 'Export started! Check your downloads for a complete file with keywords, headlines, descriptions, and CTAs.');
      } else {
        throw new Error(response.error || 'An unknown error occurred during export.');
      }
    } catch (error) {
      showNotification('Error', `Export failed: ${error.message}`);
      console.error('Export error:', error);
    }
  });

  copyAllBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getKeywords' });
      if (response && response.keywords && response.keywords.length > 0) {
        const keywordsText = response.keywords
          .map(k => formatKeyword(k.text, currentMatchType))
          .join('\n');

        await navigator.clipboard.writeText(keywordsText);
        showNotification('Success', 'All keywords copied');
      }
    } catch (error) {
      showNotification('Error', 'Failed to copy keywords');
    }
  });

  removeAllBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearKeywords' });
      if (response.success) {
        updateKeywordsList();
        showNotification('Success', 'All keywords removed');
      } else {
        showNotification('Error', 'Failed to remove keywords');
      }
    } catch (error) {
      showNotification('Error', 'Failed to remove keywords');
    }
  });

  bulkPasteBtn.addEventListener('click', async () => {
    const keywords = bulkPasteArea.value.split('\n')
      .map(k => k.trim())
      .filter(k => k !== '');

    if (keywords.length > 0) {
      const keywordObjects = keywords.map(k => ({ text: k, timestamp: Date.now(), source: 'bulk_paste', isNew: true }));
      
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'addKeywordsBulk', keywords: keywordObjects }, (response) => {
            if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
            }
            resolve(response);
          });
        });

        if (response.success) {
          bulkPasteArea.value = '';
          // await updateKeywordsList(); // No longer needed, will be handled by keywordsUpdated message
          
          let notificationMessage = `Added ${response.totalAdded} keywords.`;
          if (response.duplicates && response.duplicates.length > 0) {
            notificationMessage += ` ${response.duplicates.length} duplicates were skipped.`;
          }
          showNotification('Success', notificationMessage);
          
        } else {
          showNotification('Error', response.error || 'Failed to add keywords.');
        }
      } catch (error) {
        showNotification('Error', `An error occurred: ${error.message}`);
      }
    }
  });

  // Functions
  function loadSettings() {
    chrome.storage.local.get(['capitalizeKeywords', 'gradientStart', 'gradientEnd', 'font', 'fontSize', 'deepseekApiKey', 'geminiApiKey'], (result) => {
      if (result.capitalizeKeywords) {
        capitalizeKeywordsCheckbox.checked = true;
      }
      if (result.gradientStart) {
        gradientStartInput.value = result.gradientStart;
      }
      if (result.gradientEnd) {
        gradientEndInput.value = result.gradientEnd;
      }
      if (result.font) {
        fontSelect.value = result.font;
        document.body.style.fontFamily = result.font;
      }
      if (result.fontSize) {
        fontSizeInput.value = result.fontSize;
        document.body.style.fontSize = `${result.fontSize}px`;
      }
      if (result.deepseekApiKey) {
        deepseekApiKeyInput.value = result.deepseekApiKey;
      }
      if (result.geminiApiKey) {
        geminiApiKeyInput.value = result.geminiApiKey;
      }
      // Apply styles
      document.body.style.setProperty('--gradient-start', gradientStartInput.value);
      document.body.style.setProperty('--gradient-end', gradientEndInput.value);
    });
  }

  function saveSettings() {
    const settings = {
      capitalizeKeywords: capitalizeKeywordsCheckbox.checked,
      gradientStart: gradientStartInput.value,
      gradientEnd: gradientEndInput.value,
      font: fontSelect.value,
      fontSize: fontSizeInput.value,
      deepseekApiKey: deepseekApiKeyInput.value
    };
    chrome.storage.local.set(settings);
    applySettings();
  }

  function applySettings() {
    document.body.style.setProperty('--gradient-start', gradientStartInput.value);
    document.body.style.setProperty('--gradient-end', gradientEndInput.value);
    document.body.style.fontFamily = fontSelect.value;
    document.body.style.fontSize = `${fontSizeInput.value}px`;
  }

  function renderKeywords(keywords) {
    keywordsContainer.innerHTML = '';
    
    // Update keyword counter
    updateKeywordCounter(keywords.length);
    
    keywords.forEach((keyword) => {
      const keywordItem = document.createElement('div');
      keywordItem.className = 'keyword-item';
      keywordItem.dataset.keyword = keyword.text;

      // Highlight new keywords
      if (keyword.isNew) {
        keywordItem.classList.add('new');
        // Remove the class after the animation completes
        setTimeout(() => {
          keywordItem.classList.remove('new');
        }, 1000); // Match the animation duration
        delete keyword.isNew; // Clean up the flag
      }

      const keywordText = document.createElement('span');
      keywordText.className = 'keyword-text';
      keywordText.textContent = formatKeyword(keyword.text, currentMatchType);

      const actions = document.createElement('div');
      actions.className = 'keyword-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'action-btn';
      copyBtn.innerHTML = '<span class="material-icons">content_copy</span>';
      copyBtn.addEventListener('click', () => copyKeyword(keyword.text));

      const removeBtn = document.createElement('button');
      removeBtn.className = 'action-btn remove';
      removeBtn.innerHTML = '<span class="material-icons">close</span>';
      removeBtn.addEventListener('click', () => removeKeyword(keyword));

      actions.appendChild(copyBtn);
      actions.appendChild(removeBtn);

      keywordItem.appendChild(keywordText);
      keywordItem.appendChild(actions);
      keywordsContainer.appendChild(keywordItem);
    });
  }

  async function updateKeywordsList() {
    console.log('Updating keywords list in popup');
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getKeywords' });
      console.log('Received keywords from background:', response);

      if (response && response.keywords) {
        renderKeywords(response.keywords);
      } else {
        // Clear the list if no keywords are returned
        renderKeywords([]);
      }
    } catch (error) {
      console.error('Failed to update keywords list:', error);
      // Optionally, display an error message to the user
      keywordsContainer.innerHTML = '<div class="error-message">Could not load keywords.</div>';
    }
  }

  function updateKeywordsUI(keywords) {
    renderKeywords(keywords);
  }

  function formatKeyword(keyword, matchType) {
    let formattedKeyword = keyword;
    if (capitalizeKeywordsCheckbox.checked) {
      formattedKeyword = formattedKeyword.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    switch (matchType) {
      case 'phrase':
        return `"${formattedKeyword}"`;
      case 'exact':
        return `[${formattedKeyword}]`;
      default:
        return formattedKeyword;
    }
  }

  function handleKeywordSelection(event, keyword, keywordItem) {
    const isChecked = event.target.checked;
    
    if (isChecked) {
      // Add yellow highlighting when checked
      keywordItem.classList.add('keyword-selected');
      console.log(`Keyword selected: ${keyword.text}`);
    } else {
      // Remove highlighting when unchecked
      keywordItem.classList.remove('keyword-selected');
      console.log(`Keyword deselected: ${keyword.text}`);
    }
    
    // Update the selected keywords list for potential bulk operations
    updateSelectedKeywordsList();
  }

  function updateSelectedKeywordsList() {
    const selectedCheckboxes = document.querySelectorAll('.keyword-checkbox:checked');
    const selectedKeywords = Array.from(selectedCheckboxes).map(checkbox => {
      const keywordItem = checkbox.closest('.keyword-item');
      return keywordItem.dataset.keyword;
    });
    
    console.log('Selected keywords:', selectedKeywords);
    // Store selected keywords for potential bulk operations
    window.selectedKeywords = selectedKeywords;
  }

  function copyKeyword(keyword) {
    const formattedKeyword = formatKeyword(keyword, currentMatchType);
    navigator.clipboard.writeText(formattedKeyword)
      .then(() => showNotification('Success', 'Keyword copied'))
      .catch(() => showNotification('Error', 'Failed to copy keyword'));
  }

  async function removeKeyword(keyword) {
    try {
      await chrome.runtime.sendMessage({
        action: 'removeKeyword',
        keyword: keyword
      });
      // updateKeywordsList(); // No longer needed, will be handled by keywordsUpdated message
    } catch (error) {
      console.error('Failed to remove keyword:', error);
    }
  }

  function showNotification(title, message, duration = 3000) {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${title.toLowerCase()}`;
    
    // Add icon based on type
    const iconMap = {
      'success': 'check_circle',
      'error': 'error',
      'warning': 'warning',
      'info': 'info'
    };
    
    const icon = iconMap[title.toLowerCase()] || 'info';
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="material-icons" style="font-size: 20px;">${icon}</span>
        <div>
          <div style="font-weight: 600; margin-bottom: 2px;">${title}</div>
          <div style="font-size: 13px; opacity: 0.9;">${message}</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // Auto remove
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 400);
    }, duration);
    
    // Click to dismiss
    notification.addEventListener('click', () => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 400);
    });
  }

  // Centralized message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'keywordsUpdated') {
      console.log('Keywords updated message received, refreshing list.');
      updateKeywordsList();
    }
    // Return true to indicate that you wish to send a response asynchronously
    return true;
  });

  async function getAIKeywordSuggestions() {
    const { deepseekApiKey, geminiApiKey, keywords } = await new Promise(resolve => {
      chrome.storage.local.get(['deepseekApiKey', 'geminiApiKey', 'keywords'], resolve);
    });

    const useGemini = !!geminiApiKey;

    if (!useGemini && !deepseekApiKey) {
      showNotification('Error', 'Please save your DeepSeek or Gemini API key in the settings.');
      return;
    }

    if (!keywords || keywords.length === 0) {
      showNotification('Error', 'Add some keywords first to get suggestions.');
      return;
    }

    getSuggestionsBtn.textContent = 'Generating...';
    getSuggestionsBtn.disabled = true;
    getSuggestionsBtn.classList.add('loading');

    try {
      let response;
      if (useGemini) {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a Google Ads expert with deep knowledge of keyword intent and conversion optimization. 

Analyze these root keywords and generate 20 high-intent, commercially viable keywords that are highly relevant and likely to convert:

${keywords.map(k => k.text).join('\n')}

REQUIREMENTS:
1. Focus on HIGH-COMMERCIAL-INTENT keywords (buying, purchasing, hiring, booking intent)
2. Include transactional modifiers: "buy", "purchase", "hire", "order", "price", "cost", "near me", "best", "top", "review", "comparison"
3. Add location-based keywords if applicable: "[service] + [city]", "local", "nearby"
4. Include urgency/time-based: "urgent", "same day", "24 hour", "emergency"
5. Add specific service/product qualifiers: "professional", "certified", "licensed", "guaranteed"
6. Generate long-tail variations (3-5 words) for higher conversion rates
7. Ensure HIGH RELEVANCE to the root keywords provided
8. Prioritize keywords with clear commercial/buying intent

FORMAT:
Return ONLY the keywords, one per line, no numbers or bullets.
Focus on QUALITY over quantity - 20 highly targeted, conversion-ready keywords.`
              }]
            }]
          })
        });
      } else {
        response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepseekApiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: `You are a Google Ads expert specializing in high-intent keyword research and conversion optimization. Your goal is to generate commercially viable keywords that drive qualified leads and sales.

GUIDELINES:
- Generate HIGH-COMMERCIAL-INTENT keywords with buying/purchasing intent
- Include transactional modifiers: "buy", "purchase", "hire", "order", "price", "cost"
- Add location-based keywords: "[service] + [city]", "local", "near me"
- Include urgency/time-based: "urgent", "same day", "24 hour", "emergency"
- Add service qualifiers: "professional", "certified", "licensed", "guaranteed"
- Create long-tail variations (3-5 words) for higher conversion rates
- Ensure HIGH RELEVANCE to provided root keywords
- Focus on keywords that indicate readiness to purchase/hire/book`
              },
              {
                role: 'user',
                content: `Generate 20 high-intent, commercially viable keywords based on these root keywords. Focus on conversion-ready terms with clear buying intent:\n\n${keywords.map(k => k.text).join('\n')}\n\nRequirements:\n1. HIGH commercial intent (buying/hiring/booking keywords)\n2. Include transactional modifiers\n3. Add location and urgency elements where relevant\n4. Long-tail variations for better conversion\n5. HIGH relevance to root keywords\n6. Quality over quantity - 20 targeted keywords\n\nReturn only the keywords, one per line.`
              }
            ]
          })
        });
      }

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      let suggestions;
      try {
        if (useGemini) {
          suggestions = data.candidates[0].content.parts[0].text.split('\n').filter(k => k.trim() !== '');
        } else {
          suggestions = data.choices[0].message.content.split('\n').filter(k => k.trim() !== '');
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.error('Raw AI response:', useGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content);
        throw new Error('Failed to parse AI response. The format might be incorrect.');
      }
      
      displaySuggestions(suggestions);

    } catch (error) {
      showNotification('Error', `Failed to get suggestions: ${error.message}. Please check your API key and try again.`);
      console.error('Error fetching suggestions:', error);
    } finally {
      getSuggestionsBtn.textContent = 'High-Intent Keyword Suggestions';
      getSuggestionsBtn.disabled = false;
      getSuggestionsBtn.classList.remove('loading');
    }
  }

  function displaySuggestions(suggestions) {
  // Filter and sort suggestions by intent score
  const highIntentSuggestions = filterHighIntentKeywords(suggestions);
  const sortedSuggestions = sortKeywordsByIntent(highIntentSuggestions);
  
  // Save suggestions to Chrome storage for persistence
  chrome.storage.local.set({ aiSuggestions: sortedSuggestions });
  
  const suggestionsDetails = document.getElementById('suggestions-details');
  suggestionsContainer.innerHTML = '';
  
  // Add intent classification header
  const intentHeader = document.createElement('div');
  intentHeader.className = 'intent-header';
  intentHeader.innerHTML = `
    <div class="intent-stats">
      <span class="intent-label">🎯 High-Intent Keywords</span>
      <span class="intent-count">${sortedSuggestions.length} suggestions</span>
    </div>
    <div class="intent-description">
      Commercial keywords with buying/hiring intent, optimized for conversion
    </div>
  `;
  suggestionsContainer.appendChild(intentHeader);
  
  sortedSuggestions.forEach(suggestion => {
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';
      suggestionItem.style.position = 'relative';
      
      // Add intent score element
      const intentScore = getIntentScore(suggestion);
      const scoreElement = createIntentScoreElement(intentScore);
      suggestionItem.appendChild(scoreElement);
      
      // Add intent indicator
      const intentIndicator = document.createElement('div');
      intentIndicator.className = 'intent-indicator';
      intentIndicator.innerHTML = getIntentIcon(suggestion);
      intentIndicator.title = getIntentDescription(suggestion);

      const suggestionText = document.createElement('span');
      suggestionText.textContent = suggestion;

      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'suggestion-actions';

      const copyBtn = document.createElement('button');
      copyBtn.innerHTML = '<span class="material-icons">content_copy</span>';
      copyBtn.className = 'suggestion-copy-btn';
      copyBtn.title = 'Copy suggestion';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(suggestion);
          showNotification('Success', `Copied "${suggestion}"`);
        } catch (error) {
          showNotification('Error', 'Failed to copy suggestion');
        }
      });

      const addBtn = document.createElement('button');
      addBtn.innerHTML = '<span class="material-icons">add_circle</span>';
      addBtn.className = 'suggestion-add-btn';
      addBtn.title = 'Add to keywords';
      addBtn.addEventListener('click', async () => {
        const keywordObject = { text: suggestion, timestamp: Date.now(), source: 'ai_suggestion', isNew: true };
        try {
          const response = await chrome.runtime.sendMessage({ action: 'addKeyword', keyword: keywordObject });
          if (response.success) {
            showNotification('Success', `Added "${suggestion}"`);
            suggestionItem.remove();
            // updateKeywordsList(); // No longer needed, will be handled by keywordsUpdated message
            // Update stored suggestions by removing the added one
            const { aiSuggestions } = await new Promise(resolve => {
              chrome.storage.local.get(['aiSuggestions'], resolve);
            });
            if (aiSuggestions) {
              const updatedSuggestions = aiSuggestions.filter(s => s !== suggestion);
              chrome.storage.local.set({ aiSuggestions: updatedSuggestions });
            }
          } else {
            showNotification('Error', response.error || 'Failed to add keyword.');
          }
        } catch (error) {
          showNotification('Error', 'Failed to add keyword.');
        }
      });

      actionsContainer.appendChild(copyBtn);
      actionsContainer.appendChild(addBtn);
      // Create content wrapper for intent indicator and text
      const contentWrapper = document.createElement('div');
      contentWrapper.style.display = 'flex';
      contentWrapper.style.alignItems = 'center';
      contentWrapper.style.flex = '1';
      
      contentWrapper.appendChild(intentIndicator);
      contentWrapper.appendChild(suggestionText);
      
      suggestionItem.appendChild(contentWrapper);
      suggestionItem.appendChild(actionsContainer);
      suggestionsContainer.appendChild(suggestionItem);
    });
    suggestionsDetails.classList.remove('hidden');
    suggestionsDetails.open = true;
    regenerateBtn.classList.remove('hidden');
    downloadSuggestionsBtn.classList.remove('hidden');
  }

  async function generateAds() {
    const { deepseekApiKey, geminiApiKey, keywords } = await new Promise(resolve => {
      chrome.storage.local.get(['deepseekApiKey', 'geminiApiKey', 'keywords'], resolve);
    });

    const useGemini = !!geminiApiKey;

    if (!useGemini && !deepseekApiKey) {
      showNotification('Error', 'Please save your DeepSeek or Gemini API key in the settings.');
      return;
    }

    if (!keywords || keywords.length === 0) {
      showNotification('Error', 'Add some keywords first to generate ads.');
      return;
    }

    generateAdsBtn.textContent = 'Generating...';
    generateAdsBtn.disabled = true;
    regenerateAdsBtn.disabled = true;

    try {
      let response;
      const systemContent = `You are a Google Ads expert specializing in conversion-focused ad copy. Generate EXACTLY 25 headlines (STRICTLY 28 characters max), 8 descriptions (STRICTLY 88 characters max), and 8 CTAs (STRICTLY 15 characters max) based on the provided keywords.

**REFERENCE TEMPLATES FOR PAIN-POINT FOCUSED COPY:**
Based on the keywords provided, use these proven pain-point templates as inspiration:

${keywords.slice(0, 3).map(k => {
  const templates = getPainPointTemplates(k.text);
  return `For "${k.text}":
Headlines: ${templates.headlines.slice(0, 5).join(' | ')}
Descriptions: ${templates.descriptions.slice(0, 2).join(' | ')}
CTAs: ${templates.ctas.slice(0, 3).join(' | ')}`;
}).join('\n\n')}

**CRITICAL REQUIREMENTS:**
1. **CHARACTER LIMITS ARE ABSOLUTE - NO EXCEPTIONS:**
   - Headlines: EXACTLY 28 characters or less (count every character including spaces)
   - Descriptions: EXACTLY 88 characters or less (count every character including spaces)  
   - CTAs: EXACTLY 15 characters or less (count every character including spaces)

2. **PAIN-POINT FOCUSED COPY:**
   - Identify customer pain points (time, money, stress, uncertainty, quality concerns)
   - Address specific problems your service/product solves
   - Use urgency triggers (limited time, act now, don't wait, today only)
   - Focus on benefits and outcomes, not just features
   - Create emotional connection through problem-solving language

3. **CLEVER, BENEFIT-DRIVEN MESSAGING:**
   - Use power words: "Proven", "Guaranteed", "Instant", "Exclusive", "Premium"
   - Include numbers and specifics for credibility
   - Create curiosity gaps that demand clicks
   - Use contrast (before/after, with/without, old/new)
   - Make bold promises you can deliver on

4. **URGENCY & SCARCITY ELEMENTS:**
   - Limited time offers, countdown language, seasonal urgency
   - "Today", "Now", "Limited", "Don't Wait", "Act Fast"
   - Fear of missing out (FOMO) triggers

5. **KEYWORD-SPECIFIC CTAs:**
   - Analyze each keyword's intent and create matching CTAs
   - For services: "Get Quote", "Book Consult", "Schedule Call"
   - For products: "Shop Now", "Buy Today", "Order Here"
   - For information: "Learn More", "Get Guide", "Download Now"
   - For emergencies: "Call 24/7", "Get Help", "Fix Today"

**COPY FRAMEWORKS TO USE:**
- Problem + Solution: "Tired Of [Problem]? Get [Solution]"
- Benefit + Urgency: "Save $500 Today On [Service]"
- Question + Answer: "Need [Service]? We Deliver Fast"
- Before/After: "From [Pain] To [Gain] In Hours"
- Numbers + Proof: "Join 5,000+ Happy Customers"

**EXAMPLE FORMAT (for "plumber"):**
Headlines (28 char max):
- "Burst Pipe? Fix In 1 Hour"
- "$99 Drain Cleaning Today"
- "24/7 Emergency Plumber Near"
- "Save $200 On Water Heaters"

Descriptions (88 char max):
- "Licensed plumbers fix leaks fast. 24/7 service. $49 service call. Guaranteed work. Call now."
- "Water heater broken? Same-day installation. Energy-efficient models. Save on bills. Book today."

CTAs (15 char max):
- "Get Quote Now"
- "Call 24/7"
- "Book Service"

${capitalizeKeywordsCheckbox.checked ? 'CAPITALIZATION: Use title case for all content (each major word capitalized).' : ''}

Return EXACTLY as JSON: {"headlines":[],"descriptions":[],"callToActions":[]}`;
      const userContent = keywords.map(k => capitalizeKeywordsCheckbox.checked ? k.text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : k.text).join('\n');

      if (useGemini) {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: systemContent },
                { text: userContent }
              ]
            }]
          })
        });
      } else {
        response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepseekApiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: systemContent
              },
              {
                role: 'user',
                content: userContent
              }
            ]
          })
        });
      }

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      let parsedContent;
      try {
        if (useGemini) {
          // Gemini response might be wrapped in markdown-like backticks
          const rawText = data.candidates[0].content.parts[0].text.replace(/```json\n|```/g, '').trim();
          parsedContent = JSON.parse(rawText);
        } else {
          // DeepSeek response parsing with better error handling
          const rawContent = data.choices[0].message.content;
          
          // Try to extract JSON from the response
          let jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedContent = JSON.parse(jsonMatch[0]);
          } else {
            // If no JSON found, try to parse the entire content
            parsedContent = JSON.parse(rawContent);
          }
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.error('Raw AI response:', useGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content);
        
        // Fallback: create default content if parsing fails
        console.log('Using fallback content generation due to parsing error');
        const fallbackKeywords = keywords.map(k => k.text).slice(0, 5); // Use first 5 keywords
        parsedContent = {
          headlines: fallbackKeywords.map(k => `Best ${k} Services`).slice(0, 20),
          descriptions: [
            'Professional services with proven results. Contact us today for a free consultation.',
            'Affordable solutions tailored to your needs. Get started now with our expert team.',
            'Trusted by thousands of satisfied customers. Discover why we are the industry leader.',
            'Fast, reliable service you can count on. We deliver quality results every time.',
            'Save time and money with our efficient solutions. Get your free quote today.',
            'Experienced professionals ready to help. Transform your business with our expertise.',
            'Custom solutions designed for your success. Let us handle your project from start to finish.',
            'Quality service at competitive prices. Join our growing list of happy clients.'
          ],
          callToActions: [
            'Get Quote',
            'Contact Now',
            'Learn More',
            'Get Started',
            'Call Today',
            'Book Now',
            'Shop Now',
            'Sign Up'
          ]
        };
      }
      const { headlines, descriptions, callToActions } = parsedContent;

      // Validate character limits
      const validationIssues = validateAdContent(headlines, descriptions, callToActions);
      if (validationIssues.length > 0) {
        console.warn('Ad content validation issues found:', validationIssues);
        showNotification('Warning', `Generated content has ${validationIssues.length} character limit issues. Content will be truncated to fit.`);
        
        // Truncate content to fit limits
        const validHeadlines = headlines.map(h => truncateToFit(h, 28));
        const validDescriptions = descriptions.map(d => truncateToFit(d, 88));
        const validCTAs = callToActions.map(c => truncateToFit(c, 15));
        
        displayAds(validHeadlines, validDescriptions, validCTAs);
      } else {
        displayAds(headlines, descriptions, callToActions);
      }

    } catch (error) {
      showNotification('Error', `Failed to generate ads: ${error.message}. Please check your API key and try again.`);
      console.error('Error generating ads:', error);
    } finally {
      generateAdsBtn.textContent = 'Generate Headlines & Descriptions';
      generateAdsBtn.disabled = false;
      regenerateAdsBtn.disabled = false;
    }
  }

  function downloadFile(container, fileNamePrefix) {
    const items = Array.from(container.children).map(item => item.querySelector('span').textContent);
    const content = items.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileNamePrefix}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function displayAds(headlines, descriptions, callToActions) {
    // Save generated ads to Chrome storage for persistence
    chrome.storage.local.set({ 
      generatedHeadlines: headlines,
      generatedDescriptions: descriptions,
      generatedCallToActions: callToActions
    });
    
    headlinesContainer.innerHTML = '';
    descriptionsContainer.innerHTML = '';

    headlines.forEach(headline => {
      const adItem = createAdItem(headline, 'headline');
      headlinesContainer.appendChild(adItem);
    });

    descriptions.forEach(description => {
      const adItem = createAdItem(description, 'description');
      descriptionsContainer.appendChild(adItem);
    });

    // Display call-to-action phrases
    const ctaContainer = document.getElementById('cta-container');
    ctaContainer.innerHTML = '';
    callToActions.forEach(cta => {
      const adItem = createAdItem(cta, 'cta');
      ctaContainer.appendChild(adItem);
    });

    adsContainer.classList.remove('hidden');
    downloadHeadlinesBtn.classList.remove('hidden');
    downloadDescriptionsBtn.classList.remove('hidden');
    downloadCtaBtn.classList.remove('hidden');
    regenerateAdsBtn.classList.remove('hidden');
  }

  function createAdItem(text, type = 'headline') {
    const adItem = document.createElement('div');
    adItem.className = 'ad-item';
    
    // Determine character limit based on type
    let charLimit, limitClass;
    switch(type) {
      case 'headline':
        charLimit = 28;
        limitClass = 'headline-limit';
        break;
      case 'description':
        charLimit = 88;
        limitClass = 'description-limit';
        break;
      case 'cta':
        charLimit = 15;
        limitClass = 'cta-limit';
        break;
      default:
        charLimit = 28;
        limitClass = 'headline-limit';
    }
    
    // Create character counter
    const charCounter = document.createElement('div');
    charCounter.className = `char-counter ${text.length > charLimit ? 'over-limit' : ''}`;
    charCounter.textContent = `${text.length}/${charLimit}`;
    charCounter.title = `Character count: ${text.length}/${charLimit}`;
    
    // Add visual indicator for character limit
    const limitIndicator = document.createElement('div');
    limitIndicator.className = `limit-indicator ${limitClass}`;
    limitIndicator.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
      background: ${text.length > charLimit ? '#f44336' : text.length > charLimit * 0.9 ? '#ff9800' : '#4caf50'};
      color: white;
      opacity: 0.9;
      z-index: 1;
    `;
    limitIndicator.textContent = text.length > charLimit ? 'OVER' : text.length > charLimit * 0.9 ? 'WARN' : 'OK';

    const adText = document.createElement('span');
    adText.textContent = text;
    adText.style.flex = '1';
    adText.style.marginRight = '60px'; // Space for character counter

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'ad-actions';
    actionsContainer.style.position = 'relative';

    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = '<span class="material-icons">content_copy</span>';
    copyBtn.className = 'ad-copy-btn';
    copyBtn.title = 'Copy ad text';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        showNotification('Success', `Copied "${text}"`);
      } catch (error) {
        showNotification('Error', 'Failed to copy ad text');
      }
    });

    const addBtn = document.createElement('button');
    addBtn.innerHTML = '<span class="material-icons">add_circle</span>';
    addBtn.className = 'ad-add-btn';
    addBtn.title = 'Add to keywords';
    addBtn.addEventListener('click', async () => {
      const keywordObject = { text, timestamp: Date.now(), source: 'ad_generation', isNew: true };
      try {
        const response = await chrome.runtime.sendMessage({ action: 'addKeyword', keyword: keywordObject });
        if (response.success) {
          showNotification('Success', `Added "${text}"`);
          adItem.remove();
          // updateKeywordsList(); // This call is redundant
        } else {
          showNotification('Error', response.error || 'Failed to add keyword.');
        }
      } catch (error) {
        showNotification('Error', 'Failed to add keyword.');
      }
    });

    actionsContainer.appendChild(copyBtn);
    actionsContainer.appendChild(addBtn);
    adItem.appendChild(adText);
    adItem.appendChild(limitIndicator);
    adItem.appendChild(actionsContainer);
    return adItem;
  }

  // Function to restore saved suggestions and ads data
  async function restoreSavedData() {
    try {
      const { aiSuggestions, generatedHeadlines, generatedDescriptions, generatedCallToActions } = await new Promise(resolve => {
        chrome.storage.local.get(['aiSuggestions', 'generatedHeadlines', 'generatedDescriptions', 'generatedCallToActions'], resolve);
      });

      // Restore AI keyword suggestions if they exist
      if (aiSuggestions && aiSuggestions.length > 0) {
        displaySuggestions(aiSuggestions);
      }

      // Restore generated ads if they exist
      if (generatedHeadlines && generatedDescriptions && 
          generatedHeadlines.length > 0 && generatedDescriptions.length > 0) {
        const callToActions = generatedCallToActions || [];
        displayAds(generatedHeadlines, generatedDescriptions, callToActions);
      }
    } catch (error) {
      console.error('Error restoring saved data:', error);
    }
  }
  // Initial load
  loadSettings();
  updateKeywordsList();
  restoreSavedData();
  } catch (error) {
    console.error('Error during DOMContentLoaded:', error);
  }
});

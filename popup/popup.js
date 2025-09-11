console.log('Popup script loaded');

// Global error handler for the popup
window.addEventListener('error', (event) => {
  console.error('Unhandled error in popup:', event.error);
  // Optionally, you could display a user-friendly error message here
});

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

  let currentMatchType = 'phrase';

  // Initialize
  loadSettings();
  updateKeywordsList();
  restoreSavedData();

  // Event Listeners
  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
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

  getSuggestionsBtn.addEventListener('click', getAIKeywordSuggestions);

  regenerateBtn.addEventListener('click', getAIKeywordSuggestions);

  generateAdsBtn.addEventListener('click', generateAds);

  regenerateAdsBtn.addEventListener('click', generateAds);

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
        showNotification('Success', 'Export started. Check your downloads.');
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
      const keywordObjects = keywords.map(k => ({ text: k, timestamp: Date.now(), source: 'bulk_paste' }));
      
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
          await updateKeywordsList();
          
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
    chrome.storage.local.get(['capitalizeKeywords', 'gradientStart', 'gradientEnd', 'font', 'fontSize', 'deepseekApiKey'], (result) => {
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
      }
      if (result.fontSize) {
        fontSizeInput.value = result.fontSize;
      }
      if (result.deepseekApiKey) {
        deepseekApiKeyInput.value = result.deepseekApiKey;
      }
      applySettings();
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

  async function updateKeywordsList() {
    console.log('Updating keywords list in popup');
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getKeywords' });
      console.log('Received keywords from background:', response);
      if (response && response.keywords) {
        keywordsContainer.innerHTML = '';
        response.keywords.forEach((keyword) => {
          const keywordItem = document.createElement('div');
          keywordItem.className = 'keyword-item';
          keywordItem.dataset.keyword = keyword.text;

          // Add checkbox for selection
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'keyword-checkbox';
          checkbox.addEventListener('change', (e) => handleKeywordSelection(e, keyword, keywordItem));

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

          keywordItem.appendChild(checkbox);
          keywordItem.appendChild(keywordText);
          keywordItem.appendChild(actions);
          keywordsContainer.appendChild(keywordItem);
        });
      }
    } catch (error) {
      console.error('Failed to update keywords list:', error);
    }
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
      updateKeywordsList();
    } catch (error) {
      console.error('Failed to remove keyword:', error);
    }
  }

  function showNotification(title, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${title.toLowerCase()}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // Listen for real-time keyword updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'keywordsUpdated') {
      updateKeywordsList();
    }
  });

  async function getAIKeywordSuggestions() {
    const { deepseekApiKey, keywords } = await new Promise(resolve => {
      chrome.storage.local.get(['deepseekApiKey', 'keywords'], resolve);
    });

    if (!deepseekApiKey) {
      showNotification('Error', 'Please save your DeepSeek API key in the settings.');
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
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
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
              content: 'You are a Google Ads expert. Generate a list of 20 high-intent keywords based on the provided list. Return only the keywords, separated by newlines.'
            },
            {
              role: 'user',
              content: keywords.map(k => k.text).join('\n')
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const suggestions = data.choices[0].message.content.split('\n').filter(k => k.trim() !== '');
      
      displaySuggestions(suggestions);

    } catch (error) {
      showNotification('Error', 'Failed to get suggestions. Check your API key and network connection.');
      console.error('Error fetching suggestions:', error);
    } finally {
      getSuggestionsBtn.textContent = 'High-Intent Keyword Suggestions';
      getSuggestionsBtn.disabled = false;
      getSuggestionsBtn.classList.remove('loading');
    }
  }

  function displaySuggestions(suggestions) {
    // Save suggestions to Chrome storage for persistence
    chrome.storage.local.set({ aiSuggestions: suggestions });
    
    const suggestionsDetails = document.getElementById('suggestions-details');
    suggestionsContainer.innerHTML = '';
    suggestions.forEach(suggestion => {
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';

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
        const keywordObject = { text: suggestion, timestamp: Date.now(), source: 'ai_suggestion' };
        try {
          const response = await chrome.runtime.sendMessage({ action: 'addKeyword', keyword: keywordObject });
          if (response.success) {
            showNotification('Success', `Added "${suggestion}"`);
            suggestionItem.remove();
            updateKeywordsList();
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
      suggestionItem.appendChild(suggestionText);
      suggestionItem.appendChild(actionsContainer);
      suggestionsContainer.appendChild(suggestionItem);
    });
    suggestionsDetails.classList.remove('hidden');
    suggestionsDetails.open = true;
    regenerateBtn.classList.remove('hidden');
  }

  async function generateAds() {
    const { deepseekApiKey, keywords } = await new Promise(resolve => {
      chrome.storage.local.get(['deepseekApiKey', 'keywords'], resolve);
    });

    if (!deepseekApiKey) {
      showNotification('Error', 'Please save your DeepSeek API key in the settings.');
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
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
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
              content: `You are a Google Ads expert. Generate 20 headlines (max 28 characters), 8 descriptions (max 60 characters), and 8 call-to-action phrases (max 15 characters) based on the provided keywords. The ad copy should focus on benefits, have a clear call to action, and touch on emotional pain points to encourage clicks. IMPORTANT: Call-to-action phrases must be directly related to and contextually relevant to the specific keywords provided. Analyze each keyword to determine the most appropriate action (e.g., for "running shoes" use "Shop Shoes", for "yoga classes" use "Book Class", for "web design" use "Get Quote", for "insurance" use "Get Covered"). Make CTAs keyword-specific rather than generic. ${capitalizeKeywordsCheckbox.checked ? 'CAPITALIZATION: Since the user has enabled keyword capitalization, ensure ALL generated content (headlines, descriptions, and call-to-actions) uses proper title case capitalization where each major word starts with a capital letter.' : ''} Return the response as a JSON object with three keys: "headlines", "descriptions", and "callToActions".`
            },
            {
              role: 'user',
              content: keywords.map(k => capitalizeKeywordsCheckbox.checked ? k.text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : k.text).join('\n')
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const { headlines, descriptions, callToActions } = JSON.parse(data.choices[0].message.content);

      displayAds(headlines, descriptions, callToActions);

    } catch (error) {
      showNotification('Error', 'Failed to generate ads. Check your API key and network connection.');
      console.error('Error generating ads:', error);
    } finally {
      generateAdsBtn.textContent = 'Generate Headlines & Descriptions';
      generateAdsBtn.disabled = false;
      regenerateAdsBtn.disabled = false;
    }
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
      const adItem = createAdItem(headline);
      headlinesContainer.appendChild(adItem);
    });

    descriptions.forEach(description => {
      const adItem = createAdItem(description);
      descriptionsContainer.appendChild(adItem);
    });

    // Display call-to-action phrases
    const ctaContainer = document.getElementById('cta-container');
    ctaContainer.innerHTML = '';
    callToActions.forEach(cta => {
      const adItem = createAdItem(cta);
      ctaContainer.appendChild(adItem);
    });

    adsContainer.classList.remove('hidden');
    regenerateAdsBtn.classList.remove('hidden');
  }

  function createAdItem(text) {
    const adItem = document.createElement('div');
    adItem.className = 'ad-item';

    const adText = document.createElement('span');
    adText.textContent = text;

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'ad-actions';

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
      const keywordObject = { text, timestamp: Date.now(), source: 'ad_generation' };
      try {
        const response = await chrome.runtime.sendMessage({ action: 'addKeyword', keyword: keywordObject });
        if (response.success) {
          showNotification('Success', `Added "${text}"`);
          adItem.remove();
          updateKeywordsList();
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
 } catch (error) {
    console.error('Fatal error during popup initialization:', error);
    document.body.innerHTML = '<div style="padding: 16px; text-align: center;">An unexpected error occurred. Please try again.</div>';
 }
});

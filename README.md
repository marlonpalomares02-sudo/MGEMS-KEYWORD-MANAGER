# Google Ads Keyword Manager

A Chrome extension for efficiently managing and capturing keywords from Google Ads and Keyword Planner.

## Features

- 🔍 Quick keyword capture from Google Ads and Keyword Planner
- 📋 Support for multiple match types (Broad, Phrase, Exact)
- 🔄 Real-time keyword highlighting
- 💾 Store up to 50 keywords locally
- 📊 Track daily and total keyword statistics
- 📥 Easy export functionality
- 🎨 Modern, user-friendly interface

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Navigate to Google Ads or Keyword Planner
2. Highlight any text to capture it as a keyword
3. Use the extension popup to:
   - View captured keywords
   - Change match types
   - Export keywords
   - Clear keyword history

## Match Types

- **Broad Match**: keyword
- **Phrase Match**: "keyword"
- **Exact Match**: [keyword]

## Features

### Keyword Capture
- Highlight text to automatically capture keywords
- Double-click text for quick capture
- Visual feedback when keywords are captured

### Keyword Management
- View all captured keywords in the popup
- See when keywords were captured
- Remove individual keywords
- Clear all keywords

### Export Options
- Copy keywords to clipboard
- Export with selected match type
- Bulk paste support

## Development

### Project Structure
```
├── background_scripts/
│   └── background.js
├── content_scripts/
2│   ├── content.css
│   ├── content.js
│   └── keywordPlanner.css
├── icons/
│   └── [icon files]
├── popup/
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
├── .env
├── manifest.json
└── README.md
```

## License

This project is licensed under the MIT License.

## Support

For issues and feature requests, please create an issue in the repository.
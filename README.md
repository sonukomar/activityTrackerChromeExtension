# Activity Tracker Chrome Extension

A comprehensive Chrome extension that tracks user browsing activity, media device usage (camera/microphone), form autofill detection, and sensitive field interactions. All collected data is analyzed by an LLM to provide personalized behavior insights and productivity recommendations.

## Features

- **📊 Browsing Activity Tracking** - Monitors time spent on different websites and domains
- **🎥 Camera & Microphone Access Detection** - Tracks when and how long camera/microphone is accessed
- **📝 Autofill Detection** - Identifies and logs when browser autofill is used on web forms
- **🔒 Sensitive Field Detection** - Detects pages with password, email, and payment fields
- **🧠 LLM-Powered Analysis** - Uses local LLM (Ollama) to generate personalized behavior insights
- **📈 Visual Dashboard** - Clean, modern dashboard displaying activity summary and AI analysis

## How It Works

### Architecture

```
Content Script (Isolated World)
    ↓
Injected Script (Main World)
    ↓
Background Service Worker
    ↓
Chrome Storage (Local)
    ↓
Dashboard
    ↓
Backend Server
    ↓
LLM (Ollama)
```

### Components

1. **content.js** - Content script that:
   - Injects a script into the main page context to intercept `getUserMedia` calls
   - Detects autofill events via CSS animations and input styling
   - Identifies sensitive form fields
   - Communicates with the background worker

2. **background.js** - Service worker that:
   - Listens for messages from content scripts
   - Stores all tracking data in Chrome's local storage
   - Organizes data by type (media access, autofill, sensitive fields, page visits)

3. **dashboard.html/dashboard.js** - UI dashboard that:
   - Displays browsing activity summary
   - Shows time spent per domain
   - Fetches and displays LLM analysis

4. **backend.js** - Node.js server that:
   - Receives activity and tracking data from the dashboard
   - Generates comprehensive summaries of tracked events
   - Sends formatted data to the LLM (Ollama)
   - Returns AI-generated analysis

5. **popup.html/popup.js** - Extension popup that:
   - Opens the dashboard when clicked

## Installation

### Prerequisites

- Chrome browser (Manifest V3 compatible)
- Node.js (for backend server)
- Ollama with `llama3.2:3b-instruct-q8_0` model installed and running

### Setup

1. **Install Ollama**
   ```bash
   # Download from https://ollama.ai
   # Installation instructions for macOS/Windows/Linux
   ```

2. **Run Ollama Server**
   ```bash
   # Start ollama in the background
   ollama serve
   # Download the model (if not already installed)
   ollama pull llama3.2:3b-instruct-q8_0
   ```

3. **Install Extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select the `/Users/sonukumar/Documents/chrome_extension` folder

4. **Start Backend Server**
   ```bash
   cd /Users/sonukumar/Documents/chrome_extension
   npm install express cors node-fetch
   node backend.js
   # Server will run on http://localhost:3000
   ```

## Usage

### Basic Usage

1. **Extension Popup**
   - Click the extension icon in Chrome toolbar
   - Click "Open Dashboard"

2. **Dashboard**
   - View total screen time across all websites
   - See time breakdown per domain
   - View AI-generated insights about your browsing behavior

### What Gets Tracked

#### Browsing Activity
- URL and domain of visited websites
- Duration spent on each site
- Tab switching events

#### Media Device Access
- When camera/microphone is accessed
- Duration of access
- Access denied/permission errors
- Media type (video, audio, or both)

#### Form Autofill
- Fields that are autofilled by the browser
- Field types (email, password, text, etc.)
- Form submissions with autofilled data
- Number of autofilled fields per submission

#### Sensitive Fields
- Password input fields
- Email input fields
- Payment/credit card fields
- Count of sensitive fields on each page

## Data Storage

All data is stored locally in Chrome's storage:

```javascript
{
  activity: {
    "https://website.com": 3600000,  // milliseconds
    "https://another.com": 1800000
  },
  tracking: {
    mediaAccess: [
      {
        event: "started",
        mediaType: ["camera"],
        url: "https://meet.google.com",
        domain: "meet.google.com",
        timestamp: 1709046000000
      }
    ],
    autofill: [
      {
        event: "detected",
        fieldType: "email",
        fieldName: "email",
        url: "https://example.com/login",
        domain: "example.com",
        timestamp: 1709046100000
      }
    ],
    sensitiveFields: [
      {
        fieldType: "password",
        count: 1,
        url: "https://example.com/login",
        domain: "example.com",
        timestamp: 1709046050000
      }
    ],
    pageVisits: [
      {
        url: "https://example.com",
        domain: "example.com",
        timestamp: 1709046000000
      }
    ]
  }
}
```

## LLM Analysis

The backend sends a comprehensive prompt to Ollama that includes:

- **Browsing Activity** - Sites visited and time spent
- **Media Device Access** - Camera/microphone usage statistics
- **Autofill Usage** - Form autofill patterns and frequencies
- **Sensitive Fields** - Pages with sensitive information encountered

The LLM provides:

1. **Behaviour Summary** - Key patterns in browsing habits
2. **Privacy & Security Considerations** - Notable use of sensitive features
3. **Productivity Assessment** - How time is distributed
4. **Engagement Patterns** - Notable interactions with forms
5. **Improvement Suggestions** - Privacy-respecting recommendations

## Debugging

### View Service Worker Logs

1. Go to `chrome://extensions/`
2. Find "Activity Tracker" and click "Details"
3. Click "Inspect views" → "service_worker"
4. Check console for debug messages

### Check Stored Data

In the browser console:
```javascript
chrome.storage.local.get(null, (data) => {
  console.log(data);
});
```

### View Backend Logs

Check the terminal where you ran `node backend.js` for request/response logs.

## File Structure

```
chrome_extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (tracks events)
├── content.js            # Content script (detects events)
├── popup.html            # Extension popup UI
├── popup.js              # Popup script
├── dashboard.html        # Dashboard UI
├── dashboard.js          # Dashboard script
├── backend.js            # Node.js server
└── README.md             # This file
```

## Manifest Permissions

- `tabs` - Access to tab information and activity
- `storage` - Store tracking data locally
- `idle` - Detect user idle state

## Browser Compatibility

- Chrome 88+
- Edge 88+ (Chromium-based)
- Other Chromium browsers supporting Manifest V3

## Privacy Considerations

⚠️ **Important**: This extension stores all activity data locally on your device. 

- All data is stored in Chrome's local storage
- Data is only sent to your local LLM server for analysis
- No data is sent to external servers
- You can clear all data by clearing extension data in Chrome settings
- The dashboard is only accessible locally within Chrome

## Technical Details

### Why Injected Script for Media Tracking?

Manifest V3 content scripts run in an isolated world, preventing direct access to `navigator.mediaDevices`. The injected script runs in the page's main context where it can intercept API calls before they execute.

### Autofill Detection Method

Autofill detection uses:
1. CSS animation triggers on `:-webkit-autofill` pseudo-class
2. Computed style checks for `webkitAutofillBackground` and `webkitAutofillTextFill`
3. Form submission monitoring to count autofilled fields

### Message Flow

1. Page event occurs (media, autofill, form submission)
2. Injected script detects it via API interception or DOM mutation
3. Posts message to content script via `window.postMessage`
4. Content script forwards to background via `chrome.runtime.sendMessage`
5. Background processes and stores in Chrome storage
6. Dashboard retrieves and displays data

## Troubleshooting

### Camera/Microphone Not Being Detected

1. Check browser console for errors
2. Verify Ollama server is running with correct model
3. Inspect Service Worker logs at `chrome://extensions`
4. Ensure you granted microphone/camera permission to the website

### Dashboard Showing No Data

1. Clear extension data: `chrome://extensions` → Details → Clear data
2. Reload extension
3. Visit some websites and interact with them
4. Wait a few seconds for data to be stored

### Backend Connection Error

1. Verify backend is running: `http://localhost:3000`
2. Check Node.js is installed correctly
3. Ensure port 3000 is not in use
4. Check backend terminal for error messages

### Ollama Connection Error

1. Start Ollama: `ollama serve`
2. Pull model: `ollama pull llama3.2:3b-instruct-q8_0`
3. Verify it's running on `http://localhost:11434`
4. Check network connectivity

## Future Enhancements

- [ ] Export tracking data to CSV/JSON
- [ ] Time range filtering in dashboard
- [ ] Custom analysis prompts
- [ ] Weekly/monthly reports
- [ ] Keyboard/mouse activity tracking
- [ ] Screenshot-based analysis
- [ ] Multi-device sync
- [ ] Advanced filtering and search

## License

MIT

## Support

For issues or questions, check:
1. Console logs (browser and backend)
2. Service Worker logs
3. Stored data in Chrome storage
4. Ollama server status

---

**Last Updated**: February 27, 2026
# activityTrackerChromeExtension

# Activity Tracker Chrome Extension

A comprehensive Chrome extension that tracks user browsing activity, media device usage (camera/microphone), form autofill detection, and sensitive field interactions. All collected data is analyzed by an LLM to provide personalized behavior insights and productivity recommendations.

## Features

- **📊 Browsing Activity Tracking** - Monitors time spent on different websites and domains
- **� IP Address & Geolocation Tracking** - Captures IP addresses, country, and ISP information for visited sites
- **🔍 Risk Analysis** - Professional risk assessment for each domain including VPN/Proxy detection, hosting provider detection, and high-risk country warnings
- **🎥 Camera & Microphone Access Detection** - Tracks when and how long camera/microphone is accessed
- **📝 Autofill Detection** - Identifies and logs when browser autofill is used on web forms
- **🔒 Sensitive Field Detection** - Detects pages with password, email, and payment fields
- **🧠 LLM-Powered Analysis** - Uses local LLM (Ollama) to generate personalized behavior insights including IP-based risk assessment
- **📈 Professional Dashboard** - Modern, polished dashboard with gradient design and comprehensive analytics
- **📥 Export Reports** - Download professional HTML reports with IP addresses and risk analysis data

## New: IP Address & Risk Analysis

### IP Address Tracking

The extension now captures IP address information for every visited website:

- **IP Address** - The resolved IP address of the domain
- **Geolocation** - Country and ISP/Organization information
- **Visit Count** - Number of times the domain was visited

### Risk Assessment

Each domain receives a professional risk assessment based on multiple factors:

#### Risk Scoring

- **LOW RISK** (0-14 points) - Standard websites with normal access patterns
- **MEDIUM RISK** (15-39 points) - Sites using VPN/Proxy or from unfamiliar regions
- **HIGH RISK** (40+ points) - Sites with multiple risk indicators or from high-risk countries

#### Risk Factors Analyzed

- 🔒 **VPN/Proxy Detection** - Identifies if the site is accessed through VPN or proxy services (+15 points)
- 🖥️ **Data Center/Hosting** - Detects if the IP belongs to a hosting provider or data center (+10 points)
- 📱 **Mobile Network** - Identifies mobile carrier networks (+5 points)
- ⚠️ **High-Risk Countries** - Flags access from countries with heightened security concerns (+30 points)
- ❌ **API Lookup Failures** - Gracefully handles services that cannot resolve (shows "Unknown")

### Dashboard IP Analysis Card

The dashboard features a dedicated **"IP Address & Risk Analysis"** card showing:

- Domain name with professional layout
- Resolved IP address
- Geographic location (country)
- ISP/Organization details
- Visit frequency
- Color-coded risk level badge (green/yellow/red)
- Detailed risk factors and security indicators

### Export Reports

Generate and download professional HTML reports containing:

- Complete IP address information for all visited domains
- Risk level assessment for each site
- Formatted table layout suitable for presentations
- Generated timestamp and security disclaimer

## How It Works

### Architecture

```
Content Script (Isolated World)
    ↓
Injected Script (Main World)
    ↓
Background Service Worker (IP Lookup via ip-api.com + DNS.Google)
    ↓
Chrome Storage (Local)
    ↓
Dashboard (Risk Assessment & Display)
    ↓
Backend Server (LLM Analysis with IP Data)
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
   - Performs IP address lookups using dual-strategy approach:
     - Primary: ip-api.com for direct domain/IP geolocation
     - Fallback: Google DNS API for DNS resolution, then geolocation lookup
   - Handles API rate limits (429) and access denials (403) gracefully
   - Caches successful IP lookups and failed attempts (1 hour)
   - Stores all tracking data in Chrome's local storage with associated IP information
   - Organizes data by type (media access, autofill, sensitive fields, page visits with IPs)

3. **dashboard.html/dashboard.js** - UI dashboard that:
   - Displays comprehensive browsing activity summary with site count statistics
   - Shows time spent per domain with percentage breakdown
   - Displays IP address and geolocation information for all visited sites
   - Performs professional risk assessment on each domain/IP
   - Shows color-coded risk levels (LOW/MEDIUM/HIGH) with detailed factors
   - Implements dynamic CSS custom properties for responsive bar charts
   - Provides export functionality to download professional HTML reports
   - Fetches and displays LLM analysis incorporating IP and risk data

4. **backend.js** - Node.js server that:
   - Receives activity and tracking data from the dashboard including IP information
   - Generates comprehensive summaries of tracked events with IP/geolocation context
   - Includes IP-based risk analysis in the data sent to LLM
   - Sends formatted data to the LLM (Ollama) for intelligent analysis
   - Returns AI-generated analysis that considers IP patterns and risk factors

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

#### IP Address & Geolocation Tracking

- IP address of each visited domain
- Country and geographic location
- ISP and organization information
- VPN/Proxy detection
- Hosting provider identification
- Mobile network detection

#### Risk Assessment

- Risk scoring for each domain (LOW/MEDIUM/HIGH)
- Security factors (VPN usage, hosting providers, geographic risk)
- Risk factor analysis and explanations

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
- **IP & Geolocation Data** - IP addresses, countries, ISPs, and geolocation context for visited sites
- **Risk Assessment** - VPN/Proxy usage, hosting providers, geographic risk factors
- **Media Device Access** - Camera/microphone usage statistics
- **Autofill Usage** - Form autofill patterns and frequencies
- **Sensitive Fields** - Pages with sensitive information encountered

The LLM provides:

1. **Behaviour Summary** - Key patterns in browsing habits
2. **Privacy & Security Considerations** - Notable use of sensitive features and IP-based risks
3. **IP & Geographic Analysis** - Analysis of access patterns and locations
4. **Productivity Assessment** - How time is distributed
5. **Risk Assessment** - Media usage, autofill patterns, VPN/Proxy usage, and anomalies
6. **Engagement Patterns** - Notable interactions with forms
7. **Improvement Suggestions** - Privacy-respecting recommendations

## API Services & Limitations

### IP Geolocation APIs

The extension uses the following services for IP address lookups:

1. **ip-api.com** (Primary)
   - Direct domain/IP to geolocation resolution
   - Provides: Country, ISP, VPN/Proxy detection, hosting provider info
   - Rate limit: 45 requests/minute (free tier)
   - Cost: Free

2. **Google DNS API** (Fallback)
   - DNS resolution for domains to IP addresses
   - Used when primary API is rate-limited or blocked
   - Cost: Free

### Caching Strategy

- Successful lookups are cached indefinitely
- Failed lookups are cached for 1 hour to avoid repeated API calls
- Reduces API usage and improves dashboard response time

### Known Limitations

- Some domains may return "Unknown" if:
  - The API is rate-limited (429 error)
  - The domain cannot be resolved
  - The domain blocks the geolocation service
- VPN/Proxy detection is based on known IP ranges and may not be 100% accurate
- High-risk country list is configurable and should be customized per use case

## Debugging

### View Service Worker Logs

1. Go to `chrome://extensions/`
2. Find "Activity Tracker" and click "Details"
3. Click "Inspect views" → "service_worker"
4. Check console for debug messages including IP lookup results

### Check Stored Data

In the browser console:

```javascript
// View all stored data including IP information
chrome.storage.local.get(null, (data) => {
  console.log(data);
  console.log("Page visits with IPs:", data.tracking.pageVisits);
});
```

### View Backend Logs

Check the terminal where you ran `node backend.js` for request/response logs including IP data.

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

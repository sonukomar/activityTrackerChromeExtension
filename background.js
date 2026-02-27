let activeTabId = null;
let startTime = null;
const ipCache = {}; // Cache IP lookups
const failedLookups = {}; // Track failed lookups to avoid repeated attempts
const API_TIMEOUT = 3000; // 3 second timeout for API calls

// Helper function to extract domain from URL
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Simple DNS-based IP lookup using public DNS API
async function lookupWithDNS(domain) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(
      `https://dns.google/resolve?name=${domain}&type=A`,
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`DNS lookup failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.Answer && data.Answer.length > 0) {
      // Get the first A record (IP address)
      const ipRecord = data.Answer.find((r) => r.type === 1);
      if (ipRecord) {
        console.log(`DNS lookup successful for ${domain}: ${ipRecord.data}`);
        return ipRecord.data; // Return the IP address
      }
    }

    return null;
  } catch (error) {
    console.warn(`DNS lookup failed for ${domain}:`, error.message);
    return null;
  }
}

// Geolocation lookup using ip-api.com
async function lookupGeolocation(ip) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(
      `https://ip-api.com/json/${ip}?fields=query,country,isp,org,mobile,proxy,hosting`,
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    if (response.status === 429) {
      console.warn("IP-API rate limit reached, using basic lookup");
      return null; // Rate limited
    }

    if (response.status === 403) {
      console.warn("IP-API blocked this request");
      return null; // Forbidden
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "success") {
      console.warn(`Geolocation lookup failed: ${data.message}`);
      return null;
    }

    return {
      ip: data.query || ip,
      country: data.country || "Unknown",
      isp: data.isp || "Unknown",
      org: data.org || "Unknown",
      isVPN: data.proxy || false,
      isProxy: data.proxy || false,
      isBogon: false,
      isHosting: data.hosting || false,
      isMobile: data.mobile || false,
    };
  } catch (error) {
    console.warn(`Geolocation lookup failed for ${ip}:`, error.message);
    return null;
  }
}

// Fetch IP address for a domain with fallback strategies
async function getIPAddress(domain) {
  if (ipCache[domain]) {
    return ipCache[domain];
  }

  // Check if we recently failed to lookup this domain
  if (failedLookups[domain] && Date.now() - failedLookups[domain] < 3600000) {
    // Don't retry for 1 hour after a failed lookup
    return {
      ip: "Unknown",
      country: "Unknown",
      isp: "Unknown",
      error: "lookup_cached_failed",
    };
  }

  try {
    // Handle localhost specially
    if (domain === "localhost" || domain === "127.0.0.1") {
      ipCache[domain] = {
        ip: "127.0.0.1",
        country: "Local",
        isp: "Localhost",
        isVPN: false,
        isProxy: false,
        isBogon: true,
      };
      return ipCache[domain];
    }

    // Strategy 1: Try combined lookup with ip-api.com directly on domain
    let ipData = await lookupGeolocation(domain);

    if (!ipData) {
      // Strategy 2: Try DNS lookup first, then get geolocation
      const ip = await lookupWithDNS(domain);

      if (ip) {
        ipData = await lookupGeolocation(ip);

        if (!ipData) {
          // If geolocation fails, at least return the IP
          ipData = {
            ip: ip,
            country: "Unknown",
            isp: "Unknown",
            org: "Unknown",
            isVPN: false,
            isProxy: false,
            isBogon: false,
            isHosting: false,
            isMobile: false,
          };
        }
      }
    }

    if (!ipData) {
      // Mark as failed lookup
      failedLookups[domain] = Date.now();
      console.warn(`Could not lookup IP for ${domain} using any method`);
      return {
        ip: "Unknown",
        country: "Unknown",
        isp: "Unknown",
        error: "lookup_failed",
      };
    }

    ipCache[domain] = ipData;
    console.log(`IP lookup successful for ${domain}:`, ipData);
    return ipData;
  } catch (error) {
    failedLookups[domain] = Date.now();
    console.error(`Failed to get IP for ${domain}:`, error.message);
    return {
      ip: "Unknown",
      country: "Unknown",
      isp: "Unknown",
      error: error.message,
    };
  }
}

function trackPreviousTab() {
  if (!activeTabId || !startTime) return;

  const duration = Date.now() - startTime;

  chrome.tabs.get(activeTabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) return;

    saveActivity(tab.url, duration);
  });
}

function saveActivity(url, duration) {
  chrome.storage.local.get(["activity"], (result) => {
    const activity = result.activity || {};

    if (!activity[url]) {
      activity[url] = 0;
    }

    activity[url] += duration;

    chrome.storage.local.set({ activity });
  });
}

// ===============================
// MESSAGE HANDLER FOR TRACKING
// ===============================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, url, domain, timestamp, ...payload } = message;

  console.log("Background received message:", { type, domain, payload });

  // Initialize tracking storage
  chrome.storage.local.get(["tracking"], (result) => {
    const tracking = result.tracking || {
      mediaAccess: [],
      autofill: [],
      sensitiveFields: [],
      pageVisits: [],
    };

    switch (type) {
      case "PAGE_VISIT":
        // Get IP address for the domain and store with visit
        getIPAddress(domain).then((ipData) => {
          tracking.pageVisits.push({
            url,
            domain,
            timestamp,
            ipData,
          });
          chrome.storage.local.set({ tracking });
          console.log("Tracked PAGE_VISIT with IP:", ipData);
        });
        break;

      case "MEDIA_ACCESS_STARTED":
        tracking.mediaAccess.push({
          event: "started",
          mediaType: payload.mediaType,
          url,
          domain,
          timestamp,
        });
        console.log("Tracked MEDIA_ACCESS_STARTED:", payload.mediaType);
        break;

      case "MEDIA_ACCESS_ENDED":
        tracking.mediaAccess.push({
          event: "ended",
          mediaType: payload.mediaType,
          duration: payload.duration,
          url,
          domain,
          timestamp,
        });
        console.log("Tracked MEDIA_ACCESS_ENDED:", payload.mediaType);
        break;

      case "MEDIA_ACCESS_DENIED":
        tracking.mediaAccess.push({
          event: "denied",
          error: payload.error,
          url,
          domain,
          timestamp,
        });
        console.log("Tracked MEDIA_ACCESS_DENIED");
        break;

      case "AUTOFILL_DETECTED":
        tracking.autofill.push({
          event: "detected",
          fieldType: payload.fieldType,
          fieldName: payload.fieldName,
          placeholder: payload.placeholder,
          url,
          domain,
          timestamp,
        });
        console.log("Tracked AUTOFILL_DETECTED");
        break;

      case "AUTOFILL_SUBMITTED":
        tracking.autofill.push({
          event: "submitted",
          autofilledFieldCount: payload.autofilledFieldCount,
          fields: payload.fields,
          url,
          domain,
          timestamp,
        });
        console.log("Tracked AUTOFILL_SUBMITTED");
        break;

      case "SENSITIVE_FIELD_DETECTED":
        tracking.sensitiveFields.push({
          fieldType: payload.fieldType,
          count: payload.count,
          url,
          domain,
          timestamp,
        });
        console.log("Tracked SENSITIVE_FIELD_DETECTED");
        break;
    }

    // Only save to storage for non-PAGE_VISIT events (PAGE_VISIT handles its own save)
    if (type !== "PAGE_VISIT") {
      chrome.storage.local.set({ tracking });
    }

    sendResponse({ received: true });
  });

  return true; // Keep message channel open for async operations
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  trackPreviousTab();

  const tab = await chrome.tabs.get(activeInfo.tabId);

  activeTabId = tab.id;
  startTime = Date.now();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.status === "complete") {
    trackPreviousTab();
    startTime = Date.now();
  }
});

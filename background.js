let activeTabId = null;
let startTime = null;

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
        tracking.pageVisits.push({
          url,
          domain,
          timestamp,
        });
        console.log("Tracked PAGE_VISIT");
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

    chrome.storage.local.set({ tracking });
  });

  sendResponse({ received: true });
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

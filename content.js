console.log("Content script loaded");
// ===============================
// CONTENT SCRIPT
// Tracks:
// - Page visits
// - Camera / Microphone usage
// - Autofill detection
// ===============================

// Send message safely to background
function sendToBackground(type, payload = {}) {
  chrome.runtime.sendMessage({
    type,
    url: window.location.href,
    domain: window.location.hostname,
    timestamp: Date.now(),
    ...payload,
  });
}

// -----------------------------------
// 1️⃣ Track Page Visit
// -----------------------------------
sendToBackground("PAGE_VISIT");

// -----------------------------------
// 2️⃣ Track Camera / Microphone Usage (Injected Script)
// -----------------------------------
// Inject a script into the main world to intercept getUserMedia
(function injectMediaTracking() {
  const script = document.createElement("script");
  script.textContent = `
    (function() {
      if (!navigator.mediaDevices) {
        console.log("mediaDevices not available");
        return;
      }

      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      const startTimes = new WeakMap();

      navigator.mediaDevices.getUserMedia = async function(constraints) {
        const startTime = Date.now();

        let type = [];
        if (constraints && constraints.video) type.push("camera");
        if (constraints && constraints.audio) type.push("microphone");

        console.log("getUserMedia called with:", {constraints, type});

        // Send message to content script
        window.postMessage({
          type: "MEDIA_ACCESS_STARTED",
          mediaType: type,
          timestamp: startTime,
        }, "*");

        try {
          const stream = await originalGetUserMedia(constraints);
          console.log("getUserMedia succeeded");

          // Track when each track ends
          stream.getTracks().forEach((track) => {
            const trackStartTime = startTime;
            const trackKind = track.kind; // 'video' or 'audio'

            const originalStop = track.stop.bind(track);
            track.stop = function() {
              const duration = Date.now() - trackStartTime;
              console.log("Track stopped:", {trackKind, duration});
              
              window.postMessage({
                type: "MEDIA_ACCESS_ENDED",
                mediaType: trackKind,
                duration: duration,
                timestamp: Date.now(),
              }, "*");

              return originalStop();
            };

            // Also handle onended event
            track.onended = function() {
              const duration = Date.now() - trackStartTime;
              console.log("Track ended:", {trackKind, duration});

              window.postMessage({
                type: "MEDIA_ACCESS_ENDED",
                mediaType: trackKind,
                duration: duration,
                timestamp: Date.now(),
              }, "*");
            };
          });

          return stream;
        } catch (err) {
          console.log("getUserMedia denied:", err.message);
          window.postMessage({
            type: "MEDIA_ACCESS_DENIED",
            error: err.message,
            timestamp: Date.now(),
          }, "*");

          throw err;
        }
      };
    })();
  `;

  (document.head || document.documentElement).appendChild(script);
  script.remove();
})();

// Listen for messages from injected script
window.addEventListener("message", (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  const { type } = event.data;

  if (
    type === "MEDIA_ACCESS_STARTED" ||
    type === "MEDIA_ACCESS_ENDED" ||
    type === "MEDIA_ACCESS_DENIED"
  ) {
    const { mediaType, duration, error, timestamp } = event.data;

    const payload = {
      mediaType,
      ...(duration && { duration }),
      ...(error && { error }),
    };

    console.log("Content script received media event:", { type, payload });
    sendToBackground(type, payload);
  }
});

// -----------------------------------
// 3️⃣ Detect Autofill Usage
// -----------------------------------
(function detectAutofill() {
  const autofilledFields = new Set();

  // Detect :-webkit-autofill style changes
  document.addEventListener("animationstart", function (e) {
    if (e.animationName === "onAutoFillStart") {
      const el = e.target;
      if (el.matches("input, textarea")) {
        autofilledFields.add(el);
        sendToBackground("AUTOFILL_DETECTED", {
          fieldType: el.type || "text",
          fieldName: el.name || null,
          placeholder: el.placeholder || null,
          action: "autofilled",
        });
      }
    }
  });

  // Also track manual input that might be autofilled
  document.addEventListener("input", function (e) {
    const el = e.target;

    if (el.matches("input, textarea")) {
      // Check for browser autofill
      const style = window.getComputedStyle(el);
      const isAutofilledStyle =
        style.webkitAutofillBackground || style.webkitAutofillTextFill;

      if (isAutofilledStyle && !autofilledFields.has(el)) {
        autofilledFields.add(el);
        sendToBackground("AUTOFILL_DETECTED", {
          fieldType: el.type || "text",
          fieldName: el.name || null,
          placeholder: el.placeholder || null,
          action: "autofilled",
        });
      }
    }
  });

  // Monitor for form submissions with autofilled data
  document.addEventListener("submit", function (e) {
    const form = e.target;
    const inputs = form.querySelectorAll("input, textarea");
    const autofilledInputs = [];

    inputs.forEach((input) => {
      if (autofilledFields.has(input)) {
        autofilledInputs.push({
          type: input.type || "text",
          name: input.name || null,
        });
      }
    });

    if (autofilledInputs.length > 0) {
      sendToBackground("AUTOFILL_SUBMITTED", {
        autofilledFieldCount: autofilledInputs.length,
        fields: autofilledInputs,
      });
    }
  });

  // Add CSS animation for autofill detection
  const style = document.createElement("style");
  style.textContent = `
    @keyframes onAutoFillStart { from {outline: 5px auto -webkit-focus-ring-color;} to {outline: 5px auto -webkit-focus-ring-color;} }
    @keyframes onAutoFillCancel { from {outline: 5px auto -webkit-focus-ring-color;} to {outline: 5px auto -webkit-focus-ring-color;} }
    input:-webkit-autofill { animation-name: onAutoFillStart; }
    input:not(:-webkit-autofill) { animation-name: onAutoFillCancel; }
  `;
  document.head.appendChild(style);
})();

// -----------------------------------
// 4️⃣ Detect Sensitive Input Pages
// -----------------------------------
(function detectSensitivePages() {
  const passwordInputs = document.querySelectorAll("input[type='password']");
  const emailInputs = document.querySelectorAll("input[type='email']");
  const creditCardInputs = document.querySelectorAll(
    "input[autocomplete*='card'], input[name*='card']",
  );

  if (passwordInputs.length > 0) {
    sendToBackground("SENSITIVE_FIELD_DETECTED", {
      fieldType: "password",
      count: passwordInputs.length,
    });
  }

  if (emailInputs.length > 0) {
    sendToBackground("SENSITIVE_FIELD_DETECTED", {
      fieldType: "email",
      count: emailInputs.length,
    });
  }

  if (creditCardInputs.length > 0) {
    sendToBackground("SENSITIVE_FIELD_DETECTED", {
      fieldType: "payment",
      count: creditCardInputs.length,
    });
  }
})();

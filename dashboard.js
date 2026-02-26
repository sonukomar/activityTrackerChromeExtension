function formatTime(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;

  const hours = (minutes / 60).toFixed(1);
  return `${hours} hr`;
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function showInsightsLoading() {
  const container = document.getElementById("insights");

  container.innerHTML = `
        <div style="font-size:14px; color:#6e6e73;">
            Analyzing behaviour…
        </div>
    `;
}

function displayAnalysis(text) {
  const container = document.getElementById("insights");

  const parsed = parseMarkdown(text);

  container.innerHTML = `
        <div class="insight-content">
            ${parsed}
        </div>
    `;
}

function displayAnalysisError() {
  const container = document.getElementById("insights");

  container.innerHTML = `
        <div style="font-size:14px; color:#ff3b30;">
            Unable to generate insights
        </div>
    `;
}

chrome.storage.local.get(
  ["activity", "cachedAnalysis", "tracking"],
  (result) => {
    displayAnalysis("Loading insights...");
    const rawActivity = result.activity || {};
    const tracking = result.tracking || {
      mediaAccess: [],
      autofill: [],
      sensitiveFields: [],
      pageVisits: [],
    };
    const domainActivity = {};

    Object.entries(rawActivity).forEach(([url, time]) => {
      const domain = getDomain(url);

      if (!domainActivity[domain]) {
        domainActivity[domain] = 0;
      }

      domainActivity[domain] += time;
    });

    const sorted = Object.entries(domainActivity).sort((a, b) => b[1] - a[1]);

    const container = document.getElementById("report");
    const summary = document.getElementById("summary");

    container.innerHTML = "";

    if (sorted.length === 0) {
      container.innerHTML = "No activity yet";
      return;
    }

    const totalTime = sorted.reduce((sum, [, t]) => sum + t, 0);
    summary.textContent = `Total Screen Time: ${formatTime(totalTime)}`;

    const labels = [];
    const data = [];

    sorted.forEach(([domain, time]) => {
      const percentage = (time / totalTime) * 100;

      labels.push(domain);
      data.push(time);

      const div = document.createElement("div");
      div.className = "site";

      div.innerHTML = `
        <div class="site-header">
            <span>${domain}</span>
            <span class="time">${formatTime(time)}</span>
        </div>
        <div class="bar">
            <div class="bar-fill" style="width:${percentage}%"></div>
        </div>
    `;

      container.appendChild(div);
    });

    //   new Chart(document.getElementById("chart"), {
    //     type: "doughnut",
    //     data: {
    //       labels,
    //       datasets: [{ data, borderWidth: 0 }],
    //     },
    //     options: {
    //       plugins: { legend: { position: "bottom" } },
    //       cutout: "65%",
    //     },
    //   });

    // ✅ Smart LLM Usage Strategy
    const cached = result.cachedAnalysis;

    if (cached) {
      displayAnalysis(cached); // Instant UI
    } else {
      showInsightsLoading();
    }

    requestAnalysis(domainActivity, tracking);
  },
);

function parseMarkdown(md) {
  return md
    .replace(/^## (.*$)/gim, '<div class="section-title">$1</div>')
    .replace(/^\- (.*$)/gim, '<div class="bullet">• $1</div>')
    .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function requestAnalysis(activity, tracking) {
  fetch("http://localhost:3000/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activity, tracking }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Backend error");
      return res.json();
    })
    .then((data) => {
      if (!data.analysis) throw new Error("Invalid response");

      displayAnalysis(data.analysis);

      // ✅ Cache result (huge performance win)
      chrome.storage.local.set({
        cachedAnalysis: data.analysis,
      });
    })
    .catch((err) => {
      console.error("LLM Error:", err);
      displayAnalysisError();
    });
}

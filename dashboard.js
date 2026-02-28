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

// Risk Assessment Function
function assessIPRisk(ipData) {
  let riskScore = 0;
  let riskFactors = [];

  if (!ipData || ipData.ip === "Unknown") {
    const errorMsg = ipData?.error
      ? `Lookup failed (${ipData.error})`
      : "Unable to verify IP information";
    return {
      level: "low",
      score: 0,
      factors: [errorMsg],
    };
  }

  // Localhost/Local network
  if (
    ipData.isBogon &&
    (ipData.country === "Local" || ipData.ip === "127.0.0.1")
  ) {
    riskFactors.push("Local network - Localhost/internal access");
    riskFactors.push(`IP: ${ipData.ip}`);
    return { level: "low", score: 0, factors: riskFactors };
  }

  // VPN Detection
  if (ipData.isVPN || ipData.isProxy) {
    riskScore += 15;
    riskFactors.push(
      "VPN/Proxy Detected - Connected through VPN or proxy service",
    );
  }

  // Hosting Provider Detection
  if (ipData.isHosting) {
    riskScore += 10;
    riskFactors.push("Data Center/Hosting - Server-based access");
  }

  // Mobile Network
  if (ipData.isMobile) {
    riskScore += 5;
    riskFactors.push("Mobile Network - Accessed from mobile device/carrier");
  }

  // Known high-risk countries (example list)
  const highRiskCountries = ["North Korea", "Iran", "Syria"];
  if (highRiskCountries.includes(ipData.country)) {
    riskScore += 30;
    riskFactors.push(`High-risk country: ${ipData.country}`);
  }

  // Add base information for all IPs
  riskFactors.push(`Location: ${ipData.country || "Unknown"}`);
  if (ipData.org) {
    riskFactors.push(`Organization: ${ipData.org}`);
  } else if (ipData.isp) {
    riskFactors.push(`ISP: ${ipData.isp}`);
  }

  let level = "low";
  if (riskScore >= 40) {
    level = "high";
  } else if (riskScore >= 15) {
    level = "medium";
  }

  return { level, score: riskScore, factors: riskFactors };
}

function showInsightsLoading() {
  const container = document.getElementById("insights");

  container.innerHTML = `
        <div class="analysis-loading">
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
        <div class="analysis-error">
            Unable to generate insights
        </div>
    `;
}

function displayIPAnalysis(pageVisits) {
  const container = document.getElementById("ipAnalysis");

  if (!pageVisits || pageVisits.length === 0) {
    container.innerHTML =
      '<div class="no-visits">No page visits tracked yet</div>';
    return;
  }

  // Group visits by domain
  const domainMap = {};
  pageVisits.forEach((visit) => {
    const domain = getDomain(visit.url || visit.domain);
    if (!domainMap[domain]) {
      domainMap[domain] = {
        url: visit.url,
        domain: domain,
        ipData: visit.ipData,
        visitCount: 0,
      };
    }
    domainMap[domain].visitCount++;
  });

  let html = "";
  Object.entries(domainMap).forEach(([domain, data]) => {
    console.log(`Assessing risk for ${domain} data:`, data);
    console.log(`Assessing risk for ${domain} with IP data:`, data.ipData);
    const risk = assessIPRisk(data.ipData);
    const badgeClass = `risk-${risk.level}`;

    html += `
      <div class="ip-entry">
        <div class="ip-entry-header">
          <div class="domain-name">${domain}</div>
          <div class="risk-badge ${badgeClass}">${risk.level} RISK</div>
        </div>
        <div class="ip-details">
          <div class="detail-item">
            <div class="detail-label">IP Address</div>
            <div class="detail-value">${data.ipData?.ip || "Unknown"}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Country</div>
            <div class="detail-value">${data.ipData?.country || "Unknown"}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">ISP</div>
            <div class="detail-value">${data.ipData?.isp || "Unknown"}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Visits</div>
            <div class="detail-value">${data.visitCount}</div>
          </div>
        </div>
        <div class="risk-analysis">
          <div class="risk-factors">
            ${risk.factors.map((factor) => `<div class="risk-factor"><span class="risk-factor-icon factor-info">ℹ</span>${factor}</div>`).join("")}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
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
      displayIPAnalysis([]);
      return;
    }

    const totalTime = sorted.reduce((sum, [, t]) => sum + t, 0);
    summary.textContent = `Total Screen Time: ${formatTime(totalTime)} | Sites Visited: ${sorted.length}`;

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
            <span class="time">${formatTime(time)}-${percentage.toFixed(1)}%</span>
        </div>
        <div class="bar">
            <div class="bar-fill"></div>
        </div>
    `;

      // Set the bar width using CSS custom property
      const barFill = div.querySelector(".bar-fill");
      barFill.style.setProperty("--bar-width", `${percentage}%`);

      container.appendChild(div);
    });

    // Display IP Analysis
    displayIPAnalysis(tracking.pageVisits);

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
  fetch("http://localhost:3000/api/save", {
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
      chrome.tabs.create({ url: "https://example.com" });
      window.close(); // close the popup after opening

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

// Export Report Functionality
document.addEventListener("DOMContentLoaded", function () {
  const exportBtn = document.getElementById("exportBtn");

  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      chrome.storage.local.get(["activity", "tracking"], (result) => {
        const tracking = result.tracking || { pageVisits: [] };
        const activity = result.activity || {};

        // Generate HTML report
        const report = generateHTMLReport(activity, tracking);

        // Create blob and download
        const blob = new Blob([report], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `activity-report-${new Date().toISOString().split("T")[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    });
  }
});

function generateHTMLReport(activity, tracking) {
  const pageVisits = tracking.pageVisits || [];
  const domainMap = {};

  pageVisits.forEach((visit) => {
    const domain = getDomain(visit.url || visit.domain);
    if (!domainMap[domain]) {
      domainMap[domain] = {
        url: visit.url,
        domain: domain,
        ipData: visit.ipData,
        visitCount: 0,
      };
    }
    domainMap[domain].visitCount++;
  });

  let ipAnalysisHTML = "";
  Object.entries(domainMap).forEach(([domain, data]) => {
    const risk = assessIPRisk(data.ipData);
    const riskBadgeClass =
      risk.level === "high"
        ? "risk-badge-high-report"
        : risk.level === "medium"
          ? "risk-badge-medium-report"
          : "risk-badge-low-report";

    ipAnalysisHTML += `
      <tr class="report-table-body-row">
        <td class="report-table-cell">${domain}</td>
        <td class="report-table-cell">${data.ipData?.ip || "Unknown"}</td>
        <td class="report-table-cell">${data.ipData?.country || "Unknown"}</td>
        <td class="report-table-cell">${data.ipData?.isp || "Unknown"}</td>
        <td class="report-table-cell">${data.visitCount}</td>
        <td class="report-table-cell report-table-cell-center">
          <span class="${riskBadgeClass}">
            ${risk.level.toUpperCase()}
          </span>
        </td>
      </tr>
    `;
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Activity Tracker Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f7fa;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    h1 {
      color: #667eea;
      margin-top: 0;
      border-bottom: 2px solid #667eea;
      padding-bottom: 12px;
    }
    h2 {
      color: #333;
      margin-top: 30px;
      font-size: 18px;
      border-left: 4px solid #667eea;
      padding-left: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background: #f5f7fa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #667eea;
    }
    td {
      padding: 12px;
    }
    .report-table-header-row {
      border-bottom: 2px solid #667eea;
    }
    .report-table-body-row {
      border-bottom: 1px solid #e0e0e0;
    }
    .report-table-cell {
      border-right: 1px solid #e0e0e0;
    }
    .report-table-cell-center {
      text-align: center;
    }
    .risk-badge-high {
      background: #ffd6d6;
      color: #d70015;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
    }
    .risk-badge-medium {
      background: #fffe7e;
      color: #ff8c00;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
    }
    .risk-badge-low {
      background: #d6f4d6;
      color: #007a00;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Activity Tracker - Professional Report</h1>
    <p>Generated on: <strong>${new Date().toLocaleString()}</strong></p>
    
    <h2>📊 IP Address & Risk Analysis</h2>
    <table>
      <thead>
        <tr class="report-table-header-row">
          <th>Domain</th>
          <th>IP Address</th>
          <th>Country</th>
          <th>ISP</th>
          <th>Visits</th>
          <th>Risk Level</th>
        </tr>
      </thead>
      <tbody>
        ${ipAnalysisHTML || '<tr><td colspan="6" class="report-table-cell-center">No data available</td></tr>'}
      </tbody>
    </table>
    
    <div class="footer">
      <p><strong>Note:</strong> This report contains information about visited websites and associated IP addresses. Risk assessment is based on IP geolocation, VPN/Proxy detection, and other security factors.</p>
      <p>Report generated by Activity Tracker Chrome Extension</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

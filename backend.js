import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/analyze", async (req, res) => {
  const { activity, tracking = {} } = req.body;
  console.log("Received activity for analysis:", activity);
  console.log("Received tracking data:", tracking);

  const trackingSummary = generateTrackingSummary(tracking);

  const prompt = `
You are a productivity and behaviour analysis assistant with expertise in privacy, security, IP geolocation, and user engagement metrics.

USER BROWSING ACTIVITY:
${JSON.stringify(activity, null, 2)}

USER INTERACTION TRACKING:
${trackingSummary}

Based on this comprehensive user data, provide analysis on:

1. **Behaviour Summary** - Key patterns in browsing habits
2. **IP & Geographic Analysis** - Analysis of IP addresses
3. **Privacy & Security Assessment** - Microphone/camera access, autofill usage, sensitive fields, and potential risks
4. **Gentle Improvement Suggestions** - Privacy-respecting recommendations, framed positively, to enhance user security and productivity without being intrusive

Format your response with clear sections and bullet points.
`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b-instruct-q8_0",
        prompt: prompt,
        stream: false,
      }),
    });

    const data = await response.json();
    console.log("LLM response status:", data);
    res.json({ analysis: data.response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function generateTrackingSummary(tracking) {
  const {
    mediaAccess = [],
    autofill = [],
    sensitiveFields = [],
    pageVisits = [],
  } = tracking;

  let summary = "";

  // IP and Domain Risk Summary
  if (pageVisits.length > 0) {
    const domainsVisited = new Set(pageVisits.map((v) => v.domain));
    summary += `## Pages Visited & IP Information\n`;
    summary += `- Total page visits tracked: ${pageVisits.length}\n`;
    summary += `- Unique domains: ${domainsVisited.size}\n`;

    // Add IP-based risk summary
    const ipRisks = pageVisits.reduce((acc, visit) => {
      if (visit.ipData) {
        const domain = visit.domain;
        if (!acc[domain]) {
          acc[domain] = {
            ip: visit.ipData.ip,
            country: visit.ipData.country,
            isVPN: visit.ipData.isVPN,
            isProxy: visit.ipData.isProxy,
            visits: 0,
          };
        }
        acc[domain].visits++;
      }
      return acc;
    }, {});

    if (Object.keys(ipRisks).length > 0) {
      summary += "\n### Domain IP Details:\n";
      Object.entries(ipRisks).forEach(([domain, data]) => {
        let riskIndicators = [];
        if (data.isVPN) riskIndicators.push("VPN");
        if (data.isProxy) riskIndicators.push("Proxy");
        const riskStr =
          riskIndicators.length > 0 ? ` [${riskIndicators.join(", ")}]` : "";
        summary += `- ${domain}: IP ${data.ip} (${data.country})${riskStr}\n`;
      });
    }
    summary += "\n";
  }

  // Media Access Summary
  if (mediaAccess.length > 0) {
    const cameraAccess = mediaAccess.filter(
      (m) => m.mediaType && m.mediaType.includes("camera"),
    );
    const micAccess = mediaAccess.filter(
      (m) => m.mediaType && m.mediaType.includes("microphone"),
    );
    const deniedAccess = mediaAccess.filter((m) => m.event === "denied");

    summary += "## Media Device Access\n";
    summary += `- Camera accessed: ${cameraAccess.length} time(s)\n`;
    summary += `- Microphone accessed: ${micAccess.length} time(s)\n`;
    if (deniedAccess.length > 0) {
      summary += `- Access denied: ${deniedAccess.length} time(s)\n`;
    }
    summary += "\n";
  }

  // Autofill Summary
  if (autofill.length > 0) {
    const detectedAutofills = autofill.filter((a) => a.event === "detected");
    const submittedAutofills = autofill.filter((a) => a.event === "submitted");

    summary += "## Autofill Usage\n";
    summary += `- Autofilled fields detected: ${detectedAutofills.length}\n`;

    if (submittedAutofills.length > 0) {
      const totalAutofilledFields = submittedAutofills.reduce(
        (sum, a) => sum + a.autofilledFieldCount,
        0,
      );
      summary += `- Forms submitted with autofilled data: ${submittedAutofills.length}\n`;
      summary += `- Total autofilled fields in submissions: ${totalAutofilledFields}\n`;
    }

    // Field type distribution
    const fieldTypes = {};
    detectedAutofills.forEach((a) => {
      fieldTypes[a.fieldType] = (fieldTypes[a.fieldType] || 0) + 1;
    });

    if (Object.keys(fieldTypes).length > 0) {
      summary += "- Autofilled field types: ";
      summary += Object.entries(fieldTypes)
        .map(([type, count]) => `${type} (${count})`)
        .join(", ");
      summary += "\n";
    }
    summary += "\n";
  }

  // Sensitive Fields Summary
  if (sensitiveFields.length > 0) {
    summary += "## Sensitive Fields Encountered\n";

    const fieldTypeCount = {};
    sensitiveFields.forEach((field) => {
      fieldTypeCount[field.fieldType] =
        (fieldTypeCount[field.fieldType] || 0) + 1;
    });

    Object.entries(fieldTypeCount).forEach(([type, count]) => {
      summary += `- ${type} fields: ${count} page(s)\n`;
    });
    summary += "\n";
  }

  return summary || "No tracking data collected yet.";
}

app.listen(3000, () => console.log("Backend running on http://localhost:3000"));

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Empty request body" }),
      };
    }

    if (event.body.length > 200000) {
      return {
        statusCode: 413,
        body: JSON.stringify({ error: "Payload too large" }),
      };
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const sharedSecret = process.env.N8N_SHARED_SECRET;

    if (!webhookUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "N8N_WEBHOOK_URL is not configured" }),
      };
    }

    const data = JSON.parse(event.body);

    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON format" }),
      };
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ESS-Source": "netlify-function",
        "X-ESS-Secret": sharedSecret || "",
      },
      body: JSON.stringify({
        source: "ess-calculator-site",
        createdAt: new Date().toISOString(),
        payload: data,
      }),
    });

    if (!response.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "n8n webhook error" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server error",
        message: error.message,
      }),
    };
  }
};


const OpenAI = require("openai");

function getClient(kind) {
  const isDev = kind === "development";

  const apiKey = isDev
    ? process.env.DEV_API_KEY
    : process.env.CHAT_API_KEY;

  const baseURL = (
    isDev ? process.env.DEV_BASE_URL : process.env.CHAT_BASE_URL
  )?.trim() || "https://openrouter.ai/api/v1";

  const model = (
    isDev ? process.env.DEV_MODEL : process.env.CHAT_MODEL
  )?.trim() || (isDev ? "openai/gpt-4o" : "openai/gpt-4o-mini");

  if (!apiKey || apiKey.startsWith("PUT_")) {
    throw new Error(
      `Missing ${isDev ? "DEV_API_KEY" : "CHAT_API_KEY"} in .env`
    );
  }

  if (!/^https:\/\/[^/]+(?:\/.*)?$/i.test(baseURL)) {
    throw new Error(
      `Invalid ${isDev ? "DEV_BASE_URL" : "CHAT_BASE_URL"}. Use a complete HTTPS API base URL.`
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: baseURL.replace(/\/+$/, ""),
    timeout: 45000,
    maxRetries: 2,
  });

  return { client, model };
}

async function askAI(kind, messages) {
  const { client, model } = getClient(kind);

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.3,
    });

    const content = response.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      throw new Error("The AI returned an empty response.");
    }

    return content.trim();
  } catch (error) {
    console.error("AI request failed:", {
      kind,
      model,
      status: error.status,
      message: error.message,
    });

    if (error.status === 401) {
      throw new Error("AI API authentication failed. Check the API key in .env.");
    }

    if (error.status === 404) {
      throw new Error(
        `AI endpoint or model returned 404. Check ${kind === "development" ? "DEV_BASE_URL and DEV_MODEL" : "CHAT_BASE_URL and CHAT_MODEL"} in .env.`
      );
    }

    if (error.status === 429) {
      throw new Error("AI provider rate limit or quota reached. Check your provider account.");
    }

    throw new Error(`AI request failed: ${error.message}`);
  }
}

module.exports = { askAI };


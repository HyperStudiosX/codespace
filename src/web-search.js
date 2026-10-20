async function searchWeb(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: true
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Web search failed with HTTP ${response.status}`);
  const data = await response.json();
  const results = [];
  if (data.answer) results.push({ title: "Search summary", url: "", content: data.answer });
  for (const item of data.results || []) {
    results.push({
      title: item.title || "Web result",
      url: item.url || "",
      content: String(item.content || "").slice(0, 1200)
    });
  }
  return results;
}

function formatSearchResults(results) {
  if (!results.length) return "No live web results available. Be transparent and do not invent citations.";
  return results.map((r, i) =>
    `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`
  ).join("\n\n");
}

module.exports = { searchWeb, formatSearchResults };

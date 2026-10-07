const memoryCache = new Map();
const activeRequests = new Map();
const MAX_CACHE = 4000;

function normalizeText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function cacheSet(key, value) {
  if (memoryCache.size >= MAX_CACHE) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  memoryCache.set(key, value);
}

async function fetchGoogleTranslation(text) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "en",
    tl: "zh-CN",
    dt: "t",
    q: text
  });

  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
    {
      method: "GET",
      headers: { "Accept": "application/json,text/plain,*/*" },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`Translation HTTP ${response.status}`);
  }

  const data = await response.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map(part => part?.[0] || "").join("")
    : "";

  if (!translated) {
    throw new Error("Empty translation result");
  }
  return translated;
}

async function translateText(rawText) {
  const text = normalizeText(rawText);
  if (!text) return "";

  if (memoryCache.has(text)) {
    return memoryCache.get(text);
  }

  if (activeRequests.has(text)) {
    return activeRequests.get(text);
  }

  const task = (async () => {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await fetchGoogleTranslation(text);
        cacheSet(text, result);
        return result;
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    throw lastError;
  })();

  activeRequests.set(text, task);
  try {
    return await task;
  } finally {
    activeRequests.delete(text);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "TRANSLATE_TEXT") return;

  translateText(message.text)
    .then(translated => sendResponse({ ok: true, translated }))
    .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));

  return true;
});

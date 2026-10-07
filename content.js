(() => {
  const DEFAULTS = {
    enabled: true,
    autoTranslate: true,
    showOriginalOnHover: true
  };

  const originalText = new WeakMap();
  const translatedText = new WeakMap();
  const pendingNodes = new WeakSet();
  const queue = [];
  let running = 0;
  let observer = null;
  let settings = { ...DEFAULTS };
  let lastUrl = location.href;
  let scanTimer = null;

  const MAX_CONCURRENCY = 3;
  const MAX_TEXT_LENGTH = 1800;

  const BLOCKED_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION",
    "CODE", "PRE", "SVG", "PATH", "CANVAS"
  ]);

  const UI_WORDS = new Set([
    "home", "my network", "jobs", "messaging", "notifications", "me",
    "for business", "learning", "search", "message", "connect", "follow",
    "more", "show all", "show more", "show less", "contact info"
  ]);

  function storageGet(defaults) {
    return new Promise(resolve => chrome.storage.sync.get(defaults, resolve));
  }

  function isEnglishDominant(text) {
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    const cjk = (text.match(/[\u3400-\u9FFF]/g) || []).length;
    return latin >= 2 && latin > cjk * 2;
  }

  function looksLikeUrlOrEmail(text) {
    return /https?:\/\/|www\.|\S+@\S+\.\S+/i.test(text);
  }

  function looksLikePureProperName(text) {
    const clean = text.replace(/[·•|]/g, " ").replace(/\s+/g, " ").trim();
    const words = clean.split(" ").filter(Boolean);
    if (words.length < 1 || words.length > 4) return false;
    if (/[,.!?;:()]/.test(clean)) return false;

    return words.every(word =>
      /^[A-Z][A-Za-z'’-]*$/.test(word) ||
      /^[A-Z]{2,6}$/.test(word)
    );
  }

  function shouldTranslateText(text) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length < 3 || clean.length > MAX_TEXT_LENGTH) return false;
    if (!isEnglishDominant(clean)) return false;
    if (looksLikeUrlOrEmail(clean)) return false;
    if (/^[\d\s+.,%$£€¥()/\-–—]+$/.test(clean)) return false;
    if (UI_WORDS.has(clean.toLowerCase())) return false;
    if (looksLikePureProperName(clean)) return false;
    return true;
  }

  function isBlockedElement(element) {
    if (!element) return true;
    if (BLOCKED_TAGS.has(element.tagName)) return true;
    if (element.closest("script,style,noscript,textarea,input,select,option,code,pre,svg,canvas")) return true;
    if (element.closest("nav,header,footer")) return true;
    if (element.closest("button,[role='button'],[contenteditable='true']")) return true;
    if (element.closest("[data-li-cn-ignore='true']")) return true;
    return false;
  }

  function isInProfileContent(node) {
    const parent = node.parentElement;
    if (!parent || isBlockedElement(parent)) return false;

    const main = parent.closest("main");
    if (!main) return false;

    // LinkedIn profile pages normally contain /in/ in the URL.
    // On other LinkedIn pages we stay conservative and do not auto-translate.
    return location.pathname.startsWith("/in/");
  }

  function getCandidateNodes(root = document) {
    const scope = root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE
      ? root
      : root.parentElement;
    if (!scope) return [];

    const walker = document.createTreeWalker(
      scope,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.parentElement) return NodeFilter.FILTER_REJECT;
          if (!isInProfileContent(node)) return NodeFilter.FILTER_REJECT;
          if (!shouldTranslateText(node.nodeValue)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    return nodes;
  }

  function addHoverOriginal(node, original) {
    if (!settings.showOriginalOnHover || !node.parentElement) return;
    const parent = node.parentElement;
    if (!parent.dataset.liCnOriginal) {
      parent.dataset.liCnOriginal = original;
      parent.classList.add("li-cn-translated");
    }
  }

  function translateNode(node) {
    if (!settings.enabled || pendingNodes.has(node)) return;
    if (!node.isConnected || !isInProfileContent(node)) return;

    const current = node.nodeValue || "";
    const clean = current.replace(/\s+/g, " ").trim();
    if (!shouldTranslateText(clean)) return;

    const alreadyTranslated = translatedText.get(node);
    if (alreadyTranslated && clean === alreadyTranslated.trim()) return;

    if (!originalText.has(node)) originalText.set(node, current);

    pendingNodes.add(node);
    queue.push({ node, source: clean, originalRaw: originalText.get(node) });
    pumpQueue();
  }

  function preserveOuterWhitespace(raw, translated) {
    const leading = raw.match(/^\s*/)?.[0] || "";
    const trailing = raw.match(/\s*$/)?.[0] || "";
    return `${leading}${translated}${trailing}`;
  }

  function requestTranslation(text) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "TRANSLATE_TEXT", text },
        response => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.error || "Translation failed"));
            return;
          }
          resolve(response.translated);
        }
      );
    });
  }

  function pumpQueue() {
    while (settings.enabled && running < MAX_CONCURRENCY && queue.length) {
      const task = queue.shift();
      const { node, source, originalRaw } = task;
      running += 1;

      requestTranslation(source)
        .then(translated => {
          if (!settings.enabled || !node.isConnected) return;
          const finalText = preserveOuterWhitespace(originalRaw, translated);
          node.nodeValue = finalText;
          translatedText.set(node, finalText);
          addHoverOriginal(node, source);
        })
        .catch(() => {
          // Silent failure: leave the original text untouched.
        })
        .finally(() => {
          pendingNodes.delete(node);
          running -= 1;
          setTimeout(pumpQueue, 90);
        });
    }
  }

  function scan(root = document) {
    if (!settings.enabled || !location.pathname.startsWith("/in/")) return;
    const nodes = getCandidateNodes(root);
    for (const node of nodes) translateNode(node);
  }

  function scheduleScan(root = document) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => scan(root), 250);
  }

  function restoreAll() {
    const root = document.querySelector("main") || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (originalText.has(node)) {
        node.nodeValue = originalText.get(node);
        translatedText.delete(node);
      }
    }
    document.querySelectorAll(".li-cn-translated[data-li-cn-original]").forEach(el => {
      el.classList.remove("li-cn-translated");
      delete el.dataset.liCnOriginal;
    });
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(mutations => {
      if (!settings.enabled) return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          if (mutation.target.nodeType === Node.TEXT_NODE) translateNode(mutation.target);
        }
        for (const added of mutation.addedNodes || []) {
          if (added.nodeType === Node.TEXT_NODE) translateNode(added);
          else if (added.nodeType === Node.ELEMENT_NODE) scheduleScan(added);
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }

  function installSpaWatcher() {
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(() => {
          if (settings.enabled && settings.autoTranslate) scan(document);
        }, 900);
      }
    }, 700);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "TRANSLATE_NOW") {
      settings.enabled = true;
      scan(document);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "RESTORE_ORIGINAL") {
      restoreAll();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "SET_ENABLED") {
      settings.enabled = Boolean(message.enabled);
      if (settings.enabled) scan(document);
      else restoreAll();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "SET_HOVER_ORIGINAL") {
      settings.showOriginalOnHover = Boolean(message.enabled);
      if (!settings.showOriginalOnHover) {
        document.querySelectorAll(".li-cn-translated[data-li-cn-original]").forEach(el => {
          el.classList.remove("li-cn-translated");
          delete el.dataset.liCnOriginal;
        });
      }
      sendResponse({ ok: true });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) settings[key] = changes[key].newValue;
    }
    if (!settings.enabled) restoreAll();
    else if (settings.autoTranslate) scheduleScan(document);
  });

  async function init() {
    settings = await storageGet(DEFAULTS);
    startObserver();
    installSpaWatcher();
    if (settings.enabled && settings.autoTranslate) {
      setTimeout(() => scan(document), 600);
    }
  }

  init();
})();

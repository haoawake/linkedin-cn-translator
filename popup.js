const DEFAULTS = {
  enabled: true,
  autoTranslate: true,
  showOriginalOnHover: true
};

function getSettings() {
  return new Promise(resolve => chrome.storage.sync.get(DEFAULTS, resolve));
}

function saveSetting(key, value) {
  return new Promise(resolve => chrome.storage.sync.set({ [key]: value }, resolve));
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function setStatus(text, isError = false) {
  const status = document.getElementById("status");
  status.textContent = text;
  status.style.color = isError ? "#b42318" : "#667085";
}

async function sendToCurrentTab(message) {
  const tab = await currentTab();
  if (!tab?.id || !tab.url?.includes("linkedin.com/")) {
    throw new Error("请先打开 LinkedIn 页面");
  }
  return chrome.tabs.sendMessage(tab.id, message);
}

async function init() {
  const settings = await getSettings();
  for (const [key, value] of Object.entries(settings)) {
    const input = document.getElementById(key);
    if (input) input.checked = Boolean(value);
  }

  document.getElementById("enabled").addEventListener("change", async event => {
    await saveSetting("enabled", event.target.checked);
    try {
      await sendToCurrentTab({ type: "SET_ENABLED", enabled: event.target.checked });
      setStatus(event.target.checked ? "翻译已启用" : "已还原并暂停翻译");
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById("autoTranslate").addEventListener("change", async event => {
    await saveSetting("autoTranslate", event.target.checked);
    setStatus(event.target.checked ? "自动翻译已开启" : "自动翻译已关闭");
  });

  document.getElementById("showOriginalOnHover").addEventListener("change", async event => {
    await saveSetting("showOriginalOnHover", event.target.checked);
    try {
      await sendToCurrentTab({ type: "SET_HOVER_ORIGINAL", enabled: event.target.checked });
    } catch (_) {}
    setStatus(event.target.checked ? "悬停原文已开启" : "悬停原文已关闭");
  });

  document.getElementById("translateNow").addEventListener("click", async () => {
    try {
      await saveSetting("enabled", true);
      document.getElementById("enabled").checked = true;
      await sendToCurrentTab({ type: "TRANSLATE_NOW" });
      setStatus("正在翻译当前档案…");
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById("restore").addEventListener("click", async () => {
    try {
      await sendToCurrentTab({ type: "RESTORE_ORIGINAL" });
      setStatus("已还原当前页面英文");
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

init();

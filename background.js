chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
  
    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: "..."
    });
  
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
    } catch (error) {
      console.log("Could not run autofill:", error);
  
      await chrome.action.setBadgeText({
        tabId: tab.id,
        text: "!"
      });
    }
  });
  
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type !== "AUTOFILL_RESULT" || !sender.tab?.id) {
      return;
    }
  
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: String(message.count)
    });
  
    chrome.action.setBadgeBackgroundColor({
      tabId: sender.tab.id,
      color: "#16803c"
    });
  });
// Keeps track of muted domains in memory
const mutedDomains = new Set();

/**
 * Loads muted domains from persistent storage into the `mutedDomains` set.
 */
async function loadMutedDomains() {
  try {
    const result = await browser.storage.local.get("mutedDomains");
    if (result.mutedDomains) {
      result.mutedDomains.forEach((domain) => mutedDomains.add(domain));
      console.log("Loaded muted domains:", [...mutedDomains]);
    }
  } catch (error) {
    console.error("Error loading muted domains:", error);
  }
}

/**
 * Saves the current `mutedDomains` set to persistent storage.
 */
async function saveMutedDomains() {
  try {
    await browser.storage.local.set({ mutedDomains: [...mutedDomains] });
    console.log("Saved muted domains:", [...mutedDomains]);
  } catch (error) {
    console.error("Error saving muted domains:", error);
  }
}

/**
 * Toggles mute state for a given domain.
 * @param {string} domain - The domain to toggle mute/unmute.
 */
async function toggleMuteDomain(domain) {
  if (mutedDomains.has(domain)) {
    // Unmute the domain
    await unmuteDomain(domain);
    mutedDomains.delete(domain);
    console.log(`Unmuted domain: ${domain}`);
  } else {
    // Mute the domain
    await muteDomain(domain);
    mutedDomains.add(domain);
    console.log(`Muted domain: ${domain}`);
  }
  await saveMutedDomains();
}

/**
 * Mutes all tabs matching the given domain.
 * @param {string} domain - The domain to mute.
 */
async function muteDomain(domain) {
  const tabs = await browser.tabs.query({});
  const matchingTabs = tabs.filter((tab) => {
    try {
      const url = new URL(tab.url);
      return url.hostname.includes(domain);
    } catch {
      return false;
    }
  });

  for (const tab of matchingTabs) {
    await browser.tabs.update(tab.id, { muted: true });
  }
}

/**
 * Unmutes all tabs matching the given domain.
 * @param {string} domain - The domain to unmute.
 */
async function unmuteDomain(domain) {
  const tabs = await browser.tabs.query({});
  const matchingTabs = tabs.filter((tab) => {
    try {
      const url = new URL(tab.url);
      return url.hostname.includes(domain);
    } catch {
      return false;
    }
  });

  for (const tab of matchingTabs) {
    await browser.tabs.update(tab.id, { muted: false });
  }
}

/**
 * Handles the auto-muting of new tabs or tabs being updated.
 * @param {number} tabId - The ID of the tab.
 * @param {object} changeInfo - Object containing tab change details.
 * @param {object} tab - The tab object.
 */
function handleTabUpdates(tabId, changeInfo, tab) {
  if (changeInfo.url) {
    try {
      const url = new URL(changeInfo.url);
      if (mutedDomains.has(url.hostname)) {
        browser.tabs.update(tabId, { muted: true });
        console.log(`Auto-muted new tab: ${url.hostname}`);
      }
    } catch {
      // Ignore invalid URLs
    }
  }
}

/**
 * Updates the context menu dynamically based on the domain of the clicked tab.
 * @param {object} info - The context menu info object.
 * @param {object} tab - The tab object.
 */
function updateContextMenuOnShown(info, tab) {
  try {
    const url = new URL(tab.url);
    const domain = url.hostname;

    const title = mutedDomains.has(domain)
      ? "Unmute this site"
      : "Mute this site";

    browser.contextMenus.update("toggle-mute", { title });
    console.log(`Updated context menu for domain: ${domain}`);
  } catch {
    browser.contextMenus.update("toggle-mute", { title: "Mute/Unmute site" });
  }
}

// Create a context menu for tab titles
browser.contextMenus.create({
  id: "toggle-mute",
  title: "Mute/Unmute site",
  contexts: ["tab"]
});

// Handle clicks on the context menu item
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "toggle-mute" && tab) {
    try {
      const url = new URL(tab.url);
      await toggleMuteDomain(url.hostname);
    } catch (error) {
      console.error("Error toggling mute for domain:", error);
    }
  }
});

// Dynamically update the context menu before it is shown
browser.contextMenus.onShown.addListener((info, tab) => {
  if (info.contexts.includes("tab")) {
    updateContextMenuOnShown(info, tab);
  }
  browser.contextMenus.refresh(); // Refreshes the context menu display
});

// Listen for tab updates to auto-mute tabs in muted domains
browser.tabs.onUpdated.addListener(handleTabUpdates);

// Load muted domains from storage when the addon initializes
loadMutedDomains();

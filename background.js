// background.js
// Script de fondo para la extensión de Chrome
console.log('Background script running');
chrome.action.onClicked.addListener(() => {
	chrome.tabs.create({ url: chrome.runtime.getURL('main.html') });
});

// On install, inject the content script into all existing tabs so no reload is required
try {
	chrome.runtime.onInstalled.addListener(async (details) => {
		try {
			// Query all tabs across all windows
			chrome.tabs.query({}, (tabs) => {
				try {
					tabs.forEach((tab) => {
						try {
							if (!tab || typeof tab.id !== 'number') return;
							// Ignore chrome://, edge://, file:// and other restricted schemes automatically by matches
							chrome.scripting && chrome.scripting.executeScript && chrome.scripting.executeScript({
								target: { tabId: tab.id, allFrames: false },
								files: ['contentScript.js']
							}, () => {
								// optional: ignore errors like Cannot access a chrome:// URL
							});
						} catch (_) {}
					});
				} catch (_) {}
			});
		} catch (_) {}
	});
} catch (_) {}

// Broadcast events to all tabs so every contentScript can react immediately
try {
	chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
		if (!msg || !msg.type) return;
		// When a piece is collected in any tab, notify all tabs quickly
		if (msg.type === 'PIECE_COLLECTED') {
			try {
				chrome.tabs.query({}, (tabs) => {
					try {
						tabs.forEach((tab) => {
							if (!tab || typeof tab.id !== 'number') return;
							try {
								chrome.tabs.sendMessage(tab.id, {
									type: 'PIECE_COLLECTED_GLOBAL',
									imageIndex: msg.imageIndex,
									pieceIndex: msg.pieceIndex
								});
							} catch (e) {}
						});
					} catch (e) {}
				});
			} catch (e) {}
		}
	});
} catch (e) {
	// Non-fatal; background message relay not available
}

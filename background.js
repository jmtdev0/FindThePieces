// background.js
// Script de fondo para la extensión de Chrome
console.log('Background script running');
chrome.action.onClicked.addListener(() => {
	chrome.tabs.create({ url: chrome.runtime.getURL('main.html') });
});

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

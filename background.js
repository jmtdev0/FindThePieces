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

// Helper to broadcast PIECE_COLLECTED_GLOBAL to all tabs
function broadcastPieceCollected(imageIndex, pieceIndex, skipTabId = null) {
	try {
		chrome.tabs.query({}, (tabs) => {
			try {
				tabs.forEach((tab) => {
					if (!tab || typeof tab.id !== 'number') return;
					// Skip notifying the tab that originated the collect if requested
					if (skipTabId !== null && tab.id === skipTabId) return;
					try {
						chrome.tabs.sendMessage(tab.id, {
							type: 'PIECE_COLLECTED_GLOBAL',
							imageIndex: imageIndex,
							pieceIndex: pieceIndex
						});
					} catch (e) {}
				});
			} catch (e) {}
		});
	} catch (e) {}
}

// Broadcast events to all tabs so every contentScript can react immediately
try {
	chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
		if (!msg || !msg.type) return;
		// When a piece is collected, content scripts now update storage directly and notify here.
		// This background handler just broadcasts to other tabs to keep them in sync.
		if (msg.type === 'PIECE_COLLECTED') {
			try {
				const imageIndex = msg.imageIndex;
				const pieceIndex = msg.pieceIndex;
				const senderTabId = (sender && sender.tab && typeof sender.tab.id === 'number') ? sender.tab.id : null;
				// Just broadcast to other tabs; the sender tab already removed the element optimistically
				broadcastPieceCollected(imageIndex, pieceIndex, senderTabId);
			} catch (e) {
				// Non-fatal
			}
		}
		// Content script asks background to append an event to the collection feed to avoid I/O on the page
		else if (msg.type === 'FTP_CS_FEED_APPEND') {
			try {
				const imageIndex = msg.imageIndex;
				const pieceIndex = msg.pieceIndex;
				const now = Date.now();
				chrome.storage.local.get(['ftp_collectionFeed', 'ftp_collectionSeq'], (res) => {
					try {
						const feed = Array.isArray(res.ftp_collectionFeed) ? res.ftp_collectionFeed.slice() : [];
						const nextSeq = (typeof res.ftp_collectionSeq === 'number' ? res.ftp_collectionSeq : 0) + 1;
						feed.push({ id: nextSeq, imageIndex, pieceIndex, ts: now });
						const pruned = feed.length > 10 ? feed.slice(-10) : feed; // keep last 10
						chrome.storage.local.set({ ftp_collectionFeed: pruned, ftp_collectionSeq: nextSeq }, () => {
							// Optionally, also broadcast to tabs for immediate DOM cleanup
							// broadcastPieceCollected(imageIndex, pieceIndex, sender && sender.tab ? sender.tab.id : null);
						});
					} catch (_) {}
				});
			} catch (_) {}
		}
	});
} catch (e) {
	// Non-fatal; background message relay not available
}

	// --- Feed consumer & persistence in background ---
	(function setupFeedConsumer() {
		let bgCursor = 0; // in-memory cursor; persisted in storage as 'ftp_bgCursor'

		function initCursor() {
			try {
				chrome.storage && chrome.storage.local && chrome.storage.local.get && chrome.storage.local.get(['ftp_bgCursor'], (res) => {
					try { bgCursor = (typeof res.ftp_bgCursor === 'number') ? res.ftp_bgCursor : 0; } catch (_) { bgCursor = 0; }
				});
			} catch (_) {}
		}

		function processFeedOnce() {
			try {
				chrome.storage && chrome.storage.local && chrome.storage.local.get && chrome.storage.local.get(['findThePixelsImages', 'findThePiecesImages', 'ftp_collectionFeed', 'ftp_bgCursor'], (res) => {
					try {
						const feed = Array.isArray(res.ftp_collectionFeed) ? res.ftp_collectionFeed : [];
						const lastCursor = (typeof res.ftp_bgCursor === 'number') ? res.ftp_bgCursor : bgCursor || 0;
						const newEvents = feed.filter(ev => ev && typeof ev.id === 'number' && ev.id > lastCursor);
						if (!newEvents.length) return;

						// Decide which images key to use; prefer findThePixelsImages (current storage.js key)
						let images = Array.isArray(res.findThePixelsImages) ? res.findThePixelsImages : (Array.isArray(res.findThePiecesImages) ? res.findThePiecesImages : []);
						let imagesKey = Array.isArray(res.findThePixelsImages) ? 'findThePixelsImages' : (Array.isArray(res.findThePiecesImages) ? 'findThePiecesImages' : 'findThePixelsImages');

						let anyChange = false;
						newEvents.forEach((ev) => {
							try {
								const idx = ev.imageIndex;
								const p = ev.pieceIndex;
								if (!Array.isArray(images) || idx < 0 || idx >= images.length) return;
								const img = images[idx];
								if (!img || !img.puzzle) return;
								const set = new Set(Array.isArray(img.collectedPieces) ? img.collectedPieces : []);
								if (!set.has(p)) {
									set.add(p);
									img.collectedPieces = Array.from(set).sort((a,b)=>a-b);
									anyChange = true;
								}
							} catch (_) {}
						});

						const newCursor = Math.max(lastCursor, ...newEvents.map(e => e.id));

						if (anyChange) {
							const toSet = { [imagesKey]: images, ftp_bgCursor: newCursor };
							chrome.storage.local.set(toSet, () => {
								// Optional: broadcast to tabs to remove any visible matching pieces immediately
								// newEvents.forEach(ev => { try { broadcastPieceCollected(ev.imageIndex, ev.pieceIndex, null); } catch(_) {} });
							});
						} else {
							// Even if no image change, advance the cursor to avoid reprocessing
							chrome.storage.local.set({ ftp_bgCursor: newCursor });
						}

						bgCursor = newCursor;
					} catch (_) {}
				});
			} catch (_) {}
		}

		// Initialize cursor on background startup
		initCursor();
		// Process any pending events on startup
		try { setTimeout(processFeedOnce, 0); } catch (_) {}

		// React to storage changes on the feed keys to process immediately
		try {
			chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.addListener((changes, area) => {
				try {
					if (area !== 'local') return;
					if (changes.ftp_collectionFeed || changes.ftp_collectionSeq) {
						processFeedOnce();
					}
				} catch (_) {}
			});
		} catch (_) {}
	})();

// background.js
// Script de fondo para la extensión de Chrome
console.log('Background script running');
chrome.action.onClicked.addListener(() => {
	chrome.tabs.create({ url: chrome.runtime.getURL('main.html') });
});

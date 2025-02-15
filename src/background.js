// Inject content script if not already injected
async function ensureContentScriptInjected(tabId) {
  try {
    // Try to send a test message to check if content script is loaded
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch (error) {
    // If receiving end does not exist, inject the content script
    console.log('Content script not found, injecting...');
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/content-script.js']
    });
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_TRANSCRIPT') {
    (async () => {
      try {
        // Ensure content script is injected
        await ensureContentScriptInjected(request.tabId);
        
        // Forward the request to the content script
        const response = await chrome.tabs.sendMessage(
          request.tabId, 
          { type: 'FETCH_TRANSCRIPT', url: request.url }
        );
        
        // Forward the response back to the popup
        sendResponse(response);
      } catch (error) {
        console.error('Background script error:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to communicate with content script' 
        });
      }
    })();
    
    return true; // Will respond asynchronously
  }
}); 
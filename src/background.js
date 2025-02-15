// Inject content script if not already injected
async function ensureContentScriptInjected(tabId) {
  try {
    // Try to send a test message to check if content script is loaded
    console.log('Checking if content script is loaded...');
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    console.log('Content script is already loaded');
  } catch (error) {
    // If receiving end does not exist, inject the content script
    console.log('Content script not found, injecting...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/content-script.js']
      });
      console.log('Content script injected successfully');
      
      // Verify injection was successful
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        console.log('Content script verified after injection');
      } catch (verifyError) {
        console.error('Failed to verify content script injection:', verifyError);
        throw new Error('Content script injection verification failed');
      }
    } catch (injectionError) {
      console.error('Failed to inject content script:', injectionError);
      throw new Error('Failed to inject content script: ' + injectionError.message);
    }
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_TRANSCRIPT') {
    (async () => {
      try {
        console.log('Starting transcript fetch process for tab:', request.tabId);
        
        // Ensure content script is injected
        await ensureContentScriptInjected(request.tabId);
        
        // Forward the request to the content script with additional debug flag
        const response = await chrome.tabs.sendMessage(
          request.tabId, 
          { 
            type: 'FETCH_TRANSCRIPT', 
            url: request.url,
            debug: true // Add debug flag to get more detailed logging
          }
        );
        
        if (!response.success) {
          console.error('Content script reported failure:', response.error);
        }
        
        // Forward the response back to the popup
        sendResponse(response);
      } catch (error) {
        console.error('Background script error:', error);
        // Provide more detailed error information
        sendResponse({ 
          success: false, 
          error: `Background script error: ${error.message}`,
          details: {
            stage: 'background_script',
            originalError: error.toString(),
            stack: error.stack
          }
        });
      }
    })();
    
    return true; // Will respond asynchronously
  }
}); 
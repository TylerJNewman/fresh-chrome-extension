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

// Add debug logging for command registration
console.log('Background script loaded, registering command listener');

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'fetch-transcript') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url?.includes('youtube.com/watch')) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
          title: 'Wrong Page',
          message: 'This shortcut only works on YouTube video pages'
        });
        return;
      }

      await ensureContentScriptInjected(tab.id);
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'FETCH_TRANSCRIPT',
        url: tab.url,
        debug: true
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch transcript');
      }

      const formattedTranscript = formatTranscript(response.data.transcript);
      
      // First focus the tab
      await chrome.tabs.update(tab.id, { active: true });
      
      // Then execute the clipboard operation with a small delay
      setTimeout(async () => {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (text) => {
            try {
              // Create a temporary textarea element
              const textarea = document.createElement('textarea');
              textarea.value = text;
              document.body.appendChild(textarea);
              
              // Select and copy the text
              textarea.select();
              document.execCommand('copy');
              
              // Clean up
              document.body.removeChild(textarea);
              
              return { success: true };
            } catch (err) {
              console.error('Clipboard error:', err);
              return { success: false, error: err.message };
            }
          },
          args: [formattedTranscript]
        });

        if (!result?.[0]?.result?.success) {
          throw new Error('Failed to copy to clipboard: ' + (result?.[0]?.result?.error || 'Unknown error'));
        }

        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
          title: 'Success!',
          message: 'Transcript copied to clipboard'
        });
      }, 100); // Small delay to ensure tab is focused

    } catch (error) {
      console.error('Error handling hotkey:', error);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
        title: 'Error',
        message: error.message || 'An error occurred'
      });
    }
  }
}); 

function decodeHtmlEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '='
  };
  
  return text.replace(/&[#\w]+;/g, entity => entities[entity] || entity);
}

function formatTranscript(transcriptData) {
  if (!transcriptData || !Array.isArray(transcriptData) || transcriptData.length === 0) {
    return ""; 
  }

  let formattedTranscript = "";

  transcriptData.forEach((segment, index) => {
    if (!segment?.text) return;
    
    // Decode HTML entities and trim
    let text = decodeHtmlEntities(segment.text.trim());

    // Handle spacing and new lines
    if (formattedTranscript.length > 0) {
      const lastChar = formattedTranscript.slice(-1);
      const isPunctuated = ['.', '?', '!', '\n'].includes(lastChar);
      
      if (index > 0) {
        const previousSegment = transcriptData[index - 1];
        const currentStart = segment.offset || 0;
        const previousEnd = (previousSegment.offset || 0) + (previousSegment.duration || 0);
        const pause = currentStart - previousEnd;
        
        if (pause > 0.5) {
          formattedTranscript += '\n\n';
        } else if (!isPunctuated) {
          formattedTranscript += ' ';
        }
      }
    }

    // Capitalize after newlines or at start
    if (formattedTranscript.length === 0 || formattedTranscript.slice(-2) === '\n\n') {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    formattedTranscript += text;
  });

  // Add final punctuation if needed
  const lastChar = formattedTranscript.slice(-1);
  if (!['.', '?', '!', '\n'].includes(lastChar)) {
    formattedTranscript += '.';
  }

  return formattedTranscript;
}
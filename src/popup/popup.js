console.log('Popup script loaded');

// UI Elements
const button = document.getElementById('fetchButton');
const transcriptDiv = document.getElementById('transcript');
const errorDiv = document.getElementById('error');
const successDiv = document.getElementById('success');

// State
let isLoading = false;

function showError(message) {
  console.error('Error:', message);
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  successDiv.style.display = 'none';
}

function showSuccess(transcriptText) {
  transcriptDiv.textContent = transcriptText;
  transcriptDiv.style.display = 'block';
  successDiv.style.display = 'block';
  errorDiv.style.display = 'none';
}

async function handleFetchTranscript() {
  console.log('Fetch button clicked');
  
  if (isLoading) return;
  
  try {
    isLoading = true;
    button.disabled = true;
    button.textContent = 'Fetching...';
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    transcriptDiv.style.display = 'none';
    
    // Get current tab
    console.log('Getting current tab...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tab:', tab);

    if (!tab?.url) {
      throw new Error('No active tab found');
    }

    if (!tab.url.includes('youtube.com/watch')) {
      throw new Error('Please open this extension on a YouTube video page');
    }

    // Send message through background script
    console.log('Sending message to background script...');
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_TRANSCRIPT',
      url: tab.url,
      tabId: tab.id
    });

    console.log('Received response:', response);
    
    if (response?.success) {
      const transcriptData = response.data.transcript;
      const formattedTranscript = formatTranscript(transcriptData);
      const stringifiedTranscript = JSON.stringify(transcriptData, null, 2);
      
      console.log('Transcript data:', formattedTranscript);
      
      // Copy to clipboard as formatted JSON
      console.log('Copying to clipboard...');
      await navigator.clipboard.writeText(formattedTranscript);
      console.log('Copied to clipboard successfully');
      
      // Show success and transcript as formatted JSON
      showSuccess(formattedTranscript);
    } else {
      throw new Error(response?.error || 'Failed to fetch transcript');
    }

  } catch (err) {
    showError(err.message || 'An unknown error occurred');
  } finally {
    isLoading = false;
    button.disabled = false;
    button.textContent = 'Get Transcript';
  }
}

// Add event listener
button.addEventListener('click', handleFetchTranscript);

function formatTranscript(transcriptData) {
  if (!transcriptData || !Array.isArray(transcriptData) || transcriptData.length === 0) {
    return ""; 
  }

  let formattedTranscript = "";

  transcriptData.forEach((segment, index) => {
    if (!segment?.text) return;
    
    // Create a temporary element to decode HTML entities properly
    const decoder = document.createElement('div');
    decoder.innerHTML = segment.text;
    let text = decoder.textContent.trim();

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

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
    return ""; // Return empty string for invalid input
  }

  let formattedTranscript = "";

  for (const segment of transcriptData) {
    let text = segment.text;

    // 1. Basic Text Cleaning:
    text = text.trim(); // Remove leading/trailing whitespace

    // 2. HTML Entity Decoding:
    text = text.replace(/&amp;#39;/g, "'"); // Replace &#39; with '
    text = text.replace(/&quot;/g, '"');   //Replace the double quote HTML entity
    text = text.replace(/&lt;/g, '<');     //Replace less than HTML entity
    text = text.replace(/&gt;/g, '>');     //Replace greater than HTML entity
    text = text.replace(/&amp;/g, '&');    // Replace &amp; with &  (MUST be last)

    // 3. Sentence Case and Punctuation:
      if (formattedTranscript.length > 0) {
          // Add a space if the previous segment didn't end with punctuation.
          const lastChar = formattedTranscript.slice(-1);
          if (!['.', '?', '!', '\n'].includes(lastChar)) {
                //check if a pause of greater than .5 seconds occurs, and if so, add some new lines to show the speaker has finished that thought.
              if(segment.offset - (transcriptData[transcriptData.indexOf(segment)-1].offset + transcriptData[transcriptData.indexOf(segment)-1].duration) > 0.5){
                  formattedTranscript += "\n\n";
              }
              else{
                  formattedTranscript += " ";
              }
          }
      }

    // Capitalize the first letter of the *segment* (if it's the start of the whole transcript OR after a newline).
        if (formattedTranscript.length === 0 || formattedTranscript.slice(-2) === '\n\n' ) {
           text = text.charAt(0).toUpperCase() + text.slice(1);
       }


    formattedTranscript += text;
  }


    // Add final punctuation if missing.  Makes the transcript end nicely.
    const lastChar = formattedTranscript.slice(-1);
    if (!['.', '?', '!', '\n'].includes(lastChar)) {
        formattedTranscript += '.';
    }


  return formattedTranscript;
};

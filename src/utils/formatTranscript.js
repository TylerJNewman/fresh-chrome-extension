export function formatTranscript(transcriptData) {
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
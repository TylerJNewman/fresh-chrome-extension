# YouTube Transcript Fetcher

A Chrome extension that lets you easily fetch and copy YouTube video transcripts.

## Features

- **Quick Transcript Access**: Fetch and copy video transcripts with a keyboard shortcut
- **Smart Formatting**: Automatically formats transcripts with proper spacing, capitalization, and punctuation
- **Keyboard Shortcut**: Use Command+Shift+Y (Mac) or Ctrl+Shift+Y (Windows/Linux) to instantly copy transcripts
- **Visual Feedback**: Notifications indicate success or any issues
- **Works on Any YouTube Video**: Compatible with any YouTube video that has captions/transcripts available

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" using the toggle in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension icon will appear in your browser toolbar

## Usage

### Using the Keyboard Shortcut
1. Navigate to any YouTube video
2. Press Command+Shift+Y (Mac) or Ctrl+Shift+Y (Windows/Linux)
3. The transcript will be automatically copied to your clipboard

### Using the Popup
1. Click the extension icon in your toolbar
2. Click "Get Transcript"
3. The transcript will be copied to your clipboard

### Customizing the Shortcut
1. Go to `chrome://extensions/shortcuts`
2. Find "YouTube Transcript Fetcher"
3. Click the pencil icon
4. Enter your preferred key combination

## Permissions

The extension requires the following permissions:
- `activeTab`: To access the current YouTube video
- `clipboardWrite`: To copy the transcript
- `scripting`: To inject content scripts
- `notifications`: To show success/error messages

## Development

### Project Structure

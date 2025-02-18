'use server';

class VideoUnavailableError extends Error {
  constructor(videoId) {
    super(`The video is no longer available (${videoId})`);
    this.name = 'VideoUnavailableError';
  }
}

class TranscriptDisabledError extends Error {
  constructor(videoId) {
    super(`Transcript is disabled on this video (${videoId})`);
    this.name = 'TranscriptDisabledError';
  }
}

class TooManyRequestsError extends Error {
  constructor() {
    super('Too many requests to YouTube from this IP. Captcha solving required.');
    this.name = 'TooManyRequestsError';
  }
}

class TranscriptNotAvailableError extends Error {
  constructor(videoId) {
    super(`No transcripts are available for this video (${videoId})`);
    this.name = 'TranscriptNotAvailableError';
  }
}

class LanguageNotAvailableError extends Error {
  constructor(videoId, lang, availableLangs) {
    super(
      `No transcripts available in "${lang}" for this video (${videoId}). Available languages: ${availableLangs.join(
        ', '
      )}`
    );
    this.name = 'LanguageNotAvailableError';
  }
}

const YOUTUBE_VIDEO_ID_LENGTH = 11;
const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';
const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

function retrieveVideoId(videoId) {
  if (videoId.length === YOUTUBE_VIDEO_ID_LENGTH) return videoId;

  const match = RE_YOUTUBE.exec(videoId);
  if (match?.[1]) return match[1];

  throw new Error('Unable to retrieve YouTube video ID.');
}

async function fetchVideoPage(videoId, lang) {
  try {
    const response = await fetch(`${YOUTUBE_VIDEO_URL}${videoId}`, {
      headers: {
        ...(lang && { 'Accept-Language': lang }),
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new TooManyRequestsError();
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new Error(`Failed to fetch video page (${videoId}): ${error.message}`);
    } else {
      throw new Error(`Failed to fetch video page (${videoId}): An unknown error occurred`);
    }
  }
}

function parseVideoDetails(body) {
  const initialPlayerResponseMatch = /ytInitialPlayerResponse\s*=\s*(\{.*?\});/s.exec(body);

  if (!initialPlayerResponseMatch) {
    throw new Error('Failed to extract initial player response');
  }

  let initialPlayerResponse;
  try {
    if (initialPlayerResponseMatch?.[1]) {
      initialPlayerResponse = JSON.parse(initialPlayerResponseMatch[1]);
    } else {
      throw new Error('Initial player response match is undefined or empty');
    }
  } catch (error) {
    throw new Error(`Failed to parse initial player response JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const videoDetails = initialPlayerResponse.videoDetails;

  if (!videoDetails) {
    throw new Error('Video details not found in initial player response');
  }

  const {
    title,
    author: channelTitle,
    shortDescription: description,
    thumbnail,
    publishDate: publishedAt,
  } = videoDetails;

  const thumbnails = thumbnail?.thumbnails;
  const thumbnailUrl = thumbnails?.[thumbnails.length - 1]?.url || '';

  return {
    title,
    channelTitle,
    description,
    thumbnailUrl,
    publishedAt,
    transcript: [],
    videoId: '',
  };
}

function parseCaptionsData(body, videoId) {
  const captionsJSON = body.split('"captions":')[1]?.split(',"videoDetails')[0]?.trim();

  if (!captionsJSON) {
    if (body.includes('class="g-recaptcha"')) {
      throw new TooManyRequestsError();
    }
    if (!body.includes('"playabilityStatus":')) {
      throw new VideoUnavailableError(videoId);
    }
    throw new TranscriptDisabledError(videoId);
  }

  try {
    const parsedCaptions = JSON.parse(captionsJSON);
    return parsedCaptions;
  } catch {
    throw new TranscriptDisabledError(videoId);
  }
}

function getAvailableLanguages(captionsData) {
  return captionsData.playerCaptionsTracklistRenderer.captionTracks.map(
    (track) => track.languageCode
  );
}

function selectTranscriptTrack(captionsData, videoId, lang) {
  const captionTracks = captionsData.playerCaptionsTracklistRenderer.captionTracks;

  if (!captionTracks || captionTracks.length === 0) {
    throw new TranscriptNotAvailableError(videoId);
  }

  if (lang) {
    const availableLangs = getAvailableLanguages(captionsData);
    const track = captionTracks.find((t) => t.languageCode === lang);

    if (!track) {
      throw new LanguageNotAvailableError(videoId, lang, availableLangs);
    }

    return track;
  }

  const track = captionTracks[0];
  if (!track) {
    throw new TranscriptNotAvailableError(videoId);
  }
  return track;
}

async function fetchTranscriptData(transcriptUrl) {
  const response = await fetch(transcriptUrl, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch transcript data.');
  }

  return response.text();
}

function parseTranscriptData(transcriptBody, lang) {
  const matches = Array.from(transcriptBody.matchAll(RE_XML_TRANSCRIPT));

  if (matches.length === 0) {
    throw new Error('Failed to parse transcript data: No matches found');
  }

  return matches.map((match) => {
    const [, start = '0', duration = '0', text = ''] = match;

    return {
      text,
      duration: parseFloat(duration),
      offset: parseFloat(start),
      lang,
    };
  });
}

async function fetchVideoDetails(videoId, config = { lang: null }) {
  try {
    const id = retrieveVideoId(videoId);
    const body = await fetchVideoPage(id, config.lang);

    const videoDetails = parseVideoDetails(body);

    const captionsData = parseCaptionsData(body, id);
    const transcriptTrack = selectTranscriptTrack(captionsData, id, config.lang);
    const transcriptBody = await fetchTranscriptData(transcriptTrack.baseUrl);

    const transcriptResponses = parseTranscriptData(transcriptBody, transcriptTrack.languageCode);
    videoDetails.transcript = transcriptResponses;
    videoDetails.videoId = videoId;

    return videoDetails;
  } catch (error) {
    if (
      error instanceof VideoUnavailableError ||
      error instanceof TranscriptDisabledError ||
      error instanceof TooManyRequestsError ||
      error instanceof TranscriptNotAvailableError ||
      error instanceof LanguageNotAvailableError
    ) {
      throw error;
    }

    if (error instanceof Error) {
      throw new Error(`Failed to fetch transcript: ${error.message}`);
    }

    throw new Error('Failed to fetch transcript: An unknown error occurred');
  }
}

export {
  fetchVideoDetails,
  VideoUnavailableError,
  TranscriptDisabledError,
  TooManyRequestsError,
  TranscriptNotAvailableError,
  LanguageNotAvailableError,
}; 
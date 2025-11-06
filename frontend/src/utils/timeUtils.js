// src/utils/timeUtils.js
export const formatProcessingTime = (seconds) => {
  if (!seconds) return "N/A";
  if (seconds < 60) {
    return `${seconds.toFixed(1)} seconds`;
  } else if (seconds < 3600) {
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)} minutes`;
  } else {
    const hours = seconds / 3600;
    return `${hours.toFixed(1)} hours`;
  }
};

export const formatMilliseconds = (milliseconds) => {
  if (milliseconds == null) return "";
  if (milliseconds <= 0) return "0 sec";

  const totalSeconds = Math.floor(milliseconds / 1000);
  if (totalSeconds === 0) return "<1 sec";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours) parts.push(`${hours} hr`);
  if (minutes) parts.push(`${minutes} min`);
  // always show seconds for clarity
  parts.push(`${seconds} sec`);

  return parts.join(" ");
};

export const computeProcessingDurationMs = (doc) => {
  if (!doc || !doc.created_at) return null;
  const start = Date.parse(doc.created_at);
  if (Number.isNaN(start)) return null;
  const end = doc.updated_at ? Date.parse(doc.updated_at) : null;
  if (!end || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
};

export const formatProcessingDuration = (doc) => {
  const ms = computeProcessingDurationMs(doc);
  return ms ? `Processing Time: ${formatMilliseconds(ms)}` : "";
};

export const getLastUpdated = (dateString) => {
  const pastDate = new Date(dateString);
  const now = new Date();
  const diffMs = now - pastDate;

  if (diffMs < 0) {
    return "in the future";
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30); // Approximate months

  if (diffSec < 60) {
    return diffSec === 1 ? "1 second ago" : `${diffSec} seconds ago`;
  }
  if (diffMin < 60) {
    return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`;
  }
  if (diffHour < 24) {
    return diffHour === 1 ? "1 hour ago" : `${diffHour} hours ago`;
  }
  if (diffDay < 7) {
    return diffDay === 1 ? "1 day ago" : `${diffDay} days ago`;
  }
  if (diffWeek < 4) {
    return diffWeek === 1 ? "1 week ago" : `${diffWeek} weeks ago`;
  }
  return diffMonth === 1 ? "1 month ago" : `${diffMonth} months ago`;
};

// DeArrow's titles: the crowdsourced one when it is trusted, else YouTube's
// own, either of them with the submitter's ">" markers taken out.
//
// This build has no title formatter: the extension's formatter needs `Intl`
// features Chromium 38 does not have (it was only ever enabled on webOS 5 and
// 6), so titles keep the case they were written in and the settings carry no
// formatting rows.
import { configRead } from '../../core/config.js';

// The formatter's "leave this word as written" marker: ">" before a word, at
// the start of the title or after a space.
const MARKER_RE = /(^|\s)>(\S)/g;

/** The title as the formatter's unformatted path leaves it: markers out, ends trimmed. */
export function formatTitleInternal(title) {
  return title.replace(MARKER_RE, '$1$2').trim();
}

/**
 * A submission DeArrow would show: not the original, and locked or voted
 * zero or above.
 */
export function isTrusted(entry) {
  return !!entry && !entry.original && (entry.locked || entry.votes >= 0);
}

/** The crowdsourced title the settings let a video show: the top one when it is trusted, else null. */
export function crowdsourcedTitle(video) {
  if (!configRead('dearrowCrowdTitles')) return null;
  const custom = video.raw && video.raw.titles ? video.raw.titles[0] : null;
  return isTrusted(custom) ? custom : null;
}

/**
 * The title a video's tiles should show, or null for YouTube's own: the top
 * crowdsourced one when it is trusted, else the original when taking the
 * markers out changes it.
 */
export function resolveTitle(video) {
  const custom = crowdsourcedTitle(video);
  if (custom) return Promise.resolve(formatTitleInternal(custom.title));

  if (!video.original) return Promise.resolve(null);
  const formatted = formatTitleInternal(video.original);
  return Promise.resolve(formatted !== video.original ? formatted : null);
}

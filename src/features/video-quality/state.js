// Everything the video-quality modules share: the constants, the player handle
// and the per-session flags. Scalars live on `vq` so every module reads and
// writes the same value; the Set is exported directly.

// Every label the player reports once it has negotiated a quality, from
// 'highres' down to 'tiny'. "Known" means the player has settled, not that the
// top rung is in use: API-level forcing only runs while it is still 'unknown',
// and the localStorage key is what actually asks for 2160p.
export const KNOWN_QUALITIES = new Set([
  'highres',
  'hd2160',
  'hd1440',
  'hd1080',
  'hd720',
  'large',
  'medium',
  'small',
  'tiny'
]);

export const QUALITY_KEY = 'yt-player-quality';
export const ONE_YEAR_MS = 31536000000; // 365 * 24 * 60 * 60 * 1000
// The app reads an expired preference as none: ours is written again, dated
// from now, once it is this close to its expiration (30 days).
export const RENEW_BEFORE_MS = 2592000000;

export const vq = {
  shouldForce: false,

  player: null,
  lastVideoId: null,
  // From init to destroy: the player listener and the poll for the player.
  bag: null,
  poll: null,
  navTimer: null,
  lastWriteTime: 0,
  videoBeingProcessed: null
};

export const qualitySetForVideo = new Set();

// How often the quality was forced through the player API rather than by the
// stored preference: `apiUpgrades` the setPlaybackQualityRange calls, of
// which `intercepts` paused a playing video for it. Read on the TV from the
// web inspector as window.__ytafQualityStats: whether this path ever runs
// there decides whether it stays.
export const qualityStats = { apiUpgrades: 0, intercepts: 0 };

/**
 * Whether quality is forced now: Force Max Quality is on and the player is not an inline preview.
 */
export function isForceEnabled() {
  return vq.shouldForce && (!vq.player?.isInline || !vq.player.isInline());
}

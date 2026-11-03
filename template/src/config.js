// src/config.js - the film's technical spec. Everything else reads these numbers, on the page and in Node.
const PROJECT = {
  title: 'Wind Past the Piano',
  film: 'wind',         // the active film: 'wind' (2.5D, the default route) or 'piano' (the earlier 3D one)
  duration: 12.0,       // seconds; the timeline must tile exactly this
  fps: 24,
  width: 1920,
  height: 1080,
  aspect: '16:9',       // 1920x1080 is the default. A 3:2 photographic frame is a composition reference, not a crop.
  audio: '',            // set to 'assets/score.m4a' once audio/score.mjs has been run
};
const W = PROJECT.width, H = PROJECT.height, FPS = PROJECT.fps;

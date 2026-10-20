const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

// Keep preview output separate so production checks cannot break a running preview.
module.exports = (phase) => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});

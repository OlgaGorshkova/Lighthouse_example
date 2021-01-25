'use strict';

const constants = require('./constants.js');

const config = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    throttling: constants.throttling.desktopDense4G,
    screenEmulation: constants.screenEmulationMetrics.desktop,
    emulatedUserAgent: constants.userAgents.desktop,
  },
};

module.exports = config;

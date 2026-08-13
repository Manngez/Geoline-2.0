'use strict';
// Geoline is split into classic scripts for maintainability. This loader runs
// during document parsing so all modules are available before DOMContentLoaded.
// Bump this value whenever runtime assets change so phones do not keep stale game code.
const GEOLINE_ASSET_VERSION = '20260813-2220';
const versioned = path => `${path}?v=${GEOLINE_ASSET_VERSION}`;
document.write(`<link rel="stylesheet" href="${versioned('game-ui.css')}">`);
document.write(`<script src="${versioned('app-core.js')}"><\/script>`);
document.write(`<script src="${versioned('app-map.js')}"><\/script>`);
document.write(`<script src="${versioned('app-game.js')}"><\/script>`);
document.write(`<script src="${versioned('settlement-filter.js')}"><\/script>`);
document.write(`<script src="${versioned('app-online.js')}"><\/script>`);
document.write(`<script src="${versioned('app-classroom.js')}"><\/script>`);
document.write(`<script src="${versioned('state-capitals.js')}"><\/script>`);
document.write(`<script src="${versioned('game-ui.js')}"><\/script>`);

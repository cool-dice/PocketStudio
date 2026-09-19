// bun:test + bun:sqlite for product tests and scripts.
// Do not `/// <reference types="bun-types" />` here: the full package
// overrides DOM `fetch` (adds `preconnect`) and breaks test mocks.
/// <reference path="./node_modules/bun-types/test.d.ts" />
/// <reference path="./node_modules/bun-types/sqlite.d.ts" />

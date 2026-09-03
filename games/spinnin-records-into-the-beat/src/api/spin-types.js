/**
 * Typed spin API contracts.
 */

/** @typedef {Object} DealEvent @property {'deal'} type @property {number[][]} grid */
/** @typedef {Object} ClusterWinEvent @property {'cluster_win'} type */
/** @typedef {Object} SpinState @property {number} [fsRemaining] @property {number} [fsMultiplier] @property {number} [multiplierSum] */
/** @typedef {Object} SpinResult @property {number[][]} symbols @property {number} win @property {number} balance @property {number} bet @property {object[]} [events] @property {SpinState} [state] */
/** @typedef {Object} SessionInfo @property {number} balance @property {number} bet @property {number[]} betLevels @property {SpinState} state */

export {};

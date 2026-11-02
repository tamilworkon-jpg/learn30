// localStorage keys. Progress now lives on the server (T189); these remain only so the legacy
// "Import progress saved in this browser" offer can find what older versions stored.
export const STORAGE_KEY = 'aip-course:v1';
/** Pre-T189 local profiles: progress of profile <id> was under `aip-course:v1:p:<id>`. */
export const LEGACY_PROFILES_KEY = 'aip-profiles:v1';
export const LEGACY_PROFILE_PREFIX = `${STORAGE_KEY}:p:`;
/** The learner's answer to the one-time import offer, remembered per browser. */
export const IMPORT_DECISION_KEY = 'aip-import-offer:v1';

declare module '*.yaml?raw' {
  const content: string;
  export default content;
}

/** true in e2e builds (AIP_FIXTURE_COURSES=1): test-only fixture courses from tests/fixtures/courses/ are
 *  included (Learn30 spec 002). Set by astro.config.mjs `vite.define`; undefined in tsx/vitest. */
declare const __AIP_FIXTURE_COURSES__: boolean | undefined;

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "child-run.workflow.ts",
  timeout: 60000,
  retries: 0,
  workers: 1,
  forbidOnly: true,
  globalSetup: "../run-setup.ts",
  globalTeardown: "../run-teardown.ts",
  reporter: [["list", { printFailuresInline: true }]]
});

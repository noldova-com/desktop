/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { ClassMetadataCoverage } from "./scripts/angular/class-metadata-coverage.ts";
import { FailedModuleRequests } from "./scripts/angular/failed-module-requests.ts";
import { FontResponseLog } from "./scripts/angular/font-response-log.ts";
import { TestHangGuard } from "./scripts/angular/test-hang-guard.ts";

const compilerOptions: { paths: Record<string, string[]> } = JSON.parse(readFileSync(new URL("./tsconfig.spec.json", import.meta.url), "utf8")).compilerOptions;

const cacheDir = fileURLToPath(new URL("../../node_modules/.vite", import.meta.url));

export default defineConfig({
  plugins: [new ClassMetadataCoverage(), new FontResponseLog(), new TestHangGuard(), { name: "noldova:cache-dir", config: { order: "pre", handler: () => ({ cacheDir }) } }],
  optimizeDeps: {
    include: ["@noldova/context.json"]
  },
  resolve: {
    alias: Object.fromEntries(Object.entries(compilerOptions.paths).map(([name, targets]) => [name, fileURLToPath(new URL(String(targets[0]), import.meta.url))]))
  },
  test: {
    attachmentsDir: fileURLToPath(new URL("../../.vitest/attachments", import.meta.url)),
    browser: { api: { host: "127.0.0.1" }, commands: { watchFailedModuleRequests: new FailedModuleRequests().watch } },
    coverage: {
      reportsDirectory: fileURLToPath(new URL("../../_build/angular-coverage", import.meta.url))
    },
    retry: process.env["NOLDOVA_TEST_RETRY"] === "1" ? 1 : 0
  }
});

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import "@noldova/context.core";
import { DataDirectory } from "@noldova/desktop.runtime";
import { expect, test } from "@playwright/test";

import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";

const PROBE: string = path.join(import.meta.dirname, "fixtures", "zz-startup-probe.cjs");
const OUTPUT: string = path.resolve("_build", "startup-timing");
const STARTS: number = Number(process.env["DESKTOP_STARTS"] ?? "8");
const LABEL: string = process.env["DESKTOP_TIMING_LABEL"] ?? "run";

for (let index = 0; index < STARTS; index++)
  test(`times start ${index + 1} from launch to the runtime's endpoint`, async ({}, testInfo) => {
    mkdirSync(OUTPUT, { recursive: true });
    const log = path.join(OUTPUT, `${LABEL}-${process.platform}-${index + 1}.log`);
    const launched = Date.now();
    const mainProcess = await MainProcessFixture.launchAsync(testInfo, { DESKTOP_STARTUP_LOG: log, NODE_OPTIONS: `--require ${JSON.stringify(PROBE)}` });
    try {
      const discovery = new DataDirectory(mainProcess.dataDirectory).discoveryFile;
      await expect.poll(() => existsSync(discovery), { timeout: 60_000 }).toBe(true);
      await expect(mainProcess.window.locator("body")).toBeVisible();
      writeFileSync(path.join(OUTPUT, `${LABEL}-${process.platform}-${index + 1}.json`), JSON.stringify({
        launched,
        published: statSync(discovery).mtimeMs,
        main: readFileSync(log, "utf8").split("\n").filter(t => t !== "").map(t => JSON.parse(t) as unknown)
      }, null, 1));
    }
    finally {
      await mainProcess.disposeAsync();
    }
  });

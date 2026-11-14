/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ChildRunFixture } from "../child-run.fixture.ts";
import { test } from "../main-process-test.fixture.ts";
import { OutlivingProcess } from "../outliving-process.ts";
import { WaitFixture } from "../wait.fixture.ts";
import { WholeFile } from "../whole-file.ts";

const holdLimit = 45_000;

test.afterEach(() => OutlivingProcess.releaseAllAsync());

test("its worker ends while Noldova Desktop Sample runs", async ({ mainProcess }, testInfo) => {
  const lost = { runtime: await mainProcess.readRuntimeProcessIdAsync(), processIds: mainProcess.recordedProcessIds, root: mainProcess.root };
  await WholeFile.writeAsync(path.join(path.dirname(testInfo.project.outputDir), ChildRunFixture.LOST_FILE), JSON.stringify(lost));
  process.kill(process.pid, "SIGKILL");
});

test("its worker hangs while Noldova Desktop Sample runs", async ({ mainProcess }, testInfo) => {
  const hung = { worker: process.pid, processIds: mainProcess.recordedProcessIds, root: mainProcess.root };
  await WholeFile.writeAsync(path.join(path.dirname(testInfo.project.outputDir), ChildRunFixture.HUNG_FILE), JSON.stringify(hung));
  console.log(ChildRunFixture.HUNG);
  await new Promise(() => undefined);
});

test("it holds Noldova Desktop Sample until its release", async ({ mainProcess }, testInfo) => {
  const folder = path.dirname(testInfo.project.outputDir);
  const held = { worker: process.pid, main: await mainProcess.application.evaluate(() => process.pid), runtime: await mainProcess.readRuntimeProcessIdAsync(), root: mainProcess.root };
  await WholeFile.writeAsync(path.join(folder, ChildRunFixture.HELD_FILE), JSON.stringify(held));
  console.log(ChildRunFixture.HELD);

  await WaitFixture.untilAsync(() => existsSync(path.join(folder, ChildRunFixture.RELEASE_FILE)), "the test to release the held run", holdLimit);
});

test("it starts a process that outlives Noldova Desktop Sample and then fails", async ({ mainProcess }, testInfo) => {
  const outliving = await OutlivingProcess.startAsync(mainProcess, testInfo);
  await WholeFile.writeAsync(path.join(path.dirname(testInfo.project.outputDir), ChildRunFixture.OUTLIVING_FILE), JSON.stringify({ outliving }));
  throw new Error("The child run's workflow failed right after it started a process that outlives Noldova Desktop Sample.");
});

test("it ends at once", async ({}, testInfo) => {
  await mkdir(testInfo.project.outputDir, { recursive: true });
  await WholeFile.writeAsync(path.join(testInfo.project.outputDir, ChildRunFixture.TEMPORARY_FILE), os.tmpdir());
});

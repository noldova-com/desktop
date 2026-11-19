/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { DataDirectory, OwnershipLock } from "@noldova/desktop.runtime";

import { ChildRunFixture } from "./fixtures/child-run.fixture.ts";
import { ClockWorkFixture } from "./fixtures/clock-work.fixture.ts";
import { ErrorCodeFixture } from "./fixtures/error-code.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { OutlivingProcess } from "./fixtures/outliving-process.ts";
import { ProcessListFixture } from "./fixtures/process-list.fixture.ts";
import { ProcessRecord } from "./fixtures/process-record.ts";
import { ProcessStartTimes } from "./fixtures/process-start-times.ts";
import { ProcessTree } from "./fixtures/process-tree.ts";
import { RunRecords } from "./fixtures/run-records.ts";
import { TestRoots } from "./fixtures/test-roots.ts";
import { UiRun } from "./fixtures/ui-run.ts";
import { WaitFixture } from "./fixtures/wait.fixture.ts";
import { WholeFile } from "./fixtures/whole-file.ts";

function readProcessIds(record: JsonReader): number[] {
  const processIds = record.readValue("processIds");
  return Array.isArray(processIds) ? processIds.filter(Object.isNumber) : [];
}

test.describe("the harness's teardown", () => {
  const childRunTestLimit = 180_000;
  const childRunLimit = 90_000;
  const twoChildRunsTestLimit = 400_000;
  const exitLimit = 15_000;
  const holderScript = "process.stdin.on('end', () => process.exit(0)).resume();";

  const startHolderAsync = async (folder: string, marker: string): Promise<ChildProcess> => {
    const holder = spawn(process.execPath, ["-e", holderScript, marker], { cwd: folder, stdio: ["pipe", "ignore", "ignore"], windowsHide: true });
    await new Promise((resolve, reject) => {
      holder.once("spawn", resolve);
      holder.once("error", reject);
    });
    return holder;
  };

  test.afterEach(() => OutlivingProcess.releaseAllAsync());

  const inTemporaryFolderAsync = async <T>(folder: string, action: () => Promise<T>): Promise<T> => {
    const name = process.platform === "win32" ? "TEMP" : "TMPDIR";
    const saved = process.env[name];
    process.env[name] = folder;
    try {
      return await action();
    }
    finally {
      if (Object.isUndefined(saved))
        delete process.env[name];
      else
        process.env[name] = saved;
    }
  };

  test("finds no runtime to stop in a directory whose ownership file is not a database, and fails on any other error reading it", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "desktop-teardown-"));
    try {
      const corrupt = path.join(folder, "corrupt");
      const unreadable = path.join(folder, "unreadable");
      await mkdir(corrupt);
      await writeFile(new DataDirectory(corrupt).ownershipDatabase, "This is not a database.");
      await mkdir(new DataDirectory(unreadable).ownershipDatabase, { recursive: true });

      await MainProcessFixture.stopRuntimeAsync(corrupt);
      const failure = await MainProcessFixture.stopRuntimeAsync(unreadable).then(() => null, (error: unknown) => error);

      expect(failure).toMatchObject({ errcode: expect.any(Number) });
      expect(ErrorCodeFixture.errcodeOf(failure)).not.toBe(26);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

  test("waits until every process has left the process list, however long it runs", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "desktop-teardown-"));
    const holder = await startHolderAsync(folder, path.join(folder, "holder"));
    let awaited: readonly number[] = [];
    let isSettled = false;
    try {
      const waiting = ProcessListFixture.waitForExitAsync([holder.pid ?? 0], 60_000, t => {
        awaited = t;
      }).finally(() => {
        isSettled = true;
      });
      await expect.poll(() => awaited.includes(holder.pid ?? 0) || isSettled).toBe(true);
      const wasSettled = isSettled;
      holder.stdin?.end();

      expect(wasSettled).toBe(false);
      expect(await waiting).toEqual([]);
      expect(await ProcessListFixture.readRunningAsync([holder.pid ?? 0])).toEqual([]);
    }
    finally {
      holder.stdin?.end();
      await rm(folder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

  test("gives up at its limit and names each process that still runs", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "desktop-teardown-"));
    const holder = await startHolderAsync(folder, path.join(folder, "holder"));
    try {
      const running = await ProcessListFixture.waitForExitAsync([holder.pid ?? 0], 500);
      const described = await ProcessListFixture.describeAsync(running);

      expect(running).toEqual([holder.pid]);
      expect(described).toContain(`${holder.pid} `);
      expect(described.toLowerCase()).toContain(path.basename(process.execPath).toLowerCase());
    }
    finally {
      holder.stdin?.end();
      await rm(folder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

  const runtimeFiles = (dataDirectory: string): string[] => {
    const directory = new DataDirectory(dataDirectory);
    return [directory.shellDatabase, `${directory.shellDatabase}-wal`, `${directory.shellDatabase}-shm`, directory.ownershipDatabase, directory.runtimeLog];
  };

  test("stops the runtime by asking it, so it closes its database and the files it held can be removed as soon as the stop returns", async ({ mainProcess }) => {
    const files = runtimeFiles(mainProcess.dataDirectory);
    const held = files.filter(t => existsSync(t));
    expect(await mainProcess.closeAsync(true)).toBe(0);

    await MainProcessFixture.stopRuntimeAsync(mainProcess.dataDirectory);
    const isOwned = OwnershipLock.isOwned(new DataDirectory(mainProcess.dataDirectory));
    const left = files.filter(t => existsSync(t));
    for (const file of left)
      rmSync(file);

    expect(held).toEqual(files);
    expect(isOwned).toBe(false);
    expect(left).toEqual([files[0], ...files.slice(3)]);
    expect(left.filter(t => existsSync(t))).toEqual([]);
  });

  test.describe("with data from an earlier Noldova Desktop Sample", () => {
    test.use({ mainProcessDataFiles: { "conversations.json": "[]" } });

    test("stops the runtime that refuses that data, so the files it held can be removed as soon as the stop returns", async ({ mainProcess }) => {
      await expect(mainProcess.window.getByRole("heading", { name: "Data from an earlier Noldova Desktop Sample" })).toBeVisible();
      const files = runtimeFiles(mainProcess.dataDirectory);
      const held = files.filter(t => existsSync(t));
      expect(await mainProcess.closeAsync(true)).toBe(0);

      await MainProcessFixture.stopRuntimeAsync(mainProcess.dataDirectory);
      const isOwned = OwnershipLock.isOwned(new DataDirectory(mainProcess.dataDirectory));
      for (const file of held)
        rmSync(file);

      expect(held).toEqual(files.slice(3));
      expect(isOwned).toBe(false);
      expect(held.filter(t => existsSync(t))).toEqual([]);
    });
  });

  test("records every process Noldova Desktop Sample runs, its Electron processes and its runtime, and removes its folder once they have all ended", async ({ mainProcess }) => {
    const electron = await mainProcess.application.evaluate(({ app }) => app.getAppMetrics().map(t => t.pid));
    const runtime = await mainProcess.readRuntimeProcessIdAsync();
    await mainProcess.checkpointAsync("teardown-running");

    await mainProcess.disposeAsync(false);

    expect(runtime).toBeDefined();
    expect(mainProcess.recordedProcessIds).toEqual(expect.arrayContaining([...electron, runtime ?? 0]));
    expect(await ProcessListFixture.waitForSignalsAsync(mainProcess.recordedProcessIds, 0)).toEqual([]);
    expect(existsSync(mainProcess.root)).toBe(false);
  });

  test("a process Noldova Desktop Sample started that outlives it fails the teardown, which names it, though Electron does not list it", async ({ mainProcess }, testInfo) => {
    test.setTimeout(120_000);
    const outliving = await OutlivingProcess.startAsync(mainProcess, testInfo);
    const electron = await mainProcess.application.evaluate(({ app }) => app.getAppMetrics().map(t => t.pid));

    const failure = await mainProcess.disposeAsync(false).then(() => String.empty, (error: unknown) => ErrorCodeFixture.messageOf(error));
    const isRunning = MainProcessFixture.isAlive(outliving);
    ProcessRecord.killIfRunning(outliving);
    const left = await ProcessListFixture.waitForExitAsync([outliving], exitLimit);

    expect(electron).not.toContain(outliving);
    expect(isRunning).toBe(true);
    expect(failure).toMatch(new RegExp(`^Noldova Desktop Sample's processes (?:.+; )?${outliving} [^;]*watch[^;]* still run 30 s after it closed, so its folder `));
    expect(left).toEqual([]);
  });

  test("a spec that fails right after it starts a process that outlives Noldova Desktop Sample leaves that process ended within 15 s", async ({}, testInfo) => {
    test.setTimeout(childRunTestLimit);
    const run = await ChildRunFixture.startAsync(testInfo.outputPath("child-run"), "outliving", "it starts a process that outlives Noldova Desktop Sample and then fails");
    const code = await run.endAsync(childRunLimit);
    const outliving = JsonReader.parse(await readFile(path.join(run.folder, ChildRunFixture.OUTLIVING_FILE), "utf8")).readInteger("outliving");
    const running = await ProcessListFixture.waitForExitAsync([outliving], exitLimit);
    for (const processId of running)
      ProcessRecord.killIfRunning(processId);

    expect(running).toEqual([]);
    expect(run.output).toContain("The child run's workflow failed right after it started a process that outlives Noldova Desktop Sample.");
    expect(code).toBe(1);
  });

  test("a worker that ends while Noldova Desktop Sample runs leaves its processes to the run's teardown, which stops them by their recorded ids, removes the folder and fails the run", async ({}, testInfo) => {
    test.setTimeout(childRunTestLimit);
    const run = await ChildRunFixture.startAsync(testInfo.outputPath("child-run"), "lost", "its worker ends while Noldova Desktop Sample runs");
    const code = await run.endAsync(childRunLimit);
    const lostRecord = JsonReader.parse(await readFile(path.join(run.folder, ChildRunFixture.LOST_FILE), "utf8"));
    const lost = { runtime: lostRecord.readInteger("runtime"), processIds: readProcessIds(lostRecord), root: lostRecord.readString("root") };
    const running = await ProcessListFixture.waitForExitAsync(lost.processIds, exitLimit);
    for (const processId of running)
      ProcessRecord.killIfRunning(processId);
    await ProcessListFixture.waitForExitAsync(running, exitLimit);
    const kept = existsSync(lost.root);
    await rm(lost.root, { recursive: true, force: true });

    expect(running).toEqual([]);
    expect(kept).toBe(false);
    expect(run.output).toContain(`${lost.runtime}, by its recorded id:`);
    expect(code).toBe(1);
  });

  test("a child run that does not end is killed with every process it started, its ended run's records are cleaned up, and the failure keeps its output", async ({}, testInfo) => {
    test.setTimeout(childRunTestLimit);
    const run = await ChildRunFixture.startAsync(testInfo.outputPath("child-run"), "hung", "its worker hangs while Noldova Desktop Sample runs");
    const failure = await run.endAsync(childRunLimit, () => run.output.includes(ChildRunFixture.HUNG)).then(() => null, (error: unknown) => error);
    const hungRecord = JsonReader.parse(await readFile(path.join(run.folder, ChildRunFixture.HUNG_FILE), "utf8"));
    const hung = { worker: hungRecord.readInteger("worker"), processIds: readProcessIds(hungRecord), root: hungRecord.readString("root") };
    const running = await ProcessListFixture.waitForExitAsync([hung.worker, ...hung.processIds], exitLimit);
    const kept = existsSync(hung.root);
    const records = await readdir(path.join(run.folder, "processes"));

    expect(failure).toBeInstanceOf(Error);
    expect(ErrorCodeFixture.messageOf(failure)).toContain(`The child run hung was given up on, so it was killed with the `);
    expect(ErrorCodeFixture.messageOf(failure)).toContain(ChildRunFixture.HUNG);
    expect(running).toEqual([]);
    expect(kept).toBe(false);
    expect(records).toEqual([]);
    expect(run.hasEnded).toBe(true);
  });

  test("a run that starts while another run's Noldova Desktop Sample runs leaves it running, each run keeps its folders in a temporary folder of its own, "
    + "and each stops only its own processes and removes only its own folders", async ({}, testInfo) => {
    test.setTimeout(twoChildRunsTestLimit);
    const folder = testInfo.outputPath("child-run");
    const held = await ChildRunFixture.startAsync(folder, "held", "it holds Noldova Desktop Sample until its release");
    const { ids, beside, besideCode, running } = await (async () => {
      await WaitFixture.untilAsync(() => held.output.includes(ChildRunFixture.HELD) || held.hasEnded, "the held run to hold Noldova Desktop Sample or end", childRunLimit);
      expect(held.output).toContain(ChildRunFixture.HELD);
      const heldRecord = JsonReader.parse(await readFile(path.join(folder, ChildRunFixture.HELD_FILE), "utf8"));
      const heldIds = { main: heldRecord.readInteger("main"), runtime: heldRecord.readInteger("runtime"), root: heldRecord.readString("root") };
      const besideRun = await ChildRunFixture.startAsync(folder, "beside", "it ends at once");
      const code = await besideRun.endAsync(childRunLimit);
      return { ids: heldIds, beside: besideRun, besideCode: code, running: await ProcessListFixture.readRunningAsync([heldIds.main, heldIds.runtime]) };
    })().finally(() => WholeFile.writeAsync(path.join(folder, ChildRunFixture.RELEASE_FILE), String.empty));
    const heldCode = await held.endAsync(childRunLimit);
    const left = await ProcessListFixture.waitForExitAsync([ids.main, ids.runtime], exitLimit);
    const records = await readdir(path.join(folder, "processes"));
    const besideFolder = await readFile(path.join(beside.resultsFolder, ChildRunFixture.TEMPORARY_FILE), "utf8");
    const heldFolder = path.dirname(ids.root);

    expect(besideCode, beside.output).toBe(0);
    expect(heldFolder).not.toBe(besideFolder);
    expect([path.dirname(heldFolder), path.dirname(besideFolder)]).toEqual([os.tmpdir(), os.tmpdir()]);
    expect([heldFolder, besideFolder].filter(t => existsSync(t))).toEqual([]);
    expect(running).toEqual([ids.main, ids.runtime]);
    expect(heldCode, held.output).toBe(0);
    expect(left).toEqual([]);
    expect(existsSync(ids.root)).toBe(false);
    expect(records).toEqual([]);
  });

  test("a run whose temporary folder is not a run folder keeps its folder in the run base, and its set-up removes an ended run's folder left there", async ({}, testInfo) => {
    test.setTimeout(childRunTestLimit);
    const folder = testInfo.outputPath("child-run");
    const temporary = testInfo.outputPath("temporary");
    await mkdir(temporary, { recursive: true });
    const base = TestRoots.baseFor(temporary);
    const started = (await ProcessStartTimes.readAsync([])).own;
    const endedFolder = await mkdtemp(path.join(base, "ui-run-"));
    try {
      await WholeFile.writeAsync(path.join(endedFolder, TestRoots.MARKER), new UiRun(process.pid, started + 1000).id);

      const run = await inTemporaryFolderAsync(temporary, () => ChildRunFixture.startAsync(folder, "beside", "it ends at once"));
      const code = await run.endAsync(childRunLimit);
      const runFolder = await readFile(path.join(run.resultsFolder, ChildRunFixture.TEMPORARY_FILE), "utf8");

      expect(code, run.output).toBe(0);
      expect(base).toBe(process.platform === "win32" ? temporary : "/tmp");
      expect(path.dirname(runFolder)).toBe(base);
      expect(path.basename(runFolder)).toMatch(/^ui-run-[A-Za-z0-9]{6}$/);
      expect([runFolder, endedFolder].filter(t => existsSync(t))).toEqual([]);
    }
    finally {
      await rm(endedFolder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

  test("a test folder without a run marker, such as another harness's, only makes the run's teardown warn, and is left alone", async ({}, testInfo) => {
    test.setTimeout(childRunTestLimit);
    const unmarked = await mkdtemp(path.join(os.tmpdir(), "desktop-ui-w00-"));
    try {
      const run = await ChildRunFixture.startAsync(testInfo.outputPath("child-run"), "unmarked", "it ends at once");
      const code = await run.endAsync(childRunLimit);

      expect(code, run.output).toBe(0);
      expect(run.output).toContain("These test folders have no readable run marker, which every test folder of this harness gets before it has its name, so whose they are is unknown and they are left alone:");
      expect(run.output).toContain(unmarked);
      expect(existsSync(unmarked)).toBe(true);
    }
    finally {
      await rm(unmarked, { recursive: true, force: true });
    }
  });

  test("a folder that a worker began to create but never marked only makes the run's teardown warn, and is left alone", async ({}, testInfo) => {
    test.setTimeout(childRunTestLimit);
    const staging = await mkdtemp(path.join(os.tmpdir(), "desktop-ui-new-"));
    try {
      const run = await ChildRunFixture.startAsync(testInfo.outputPath("child-run"), "staging", "it ends at once");
      const code = await run.endAsync(childRunLimit);

      expect(code, run.output).toBe(0);
      expect(run.output).toContain("These folders that a UI worker began to create never got their run marker, so whose they are is unknown and they are left alone:");
      expect(run.output).toContain(staging);
      expect(existsSync(staging)).toBe(true);
    }
    finally {
      await rm(staging, { recursive: true, force: true });
    }
  });

  test("the cleanup of ended runs stops the processes of a run whose runner's id now has another start time, sets apart those of other checkouts' runs, "
    + "and leaves a run whose runner still runs alone", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "desktop-teardown-"));
    const records = new RunRecords(path.join(folder, "results"));
    const started = (await ProcessStartTimes.readAsync([])).own;
    const ended = { run: new UiRun(process.pid, started + 1000), root: path.join(folder, "ended") };
    const live = { run: new UiRun(process.pid, started), root: path.join(folder, "live") };
    const owned = { run: ended.run, root: path.join(folder, "desktop-ui-w0-owned1") };
    const other = { run: new UiRun(process.pid, started + 2000), root: path.join(folder, "desktop-ui-w0-other1") };
    const holders: ChildProcess[] = [];
    try {
      for (const { run, root } of [ended, live]) {
        const dataDirectory = path.join(root, "data");
        await mkdir(dataDirectory, { recursive: true });
        holders.push(await startHolderAsync(folder, path.join(dataDirectory, "holder")));
        await records.recordOf(run).createAsync();
        await records.recordOf(run).appendAsync(0, { root, dataDirectory, processIds: [] });
      }
      for (const { run, root } of [owned, other]) {
        await mkdir(TestRoots.dataDirectoryOf(root), { recursive: true });
        await WholeFile.writeAsync(path.join(root, TestRoots.MARKER), run.id);
        holders.push(await startHolderAsync(folder, path.join(TestRoots.dataDirectoryOf(root), "holder")));
      }
      const [endedHolder, liveHolder, ownedHolder, otherHolder] = holders.map(t => t.pid);
      const killed = (t: number | undefined): unknown => expect.stringMatching(new RegExp(`^${String(t)}, found by its data directory: `));

      const stopped = await inTemporaryFolderAsync(folder, () => RunRecords.stopEndedRunsAsync([records]));
      const running = await ProcessListFixture.readRunningAsync(holders.map(t => t.pid ?? 0));

      expect(stopped).toEqual({ own: [killed(endedHolder), killed(ownedHolder)], others: [killed(otherHolder)], endedRunFolders: [] });
      expect(running).toEqual([liveHolder]);
      expect(existsSync(ended.root)).toBe(false);
      expect(existsSync(owned.root)).toBe(false);
      expect(existsSync(other.root)).toBe(false);
      expect(existsSync(live.root)).toBe(true);
      expect(await readdir(records.folder)).toEqual([live.run.id]);
    }
    finally {
      for (const holder of holders)
        holder.kill("SIGKILL");
      await ProcessListFixture.waitForExitAsync(holders.map(t => t.pid ?? 0), exitLimit);
      await rm(folder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

  test("the cleanup of ended runs removes a folder that a worker of an ended run began to create and marked, also in that run's temporary folder, which it then removes, "
    + "leaves a live run's alone, and the deletion of folders an earlier cleanup renamed is tried again", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "desktop-teardown-"));
    const started = (await ProcessStartTimes.readAsync([])).own;
    const endedRun = new UiRun(process.pid, started + 1000);
    const liveRun = new UiRun(process.pid, started);
    const endedFolder = path.join(folder, "ui-run-ended1");
    const liveFolder = path.join(folder, "ui-run-live01");
    const ended = path.join(folder, "desktop-ui-new-ended1");
    const endedInFolder = path.join(endedFolder, "desktop-ui-new-ended2");
    const live = path.join(folder, "desktop-ui-new-live01");
    const liveInFolder = path.join(liveFolder, "desktop-ui-new-live02");
    const removed = path.join(folder, "desktop-ui-w0-left01.removed");
    const removedInFolder = path.join(liveFolder, "desktop-ui-w0-left02.removed");
    try {
      for (const [root, run] of [[endedFolder, endedRun], [liveFolder, liveRun], [ended, endedRun], [endedInFolder, endedRun], [live, liveRun], [liveInFolder, liveRun]] as const) {
        await mkdir(root);
        await WholeFile.writeAsync(path.join(root, TestRoots.MARKER), run.id);
      }
      for (const leftover of [removed, removedInFolder])
        await mkdir(TestRoots.dataDirectoryOf(leftover), { recursive: true });

      const { stopped, undeleted } = await inTemporaryFolderAsync(folder, async () => ({ stopped: await RunRecords.stopEndedRunsAsync([]), undeleted: await TestRoots.deleteRemovedAsync() }));
      for (const runFolder of stopped.endedRunFolders)
        await TestRoots.removeRunFolderAsync(runFolder);

      expect(stopped).toEqual({ own: [], others: [], endedRunFolders: [endedFolder] });
      expect(undeleted).toEqual([]);
      expect([live, liveFolder, liveInFolder].filter(t => existsSync(t))).toEqual([live, liveFolder, liveInFolder]);
      expect([ended, `${ended}.removed`, endedFolder, removed, removedInFolder].filter(t => existsSync(t))).toEqual([]);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

  test("an ended run's temporary folder that still holds a test folder, or a folder a worker began to create, is kept, and one that is gone is no failure", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "desktop-teardown-"));
    const withRoot = path.join(folder, "ui-run-root01");
    const withStaging = path.join(folder, "ui-run-new001");
    const emptied = path.join(folder, "ui-run-empty1");
    try {
      await mkdir(path.join(withRoot, "desktop-ui-w0-held01"), { recursive: true });
      await mkdir(path.join(withStaging, "desktop-ui-new-held02"), { recursive: true });
      await mkdir(path.join(emptied, "desktop-ui-w0-gone01.removed"), { recursive: true });

      for (const runFolder of [withRoot, withStaging, emptied, path.join(folder, "ui-run-gone01")])
        await TestRoots.removeRunFolderAsync(runFolder);

      expect([withRoot, withStaging, emptied].filter(t => existsSync(t))).toEqual([withRoot, withStaging]);
      expect(await readdir(withRoot)).toEqual(["desktop-ui-w0-held01"]);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

  test("a process list without this process's row is refused, so a failed list never reads a live run as ended, and a run the list was not asked about is never read as ended", async () => {
    const own = (await ProcessStartTimes.readAsync([])).own;
    const startTimes = new ProcessStartTimes([process.pid], new Map([[process.pid, own]]));

    expect(() => new ProcessStartTimes([process.pid], new Map())).toThrow(`The process list gave no start time for this process, ${process.pid}, so the list failed`);
    expect(new UiRun(process.pid, own).hasEnded(startTimes)).toBe(false);
    expect(new UiRun(process.pid, own + 1).hasEnded(startTimes)).toBe(true);
    expect(new UiRun(process.pid + 1, own).hasEnded(startTimes)).toBe(false);
  });

  test("reads a Linux process's start time from field 22 of its status, counted after the name's last parenthesis, so a name with spaces and parentheses does not move it", () => {
    const fields = [...Array(50).keys()].map(t => String(t + 3));

    expect(ProcessListFixture.readStartTicks(`1234 (a) b (c) d) ${fields.join(" ")}\n`)).toBe(22);
    expect(() => ProcessListFixture.readStartTicks("1234 (a) b")).toThrow("The process status \"1234 (a) b\" has no start time in field 22.");
  });

  test("the process tree leaves out a process whose parent id names a process that started after it, as a reused id does on Windows, and fails on a process it has no row for", () => {
    const tree = new ProcessTree([
      { processId: 10, parentId: 1, created: 1000 },
      { processId: 11, parentId: 10, created: 1100 },
      { processId: 12, parentId: 11, created: 1200 },
      { processId: 20, parentId: 10, created: 900 },
      { processId: 21, parentId: 20, created: 950 },
      { processId: 30, parentId: 10, created: null }
    ]);

    expect(tree.listDescendants(10)).toEqual([11, 30, 12]);
    expect(() => tree.listDescendants(40)).toThrow("The process list has no row for process 40");
  });

  test("a process the app started is killed or reported only while its id still has the start time it had before the app closed, as a reused id does not", () => {
    const current = new ProcessStartTimes([process.pid, 10, 11, 12], new Map([[process.pid, 1], [10, 1000], [11, 2100]]));

    expect(MainProcessFixture.keepUnchanged([10, 11, 12, 13], new Map([[10, 1000], [11, 1100], [12, 1200]]), current)).toEqual([10, 13]);
  });

  test("a child run whose processes cannot be listed is still killed, its ended run's records are still cleaned up, and the failure names the list", async ({}, testInfo) => {
    test.skip(process.platform === "win32", "Windows lists the processes through PowerShell from its own folder, which it searches before PATH, so no fake can stand in for it.");
    test.setTimeout(childRunTestLimit);
    const run = await ChildRunFixture.startAsync(testInfo.outputPath("child-run"), "unlisted", "its worker hangs while Noldova Desktop Sample runs");
    const fakes = testInfo.outputPath("fake-tools");
    await mkdir(fakes, { recursive: true });
    const realList = spawnSync("sh", ["-c", "command -v ps"], { encoding: "utf8" }).stdout.trim();
    await WholeFile.writeAsync(path.join(fakes, "ps"), `#!/bin/sh\nif [ "$*" = "-A -o pid=,ppid=" ]; then exit 1; fi\nexec ${realList} "$@"\n`, 0o755);
    const searchPath = process.env["PATH"] ?? String.empty;
    try {
      await WaitFixture.untilAsync(() => run.output.includes(ChildRunFixture.HUNG) || run.hasEnded, "the unlisted run's worker to hang or the run to end", childRunLimit);
      expect(run.output).toContain(ChildRunFixture.HUNG);
      const hungRecord = JsonReader.parse(await readFile(path.join(run.folder, ChildRunFixture.HUNG_FILE), "utf8"));
      const hung = { worker: hungRecord.readInteger("worker"), processIds: readProcessIds(hungRecord), root: hungRecord.readString("root") };
      process.env["PATH"] = `${fakes}${path.delimiter}${searchPath}`;
      const failure = await run.endAsync(childRunLimit, () => run.output.includes(ChildRunFixture.HUNG)).then(() => null, (error: unknown) => error)
        .finally(() => {
          process.env["PATH"] = searchPath;
        });
      const running = await ProcessListFixture.waitForExitAsync([hung.worker, ...hung.processIds], exitLimit);

      expect(failure).toBeInstanceOf(AggregateError);
      expect(ErrorCodeFixture.messageOf(failure)).toContain("The child run unlisted was given up on, so it was killed with the 0 processes it had started: none.");
      expect(ErrorCodeFixture.messageOf(failure)).toContain(`The process list has no row for process ${run.processId}`);
      expect(ErrorCodeFixture.messageOf(failure)).toContain(ChildRunFixture.HUNG);
      expect(run.hasEnded).toBe(true);
      expect(running, `The worker was ${hung.worker}.`).toEqual([]);
      expect(existsSync(hung.root)).toBe(false);
      expect(await readdir(path.join(run.folder, "processes"))).toEqual([]);
    }
    finally {
      process.env["PATH"] = searchPath;
      if (!run.hasEnded)
        ProcessRecord.killIfRunning(run.processId);
    }
  });

  test("a run whose runner and worker were killed while its Noldova Desktop Sample ran is cleaned up by the next run's global setup, which fails naming what it killed", async ({}, testInfo) => {
    test.setTimeout(twoChildRunsTestLimit);
    const folder = testInfo.outputPath("child-run");
    const held = await ChildRunFixture.startAsync(folder, "held", "it holds Noldova Desktop Sample until its release");
    try {
      await WaitFixture.untilAsync(() => held.output.includes(ChildRunFixture.HELD) || held.hasEnded, "the held run to hold Noldova Desktop Sample or end", childRunLimit);
      expect(held.output).toContain(ChildRunFixture.HELD);
      const record = JsonReader.parse(await readFile(path.join(folder, ChildRunFixture.HELD_FILE), "utf8"));
      const ids = { worker: record.readInteger("worker"), main: record.readInteger("main"), runtime: record.readInteger("runtime"), root: record.readString("root") };
      ProcessRecord.killIfRunning(ids.worker);
      ProcessRecord.killIfRunning(held.processId);
      await WaitFixture.untilAsync(() => held.hasEnded, "the killed held run to end", exitLimit);
      const running = await ProcessListFixture.readRunningAsync([ids.main, ids.runtime]);
      const heldFolder = path.dirname(ids.root);
      const heldFolderWasLeft = existsSync(heldFolder);

      const next = await ChildRunFixture.startAsync(folder, "next", "it ends at once");
      const code = await next.endAsync(childRunLimit);
      const left = await ProcessListFixture.waitForExitAsync([ids.main, ids.runtime], exitLimit);

      expect(running).toEqual([ids.main, ids.runtime]);
      expect(code, next.output).toBe(1);
      expect(next.output).toContain("Processes that earlier UI runs started still ran after their runners had ended, so they were killed:\n");
      expect(next.output).toContain(`${ids.runtime}, by its recorded id: `);
      expect(left).toEqual([]);
      expect(existsSync(ids.root)).toBe(false);
      expect(path.basename(heldFolder)).toMatch(/^ui-run-[A-Za-z0-9]{6}$/);
      expect(heldFolderWasLeft).toBe(true);
      expect(existsSync(heldFolder)).toBe(false);
      expect(await readdir(path.join(folder, "processes"))).toEqual([]);
    }
    finally {
      await WholeFile.writeAsync(path.join(folder, ChildRunFixture.RELEASE_FILE), String.empty);
      if (!held.hasEnded)
        ProcessRecord.killIfRunning(held.processId);
    }
  });

  test("the cleanup of a run's records goes on past an entry it cannot clean up, then fails naming each failure and each process it killed, and keeps the records", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "desktop-teardown-"));
    const root = path.join(folder, "root");
    const dataDirectory = path.join(root, "data");
    await mkdir(dataDirectory, { recursive: true });
    const holder = await startHolderAsync(folder, path.join(dataDirectory, "holder"));
    try {
      const record = new ProcessRecord(path.join(folder, "processes", "run"));
      await record.createAsync();
      const unremovable = path.join(folder, "un\0removable");
      await record.appendAsync(0, { root: unremovable, dataDirectory: path.join(unremovable, "data"), processIds: [] });
      await record.appendAsync(0, { root, dataDirectory, processIds: [] });

      const failure = await record.stopLeftoversAsync().then(() => null, (error: unknown) => error);

      expect(failure).toBeInstanceOf(AggregateError);
      expect(failure instanceof AggregateError ? failure.errors.map(t => ErrorCodeFixture.of(t)) : []).toEqual(["ERR_INVALID_ARG_VALUE"]);
      expect(ErrorCodeFixture.messageOf(failure)).toContain(`1 of the 2 entries in ${record.folder} could not be cleaned up, so it is kept.`);
      expect(ErrorCodeFixture.messageOf(failure)).toContain(`These processes were killed:\n${holder.pid ?? 0}, found by its data directory: `);
      expect(await ProcessListFixture.readRunningAsync([holder.pid ?? 0])).toEqual([]);
      expect(existsSync(root)).toBe(false);
      expect(existsSync(record.folder)).toBe(true);
    }
    finally {
      holder.kill("SIGKILL");
      await ProcessListFixture.waitForExitAsync([holder.pid ?? 0], exitLimit);
      await rm(folder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

  test("a cleanup step that fails does not stop the later ones, so the runtime is still stopped and the folder removed, and the failure is reported", async ({ mainProcess }) => {
    const runtime = await mainProcess.readRuntimeProcessIdAsync();
    await mainProcess.application.evaluate(({ app }) => {
      app.getAppMetrics = () => {
        throw new Error("The test made listing the processes fail.");
      };
    });

    const failure = await mainProcess.disposeAsync(false).then(() => null, (error: unknown) => error);

    expect(runtime).toBeDefined();
    expect(failure).not.toBeInstanceOf(AggregateError);
    expect(String(failure)).toContain("The test made listing the processes fail.");
    await expect.poll(() => !Object.isUndefined(runtime) && MainProcessFixture.isAlive(runtime)).toBe(false);
    expect(existsSync(mainProcess.root)).toBe(false);
  });

  test("a main process that stops answering fails the call that waited on it, is reported with what it was asked, and is killed with every process it started", async ({ mainProcess }, testInfo) => {
    const main = await mainProcess.application.evaluate(() => process.pid);
    const outliving = await OutlivingProcess.startAsync(mainProcess, testInfo);
    const blocked = mainProcess.application.evaluate(() => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15_000);
    });
    blocked.catch(() => undefined);

    const failure = await mainProcess.isVisibleAsync().then(() => null, (error: unknown) => ErrorCodeFixture.messageOf(error));
    await mainProcess.disposeAsync(false);
    const report = testInfo.attachments.find(t => t.name === "main-process.txt")?.body?.toString() ?? String.empty;

    expect(failure).toMatch(/^The main process did not answer within 10 s when asked to say whether a window is visible\.\nThe last of the harness's own calls it answered was to .+, \d+ ms before this one was asked; the workflow's own calls are not counted\.\nThe main process log shows no main-process failure\.\nBefore the move, the cursor was at -?\d+,-?\d+, /);
    expect(mainProcess.acceptFailures(new RegExp(`^The main process ${main} did not answer for \\d+ s after it was asked to say whether a window is visible, so the test killed it\\.$`))).toHaveLength(1);
    expect(report).toMatch(new RegExp(`^The main process ${main} stopped answering when it was asked to say whether a window is visible, \\d+ s before this report\\.\\n`));
    expect(report).toMatch(/\nIts processor time was \d+ ms when it stopped answering and \d+ ms now\.\n/);
    expect(report).toMatch(/\nThe window's request to it, desktop\.readBuild\(\), was answered in \d+ ms\.\n/);
    expect(mainProcess.recordedProcessIds).toContain(outliving);
    expect(await ProcessListFixture.waitForSignalsAsync(mainProcess.recordedProcessIds, 0)).toEqual([]);
    expect(existsSync(mainProcess.root)).toBe(false);
  });

  test("a main process that fails and then stops answering fails the call that waited on it with the failure the main process log holds", async ({ mainProcess }) => {
    await mainProcess.application.evaluate(({ dialog }) => {
      dialog.showMessageBox = (): ReturnType<typeof dialog.showMessageBox> => new Promise(() => undefined);
      setImmediate(() => {
        throw new Error("A failure the test threw in the main process.");
      });
      setImmediate(() => {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15_000);
      });
    });
    await expect.poll(() => mainProcess.failures.some(t => t.includes("A failure the test threw in the main process."))).toBe(true);

    const failure = await mainProcess.isVisibleAsync().then(() => null, (error: unknown) => ErrorCodeFixture.messageOf(error));
    await mainProcess.disposeAsync(false);

    expect(failure).toMatch(/\nThe main process log shows this main-process failure:\n\S+ The main process's main process failed with an uncaught exception: Error: A failure the test threw in the main process\.\n {4}at [^\n]+\n(?: {4}[^\n]*\n)*Before the move, /);
    expect(mainProcess.acceptFailures(/^main: (?:\S+ The main process's main process failed|at )/).length).toBeGreaterThanOrEqual(2);
    expect(mainProcess.acceptFailures(/^The main process \d+ did not answer for \d+ s after it was asked to say whether a window is visible, so the test killed it\.$/)).toHaveLength(1);
    expect(mainProcess.failures).toEqual([]);
  });

  test("a main process that stays silent is still reported, with the window's unanswered request and its threads", async ({ mainProcess }, testInfo) => {
    test.setTimeout(150_000);
    const main = await mainProcess.application.evaluate(() => process.pid);
    const blocked = mainProcess.application.evaluate(() => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120_000);
    });
    blocked.catch(() => undefined);

    await mainProcess.isVisibleAsync().catch(() => undefined);
    await mainProcess.disposeAsync(false);
    const report = testInfo.attachments.find(t => t.name === "main-process.txt")?.body?.toString() ?? String.empty;
    const threads = testInfo.attachments.find(t => t.name === "main-process-threads.txt")?.body?.toString() ?? String.empty;

    expect(mainProcess.acceptFailures(new RegExp(`^The main process ${main} did not answer for \\d+ s after it was asked to say whether a window is visible, so the test killed it\\.$`))).toHaveLength(1);
    expect(report).toMatch(new RegExp(`^The main process ${main} stopped answering when it was asked to say whether a window is visible, \\d+ s before this report\\.\\n`));
    expect(report).toMatch(/\nThe window's request to it, desktop\.readBuild\(\), had no answer within 10 s\.\n/);
    expect(threads).toMatch(process.platform === "darwin"
      ? new RegExp(`^Analysis of sampling .* \\(pid ${main}\\)[\\s\\S]*Call graph:`)
      : process.platform === "win32" ? /^\d+ Wait \w+ \d+ ms\r?$/m : /^\s*\d+ \S+ .*\d+:\d+(?:\.\d+)? \S/m);
    expect(testInfo.attachments.map(t => t.name)).toEqual(expect.arrayContaining(["page-0.png.unavailable.txt", "page-0.html.unavailable.txt"]));
    expect(await ProcessListFixture.waitForSignalsAsync(mainProcess.recordedProcessIds, 0)).toEqual([]);
  });

  test("a quit that stops at the question about running work is reported with the question, not as a silent main process", async ({ mainProcess }) => {
    test.setTimeout(120_000);
    await ClockWorkFixture.beginAsync(mainProcess);

    await mainProcess.disposeAsync(false);
    const reported = mainProcess.acceptFailures(/^Noldova Desktop Sample did not quit/);

    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatch(/^Noldova Desktop Sample did not quit within 30 s because window 0 asked the question below, so the test killed it\.\nThe test left work running: finish or stop it before the test ends\.\n- dialog "Work is still running":\n/);
    expect(reported[0]).toContain(`- listitem: ${ClockWorkFixture.WORK}`);
    expect(mainProcess.failures).toEqual([]);
    expect(await ProcessListFixture.waitForSignalsAsync(mainProcess.recordedProcessIds, 0)).toEqual([]);
  });
});

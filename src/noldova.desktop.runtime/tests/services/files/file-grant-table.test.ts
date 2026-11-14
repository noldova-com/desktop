/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import type { RmOptions } from "node:fs";
import { access, appendFile, lstat, mkdir, rename, rm, utimes, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { devNull } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FailureCode, FileGrant } from "@noldova/desktop.protocol";
import { ClientClosure, ClientClosures, FileGrantTable, FileIdentity, MethodFailureException, RequestContext } from "@noldova/desktop.runtime";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { SocketFolderFixture } from "../../fixtures/socket-folder.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class FileGrantTableTests {
  private static readonly GRANT: string = "8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21";
  private static readonly OTHER: string = "0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f54";

  @TestMethod
  public redeemsAGrantOnceForItsModuleWindowAndPageAndReadsTheFile(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, folder) => {
      const file = await FileGrantTableTests.writeAsync(folder, "notes.txt", "kept notes");
      table.issue(1, await FileGrantTableTests.grantAsync(file));

      const granted = await table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request());
      const text = await granted.handle.readFile("utf8");
      await granted.closeAsync();
      const again = await FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request()));

      Assert.areEqual("notes.txt|text/plain|10|kept notes", `${granted.name}|${granted.mediaType}|${granted.size}|${text}`);
      Assert.areEqual(`${FailureCode.NotFound}: The file grant is unknown or has ended, or it was given to another module or page.`, again);
      Assert.areEqual(0, table.count);
    });
  }

  @TestMethod
  public refusesAnotherModuleConnectionWindowOrPageAndAMadeUpGrantAndKeepsTheGrant(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, folder) => {
      table.issue(1, await FileGrantTableTests.grantAsync(await FileGrantTableTests.writeAsync(folder, "notes.txt", "kept")));

      const refusals = await Promise.all([
        FileGrantTableTests.refusalAsync(table.redeemAsync("terminal", FileGrantTableTests.GRANT, FileGrantTableTests.request())),
        FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request(2))),
        FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request(1, 4))),
        FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request(1, 3, 3))),
        FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request(1, null, null))),
        FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.OTHER, FileGrantTableTests.request()))
      ]);
      const kept = table.count;
      await (await table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request())).closeAsync();

      Assert.areEqual(6, refusals.filter(t => t.startsWith(`${FailureCode.NotFound}:`)).length);
      Assert.areEqual(1, kept);
    });
  }

  @TestMethod
  public refusesAGrantAlreadyHeldAndMoreThan256LiveGrantsForAWindow(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, folder) => {
      const file = await FileGrantTableTests.writeAsync(folder, "notes.txt", "kept");
      const grants = Array.from({ length: 256 }, (_, t) => t.toString(16).padStart(32, "0"));
      for (const grant of grants)
        table.issue(1, await FileGrantTableTests.grantAsync(file, { grant }));

      const taken = Assert.throws(() => table.issue(1, new FileGrant("0".repeat(32), file, "notes.txt", "text/plain", 4, "1:1:4:1", "notes", 3, 2, 600_000, false)),
        MethodFailureException);
      const full = Assert.throws(() => table.issue(1, new FileGrant("f".repeat(32), file, "notes.txt", "text/plain", 4, "1:1:4:1", "notes", 3, 2, 600_000, false)),
        MethodFailureException);
      table.issue(1, new FileGrant("e".repeat(32), file, "notes.txt", "text/plain", 4, "1:1:4:1", "notes", 4, 1, 600_000, false));
      table.issue(2, new FileGrant("d".repeat(32), file, "notes.txt", "text/plain", 4, "1:1:4:1", "notes", 3, 2, 600_000, false));

      Assert.areEqual(`${FailureCode.Conflict}: The file grant is already given.`, `${taken.failure.code}: ${taken.message}`);
      Assert.areEqual(
        `${FailureCode.Conflict}: Window 3 holds 256 live file grants, the most it may, so no other file is granted until a part redeems or discards one.`,
        `${full.failure.code}: ${full.message}`);
      Assert.areEqual(258, table.count);
    });
  }

  @TestMethod
  public refusesAFolderAndKeepsAStagedFolderItCannotDelete(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, _folder, staged) => {
      const copy = path.join(staged, FileGrantTableTests.GRANT);
      await mkdir(copy);
      table.issue(1, new FileGrant(FileGrantTableTests.GRANT, copy, "pasted", "text/plain", 0, FileIdentity.of(await lstat(copy, { bigint: true })), "notes", 3, 2, 600_000, true));

      const refusal = await FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request()));

      Assert.areEqual(`${FailureCode.InvalidParams}: The granted file is no longer a regular file, so it is not read.`, refusal);
      Assert.areEqual("0|true", `${table.count}|${await FileGrantTableTests.existsAsync(copy)}`);
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public refusesAFifoASocketAndADeviceAndEndsTheGrant(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, folder) => {
      const fifo = path.join(folder, "pipe");
      execFileSync("mkfifo", [fifo]);
      await using socketFolder = await SocketFolderFixture.createAsync("nol-grant-");
      const socket = path.join(socketFolder.path, "socket");
      const server = createServer();
      await new Promise<void>((resolve, reject) => server.once("error", reject).listen(socket, resolve));
      try {
        const targets = [fifo, socket, devNull];
        const grants = targets.map((_, t) => t.toString(16).padStart(32, "0"));
        for (const [index, target] of targets.entries())
          table.issue(1, new FileGrant(index.toString(16).padStart(32, "0"), target, "notes.txt", "text/plain", 0, FileIdentity.of(await lstat(target, { bigint: true })), "notes", 3, 2,
            600_000, false));

        const refusals = await Promise.all(grants.map(t => FileGrantTableTests.refusalAsync(table.redeemAsync("notes", t, FileGrantTableTests.request()))));

        Assert.areEqual(3, refusals.filter(t => t === `${FailureCode.InvalidParams}: The granted file is no longer a regular file, so it is not read.`).length);
        Assert.areEqual(0, table.count);
      }
      finally {
        await new Promise(resolve => server.close(resolve));
      }
    });
  }

  @TestMethod
  public refusesAFileThatChangedOrWentSinceItWasGranted(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, folder) => {
      const changed = await FileGrantTableTests.writeAsync(folder, "changed.txt", "kept");
      table.issue(1, await FileGrantTableTests.grantAsync(changed));
      await appendFile(changed, " and more");
      const gone = path.join(folder, "gone.txt");
      table.issue(1, new FileGrant(FileGrantTableTests.OTHER, gone, "gone.txt", "text/plain", 4, "1:1:4:1", "notes", 3, 2, 600_000, false));

      const refusals = [
        await FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request())),
        await FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.OTHER, FileGrantTableTests.request()))
      ];

      Assert.areEqual(
        `${FailureCode.Conflict}: The granted file changed or was replaced since it was granted, so it is not read.|${FailureCode.Conflict}: The granted file can't be read (ENOENT), so it is not read.`,
        refusals.join("|"));
      Assert.areEqual(0, table.count);
    });
  }

  @TestMethod
  public refusesAFileSwappedForOneOfTheSameSizeAndTimeOnItsFileIndexAlone(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, folder) => {
      const granted = await FileGrantTableTests.writeAsync(folder, "notes.txt", "kept");
      const swapped = await FileGrantTableTests.writeAsync(folder, "other.txt", "lost");
      await Promise.all([granted, swapped].map(t => utimes(t, 1_700_000_000, 1_700_000_000)));
      const grant = await FileGrantTableTests.grantAsync(granted);
      table.issue(1, grant);
      await rename(swapped, granted);
      const [device, index, size, time] = FileIdentity.of(await lstat(granted, { bigint: true })).split(":");
      const [grantDevice, grantIndex, grantSize, grantTime] = grant.identity.split(":");

      const refusal = await FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request()));

      Assert.areEqual(`${grantDevice}:${grantSize}:${grantTime}|true`, `${device}:${size}:${time}|${index !== grantIndex}`);
      Assert.areEqual(`${FailureCode.Conflict}: The granted file changed or was replaced since it was granted, so it is not read.`, refusal);
    });
  }

  @TestMethod
  public endsAGrantWhenItsLifetimeRunsOutAndDeletesItsStagedCopy(): Promise<void> {
    let now = 1_000;
    return FileGrantTableTests.runAsync(async (table, folder, staged) => {
      const copy = await FileGrantTableTests.writeAsync(staged, FileGrantTableTests.GRANT, "pasted");
      table.issue(1, await FileGrantTableTests.grantAsync(copy, { lifetime: 60_000, staged: true }));
      table.issue(1, await FileGrantTableTests.grantAsync(await FileGrantTableTests.writeAsync(folder, "notes.txt", "kept"), { grant: FileGrantTableTests.OTHER, lifetime: 60_001 }));

      now += 60_000;
      const refusal = await FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request()));

      Assert.areEqual(`${FailureCode.NotFound}:`, refusal.slice(0, refusal.indexOf(":") + 1));
      Assert.isTrue(await WaitFixture.untilAsync(async () => !(await FileGrantTableTests.existsAsync(copy)), 9_000), "The staged copy stayed.");
      Assert.areEqual(1, table.count);
    }, () => now);
  }

  @TestMethod
  public endsAnExpiredGrantByItsTimerWithoutAnyCall(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, folder) => {
      table.issue(1, await FileGrantTableTests.grantAsync(await FileGrantTableTests.writeAsync(folder, "notes.txt", "kept"), { lifetime: 1 }));

      Assert.isTrue(await WaitFixture.untilAsync(() => table.count === 0, 9_000), "The grant outlived its lifetime.");
    });
  }

  @TestMethod
  public endsAGrantWhoseTimerFiresBeforeTheClockReachesItsExpiry(): Promise<void> {
    let now = 1_000;
    let reads = 0;
    return FileGrantTableTests.runAsync(async (table, folder) => {
      table.issue(1, await FileGrantTableTests.grantAsync(await FileGrantTableTests.writeAsync(folder, "notes.txt", "kept"), { lifetime: 1 }));
      const issued = reads;

      const isEarly = await WaitFixture.untilAsync(() => reads > issued, 9_000);
      const afterEarly = table.count;
      now += 1;

      Assert.areEqual("true|1", `${isEarly}|${afterEarly}`);
      Assert.isTrue(await WaitFixture.untilAsync(() => table.count === 0, 9_000), "The grant outlived its lifetime once its timer fired early.");
    }, () => {
      reads++;
      return now;
    });
  }

  @TestMethod
  public resolvesAShareAsOftenAsAskedOnlyOnItsConnectionAndNeverRedeemsIt(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, folder) => {
      const file = await FileGrantTableTests.writeAsync(folder, "photo.png", "png");
      const share = await FileGrantTableTests.grantAsync(file);
      table.share(1, share);
      table.issue(1, await FileGrantTableTests.grantAsync(file, { grant: FileGrantTableTests.OTHER }));

      const resolved = [table.resolve(1, FileGrantTableTests.GRANT), table.resolve(1, FileGrantTableTests.GRANT)];
      const refusals = [
        Assert.throws(() => table.resolve(2, FileGrantTableTests.GRANT), MethodFailureException),
        Assert.throws(() => table.resolve(1, FileGrantTableTests.OTHER), MethodFailureException),
        Assert.throws(() => table.resolve(1, "f".repeat(32)), MethodFailureException)
      ].map(t => `${t.failure.code}: ${t.message}`);
      const redeemed = await FileGrantTableTests.refusalAsync(table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request()));

      Assert.isTrue(resolved.every(t => t === share));
      Assert.areEqual(Array<string>(3).fill(`${FailureCode.NotFound}: The shared file is unknown or has ended.`).join("|"), refusals.join("|"));
      Assert.areEqual(`${FailureCode.NotFound}: The file grant is unknown or has ended, or it was given to another module or page.`, redeemed);
      Assert.areEqual(2, table.count);
    });
  }

  @TestMethod
  public countsAWindowsSharesWithItsGrantsAgainstItsLimitAndEndsSharesAsItEndsGrants(): Promise<void> {
    let now = 0;
    const closures = new ClientClosures(new Writable({ write: (_chunk, _encoding, done) => done() }));
    return FileGrantTableTests.runAsync(async (table, folder) => {
      const file = await FileGrantTableTests.writeAsync(folder, "photo.png", "png");
      const share = async (index: number, fields: { readonly window?: number; readonly page?: number; readonly lifetime?: number } = {}): Promise<void> =>
        table.share(1, await FileGrantTableTests.grantAsync(file, { grant: index.toString(16).padStart(32, "0"), ...fields }));
      for (let index = 1; index < 256; index++)
        table.issue(1, await FileGrantTableTests.grantAsync(file, { grant: index.toString(16).padStart(32, "0"), window: 6 }));
      await share(256, { window: 6 });
      const full = await Assert.throwsAsync(() => share(257, { window: 6 }), MethodFailureException);
      await share(258);
      await share(259, { page: 1 });
      await share(260, { window: 4 });
      await share(261, { window: 5, lifetime: 1_000 });

      table.discard(FileGrantTableTests.request(), [(258).toString(16).padStart(32, "0")]);
      table.endPage(1, 3, 1);
      closures.report(new ClientClosure(1, 4));
      now = 1_000;
      const resolved = [258, 259, 260, 261].map(t => Assert.throws(() => table.resolve(1, t.toString(16).padStart(32, "0")), MethodFailureException).failure.code);

      Assert.areEqual(`${FailureCode.Conflict}: Window 6 holds 256 live file grants, the most it may, so no other file is granted until a part redeems or discards one.`,
        `${full.failure.code}: ${full.message}`);
      Assert.areEqual(Array<string>(4).fill(FailureCode.NotFound).join(","), resolved.join(","));
      Assert.areEqual(256, table.count);
    }, () => now, closures);
  }

  @TestMethod
  public discardsOnlyTheRequestPagesGrantsAndEndsAPagesAWindowsAndAConnectionsGrants(): Promise<void> {
    const closures = new ClientClosures(new Writable({ write: (_chunk, _encoding, done) => done() }));
    return FileGrantTableTests.runAsync(async (table, folder) => {
      const file = await FileGrantTableTests.writeAsync(folder, "notes.txt", "kept");
      const issue = async (index: number, connection: number, window: number, page: number): Promise<void> =>
        table.issue(connection, await FileGrantTableTests.grantAsync(file, { grant: index.toString(16).padStart(32, "0"), window, page }));
      await issue(1, 1, 3, 2);
      await issue(2, 1, 3, 2);
      await issue(3, 1, 3, 1);
      await issue(4, 1, 4, 1);
      await issue(5, 2, 4, 1);
      await issue(6, 2, 5, 1);

      table.discard(FileGrantTableTests.request(), [1, 3, 4, 5].map(t => t.toString(16).padStart(32, "0")));
      const afterDiscard = table.count;
      table.endPage(1, 3, 2);
      const afterPage = table.count;
      closures.report(new ClientClosure(1, 4));
      const afterWindow = table.count;
      closures.report(new ClientClosure(2, null));

      Assert.areEqual("5,4,3,1", [afterDiscard, afterPage, afterWindow, table.count].join(","));
    }, Date.now, closures);
  }

  @TestMethod
  public deletesAStagedCopyOnceRedeemedAndClosedOrRefusedButNeverAFileOutsideTheStagedFolder(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, folder, staged) => {
      const copy = await FileGrantTableTests.writeAsync(staged, FileGrantTableTests.GRANT, "pasted");
      const outside = await FileGrantTableTests.writeAsync(folder, FileGrantTableTests.OTHER, "the person's");
      const changed = await FileGrantTableTests.writeAsync(staged, "c".repeat(32), "pasted");
      table.issue(1, await FileGrantTableTests.grantAsync(copy, { staged: true }));
      table.issue(1, await FileGrantTableTests.grantAsync(outside, { grant: FileGrantTableTests.OTHER, staged: true }));
      table.issue(1, await FileGrantTableTests.grantAsync(changed, { grant: "c".repeat(32), staged: true }));
      await appendFile(changed, " again");

      await using granted = await table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request());
      const whileOpen = await FileGrantTableTests.existsAsync(copy);
      await granted.closeAsync();
      await granted.closeAsync();
      await (await table.redeemAsync("notes", FileGrantTableTests.OTHER, FileGrantTableTests.request())).closeAsync();
      await FileGrantTableTests.refusalAsync(table.redeemAsync("notes", "c".repeat(32), FileGrantTableTests.request()));

      Assert.areEqual("true,false,true,false", [whileOpen, ...await Promise.all([copy, outside, changed].map(t => FileGrantTableTests.existsAsync(t)))].join(","));
    });
  }

  @TestMethod
  public clearsTheStagedFolderAndEndsEveryGrantWhenDisposed(): Promise<void> {
    return FileGrantTableTests.runAsync(async (table, _folder, staged) => {
      const copy = await FileGrantTableTests.writeAsync(staged, FileGrantTableTests.GRANT, "pasted");
      table.issue(1, await FileGrantTableTests.grantAsync(copy, { staged: true }));

      table.dispose();
      table.dispose();
      const afterDispose = table.count;
      await FileGrantTableTests.writeAsync(staged, FileGrantTableTests.OTHER, "left from before");
      await table.clearStagedAsync();
      await table.clearStagedAsync();

      Assert.areEqual(0, afterDispose);
      Assert.isFalse(await FileGrantTableTests.existsAsync(staged));
    });
  }

  @TestMethod
  public clearsTheStagedFolderOnlyOnceTheCopiesEndedGrantsAreDeletingAreGone(): Promise<void> {
    const calls: string[] = [];
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => release = resolve);
    const removeAsync = async (target: string, options: RmOptions): Promise<void> => {
      calls.push(`start ${path.basename(target)}`);
      if (path.basename(target) === FileGrantTableTests.GRANT)
        await held;
      await rm(target, options);
      calls.push(`end ${path.basename(target)}`);
    };
    return FileGrantTableTests.runAsync(async (table, _folder, staged) => {
      const copy = await FileGrantTableTests.writeAsync(staged, FileGrantTableTests.GRANT, "pasted");
      table.issue(1, await FileGrantTableTests.grantAsync(copy, { staged: true }));

      table.dispose();
      const clearing = table.clearStagedAsync();
      const startedBeforeRelease = [...calls];
      release();
      await clearing;

      Assert.areEqual([`start ${FileGrantTableTests.GRANT}`].join("|"), startedBeforeRelease.join("|"));
      Assert.areEqual([`start ${FileGrantTableTests.GRANT}`, `end ${FileGrantTableTests.GRANT}`, "start staged", "end staged"].join("|"), calls.join("|"));
      Assert.isFalse(await FileGrantTableTests.existsAsync(staged));
    }, Date.now, undefined, removeAsync);
  }

  @TestMethod
  public waitsAlsoForACopyAGrantEndedWhileItWaitedStartsDeletingAndForARedeemThatFailsMeanwhile(): Promise<void> {
    const calls: string[] = [];
    const releases = new Map<string, () => void>();
    const endings = new Map<string, () => void>();
    const names = [FileGrantTableTests.GRANT, FileGrantTableTests.OTHER, "failed"];
    const holds = new Map(names.map(t => [t, new Promise<void>(resolve => releases.set(t, resolve))]));
    const ended = new Map(names.map(t => [t, new Promise<void>(resolve => endings.set(t, resolve))]));
    const removeAsync = async (target: string, options: RmOptions): Promise<void> => {
      calls.push(`start ${path.basename(target)}`);
      await holds.get(path.basename(target));
      await rm(target, options);
      calls.push(`end ${path.basename(target)}`);
      endings.get(path.basename(target))?.();
    };
    return FileGrantTableTests.runAsync(async (table, _folder, staged) => {
      const first = await FileGrantTableTests.writeAsync(staged, FileGrantTableTests.GRANT, "first");
      const second = await FileGrantTableTests.writeAsync(staged, FileGrantTableTests.OTHER, "second");
      const failed = await FileGrantTableTests.writeAsync(staged, "failed", "gone before its redeem");
      table.issue(1, await FileGrantTableTests.grantAsync(first, { staged: true, window: 3 }));
      table.issue(1, await FileGrantTableTests.grantAsync(second, { grant: FileGrantTableTests.OTHER, staged: true, window: 4 }));
      table.issue(1, await FileGrantTableTests.grantAsync(failed, { grant: "f".repeat(32), staged: true, window: 5 }));
      await rm(failed);

      const redeem = FileGrantTableTests.refusalAsync(table.redeemAsync("notes", "f".repeat(32), FileGrantTableTests.request(1, 5)));
      table.endPage(1, 3, 2);
      const clearing = table.clearStagedAsync();
      table.endPage(1, 4, 2);
      releases.get(FileGrantTableTests.GRANT)!();
      await ended.get(FileGrantTableTests.GRANT);
      releases.get("failed")!();
      await ended.get("failed");
      const beforeLast = [...calls];
      releases.get(FileGrantTableTests.OTHER)!();
      await clearing;

      Assert.areEqual(`${FailureCode.Conflict}: The granted file can't be read (ENOENT), so it is not read.`, await redeem);
      Assert.isFalse(beforeLast.includes("start staged"), beforeLast.join("|"));
      Assert.areEqual(["start staged", "end staged"].join("|"), calls.slice(-2).join("|"));
      Assert.isFalse(await FileGrantTableTests.existsAsync(staged));
    }, Date.now, undefined, removeAsync);
  }

  @TestMethod
  public async leavesAStagedCopyThatIsBusyAndPassesOnAnyOtherFailureToRemoveIt(): Promise<void> {
    const failures = new Map([["EBUSY", `${FailureCode.Conflict}: The granted file can't be read (ENOENT), so it is not read.`], ["EIO", "EIO: i/o error, rm"]]);
    const outcomes: string[] = [];
    for (const code of failures.keys()) {
      const removeAsync = (): Promise<void> => Promise.reject(Object.assign(new Error(`${code}: ${code === "EIO" ? "i/o error" : "resource busy or locked"}, rm`), { code }));
      await FileGrantTableTests.runAsync(async (table, _folder, staged) => {
        const copy = await FileGrantTableTests.writeAsync(staged, FileGrantTableTests.GRANT, "pasted");
        table.issue(1, await FileGrantTableTests.grantAsync(copy, { staged: true }));
        await rm(copy);

        const error = await Assert.throwsAsync(() => table.redeemAsync("notes", FileGrantTableTests.GRANT, FileGrantTableTests.request()), Error);

        outcomes.push(error instanceof MethodFailureException ? `${error.failure.code}: ${error.message}` : error.message);
      }, Date.now, undefined, removeAsync);
    }

    Assert.areEqual([...failures.values()].join("|"), outcomes.join("|"));
  }

  private static async runAsync(test: (table: FileGrantTable, folder: string, staged: string) => Promise<void>, now: () => number = Date.now,
    closures: ClientClosures = new ClientClosures(new Writable({ write: (_chunk, _encoding, done) => done() })),
    removeAsync: (target: string, options: RmOptions) => Promise<void> = rm): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const staged = path.join(folder.path, "staged");
    await mkdir(staged);
    const table = new FileGrantTable(staged, closures, now, removeAsync);
    try {
      await test(table, folder.path, staged);
    }
    finally {
      table.dispose();
    }
  }

  private static async writeAsync(folder: string, name: string, text: string): Promise<string> {
    const file = path.join(folder, name);
    await writeFile(file, text);
    return file;
  }

  private static async grantAsync(file: string, fields: { readonly grant?: string; readonly window?: number; readonly page?: number; readonly lifetime?: number; readonly staged?: boolean } = {}):
    Promise<FileGrant> {
    const stats = await lstat(file, { bigint: true });
    return new FileGrant(fields.grant ?? FileGrantTableTests.GRANT, file, path.basename(file), "text/plain", Number(stats.size),
      FileIdentity.of(stats), "notes", fields.window ?? 3, fields.page ?? 2, fields.lifetime ?? 600_000, fields.staged ?? false);
  }

  private static request(connection: number = 1, window: number | null = 3, page: number | null = 2): RequestContext {
    return new RequestContext("main", null, new AbortController().signal, connection, window, page);
  }

  private static async refusalAsync(redeem: Promise<unknown>): Promise<string> {
    const failure = await Assert.throwsAsync(() => redeem, MethodFailureException);
    return `${failure.failure.code}: ${failure.message}`;
  }

  private static async existsAsync(file: string): Promise<boolean> {
    return access(file).then(() => true, () => false);
  }
}

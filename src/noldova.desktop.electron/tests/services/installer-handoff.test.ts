/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  InstallerHandoff, InstallerNotCopiedException, InstallerNotHeldException, InstallerUnsignedException, StaleUpdateException, UpdateChangedBeforeHandoffException,
  UpdateReadyRecord
} from "@noldova/desktop.electron";

import { ErrorCode } from "../../src/models/error-code.js";
import { FailingFileCallFixture } from "../fixtures/failing-file-call.fixture.js";

class InstallerHandoffFixture {
  public static readonly CONTENT: string = "Noldova Desktop Sample 1.3.0 installer";

  public readonly folder: string;
  public readonly protectedFolders: string[] = [];
  public readonly opened: string[] = [];
  public readonly closed: bigint[] = [];
  public readonly started: string[] = [];
  public readonly lines: string[] = [];
  public hold: bigint | number = 7n;
  public onOpen: (installer: string) => void = () => undefined;
  public protect: () => Promise<void> = () => Promise.resolve();
  public start: (installer: string) => Promise<number> = () => Promise.resolve(4120);
  public readonly handoff: InstallerHandoff;

  private constructor(folder: string) {
    this.folder = folder;
    this.handoff = new InstallerHandoff(join(folder, "installation"), t => {
      this.protectedFolders.push(t);
      return this.protect();
    }, {
      openFileForReading: t => {
        this.opened.push(t);
        this.onOpen(t);
        return this.hold;
      },
      closeHandle: t => {
        this.closed.push(t);
      }
    }, t => {
      this.started.push(t);
      return this.start(t);
    }, t => this.lines.push(t));
  }

  public get handoffFolder(): string {
    return join(this.folder, "installation", "handoff");
  }

  public get download(): string {
    return join(this.folder, "cache", "pending", "Noldova Desktop Sample-windows-x64.exe");
  }

  public static async runAsync(run: (fixture: InstallerHandoffFixture) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-installer-handoff-"));
    try {
      const fixture = new InstallerHandoffFixture(folder);
      await mkdir(dirname(fixture.download), { recursive: true });
      await writeFile(fixture.download, InstallerHandoffFixture.CONTENT);
      await run(fixture);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  public record(sha512: string = createHash("sha512").update(InstallerHandoffFixture.CONTENT).digest("base64")): UpdateReadyRecord {
    return new UpdateReadyRecord("1.3.0", this.download, sha512, true);
  }
}

@TestClass
export class InstallerHandoffTests {
  @TestMethod
  public startsAHeldCheckedCopyInAFolderOfItsOwnAndKeepsHoldingItOnceStarted(): Promise<void> {
    return InstallerHandoffFixture.runAsync(async fixture => {
      const processId = await fixture.handoff.handOffAsync(fixture.record());
      const copy = String(fixture.started[0]);

      Assert.areEqual(4120, processId);
      Assert.isNull(fixture.handoff.refusal);
      Assert.areEqual(join(fixture.folder, "installation", "handoff"), dirname(dirname(copy)));
      Assert.areEqual("Noldova Desktop Sample-windows-x64.exe", copy.slice(dirname(copy).length + 1));
      Assert.areEqual(InstallerHandoffFixture.CONTENT, await readFile(copy, "utf8"));
      Assert.areEqual(JSON.stringify([dirname(copy)]), JSON.stringify(fixture.protectedFolders));
      Assert.areEqual(JSON.stringify([copy]), JSON.stringify(fixture.opened));
      Assert.areEqual(0, fixture.closed.length);
      Assert.isTrue(existsSync(fixture.download));
    });
  }

  @TestMethod
  public refusesACopyItCannotHoldWithoutStartingIt(): Promise<void> {
    return InstallerHandoffFixture.runAsync(async fixture => {
      fixture.hold = 32;

      const failure = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), InstallerNotHeldException);

      Assert.areEqual("The update's installer couldn't be held unchanged for its start (Windows error 32).", failure.message);
      Assert.areEqual(0, fixture.started.length);
      Assert.areEqual(0, fixture.closed.length);
      Assert.areEqual(0, (await readdir(fixture.handoffFolder)).length);
    });
  }

  @TestMethod
  public letsGoOfAndRemovesACopyThatChangedOrThatTheStartRefuses(): Promise<void> {
    return InstallerHandoffFixture.runAsync(async fixture => {
      const changed = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record("b3RoZXI=")), UpdateChangedBeforeHandoffException);
      const startsBefore = fixture.started.length;
      const refusal = new InstallerUnsignedException("setup.exe", "the signature is not trusted");
      fixture.start = () => Promise.reject(refusal);
      const refused = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), InstallerUnsignedException);

      Assert.areEqual("The downloaded update has changed since it was checked, so it wasn't installed.", changed.message);
      Assert.isInstanceOf(changed, StaleUpdateException);
      Assert.areEqual(0, startsBefore);
      Assert.areEqual(refusal, refused);
      Assert.areEqual(JSON.stringify(["7", "7"]), JSON.stringify(fixture.closed.map(String)));
      Assert.areEqual(0, (await readdir(fixture.handoffFolder)).length);
      Assert.areEqual(0, fixture.lines.length);
    });
  }

  @TestMethod
  public explainsACopyItCannotMakeOrReadAndRemovesWhatItLeft(): Promise<void> {
    return InstallerHandoffFixture.runAsync(async fixture => {
      const denied = new Error("EACCES: permission denied");
      fixture.protect = () => Promise.reject(denied);
      const unprotected = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), InstallerNotCopiedException);
      fixture.protect = () => Promise.resolve();
      fixture.onOpen = t => rmSync(t);
      const unread = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), InstallerNotCopiedException);
      fixture.onOpen = () => undefined;
      await rm(fixture.download);
      const uncopied = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), InstallerNotCopiedException);

      Assert.areEqual(JSON.stringify(Array(3).fill("Noldova Desktop Sample couldn't make a protected copy of the update's installer.")), JSON.stringify([unprotected, unread, uncopied].map(t => t.message)));
      Assert.areEqual(denied, unprotected.cause);
      Assert.areEqual("ENOENT", ErrorCode.of(unread.cause));
      Assert.areEqual("ENOENT", ErrorCode.of(uncopied.cause));
      Assert.areEqual(1, fixture.opened.length);
      Assert.areEqual(JSON.stringify(["7"]), JSON.stringify(fixture.closed.map(String)));
      Assert.areEqual(0, fixture.started.length);
      Assert.areEqual(0, (await readdir(fixture.handoffFolder)).length);
    });
  }

  @TestMethod
  public logsACopyItCannotRemove(): Promise<void> {
    return InstallerHandoffFixture.runAsync(async fixture => {
      const removals: FailingFileCallFixture[] = [];
      fixture.hold = 5;
      fixture.onOpen = t => removals.push(new FailingFileCallFixture("rm", dirname(t), "EBUSY"));

      try {
        await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), InstallerNotHeldException);
      }
      finally {
        for (const removal of removals.toReversed())
          removal[Symbol.dispose]();
      }

      Assert.areEqual(1, fixture.lines.length);
      Assert.isTrue(fixture.lines[0]?.startsWith("The copy of an update's installer could not be removed, so it is removed at the next start: Error: EBUSY") === true, fixture.lines[0]);
      Assert.areEqual(1, (await readdir(fixture.handoffFolder)).length);
    });
  }

  @TestMethod
  public removesTheCopiesEarlierHandoffsLeftAndLogsOnesItCannotRemove(): Promise<void> {
    return InstallerHandoffFixture.runAsync(async fixture => {
      const handoff = fixture.handoffFolder;
      await mkdir(join(handoff, "0123"), { recursive: true });
      await writeFile(join(handoff, "0123", "Noldova Desktop Sample-windows-x64.exe"), InstallerHandoffFixture.CONTENT);

      {
        using _rm = new FailingFileCallFixture("rm", handoff, "EBUSY");
        await fixture.handoff.clearAsync();
      }
      const isKept = existsSync(handoff);
      await fixture.handoff.clearAsync();
      await fixture.handoff.clearAsync();

      Assert.isTrue(isKept);
      Assert.isFalse(existsSync(handoff));
      Assert.areEqual(1, fixture.lines.length);
      Assert.isTrue(fixture.lines[0]?.startsWith("The copy of an update's installer could not be removed, so it is removed at the next start: Error: EBUSY") === true, fixture.lines[0]);
    });
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WindowStateNotConnectedException } from "@noldova/desktop.electron";

import { LocalWindowStateStore } from "../../src/services/local-window-state-store.js";
import { MirroredWindowStateStore } from "../../src/services/mirrored-window-state-store.js";
import { FakeDeviceFileStore } from "../fixtures/fake-device-file-store.fixture.js";

@TestClass
export class MirroredWindowStateStoreTests {
  private static readonly STATE: JsonObject = { x: 300, y: 150, width: 900, height: 600, maximized: false };
  private static readonly PRIMARY: JsonObject = { x: 200, y: 100, width: 1000, height: 700, maximized: true };

  @TestMethod
  public async readsThePrimaryKeepsItOnTheMirrorAndWritesBoth(): Promise<void> {
    const primary = new FakeDeviceFileStore();
    const mirror = new FakeDeviceFileStore();
    primary.kept = MirroredWindowStateStoreTests.PRIMARY;
    mirror.kept = MirroredWindowStateStoreTests.STATE;
    const store = new MirroredWindowStateStore(primary, new LocalWindowStateStore(mirror, () => undefined));

    const read = await store.readAsync();
    await store.writeAsync(MirroredWindowStateStoreTests.STATE);

    Assert.areEqual(JSON.stringify(MirroredWindowStateStoreTests.PRIMARY), JSON.stringify(read));
    Assert.areEqual(0, mirror.reads);
    Assert.areEqual(JSON.stringify([MirroredWindowStateStoreTests.STATE]), JSON.stringify(primary.writes));
    Assert.areEqual(JSON.stringify([MirroredWindowStateStoreTests.PRIMARY, MirroredWindowStateStoreTests.STATE]), JSON.stringify(mirror.writes));
  }

  @TestMethod
  public async keepsNothingOnTheMirrorWhenThePrimaryHasNoBounds(): Promise<void> {
    const primary = new FakeDeviceFileStore();
    const mirror = new FakeDeviceFileStore();
    mirror.kept = MirroredWindowStateStoreTests.STATE;
    const store = new MirroredWindowStateStore(primary, new LocalWindowStateStore(mirror, () => undefined));

    Assert.isNull(await store.readAsync());

    Assert.areEqual(0, mirror.writes.length);
    Assert.areEqual(JSON.stringify(MirroredWindowStateStoreTests.STATE), JSON.stringify(mirror.kept));
  }

  @TestMethod
  public async answersThePrimaryAndLogsWhenTheMirrorCannotKeepIt(): Promise<void> {
    const primary = new FakeDeviceFileStore();
    const mirror = new FakeDeviceFileStore();
    primary.kept = MirroredWindowStateStoreTests.PRIMARY;
    mirror.writeFailure = new RangeError("The disk is full.");
    const logged: string[] = [];
    const store = new MirroredWindowStateStore(primary, new LocalWindowStateStore(mirror, t => logged.push(t)));

    const read = await store.readAsync();

    Assert.areEqual(JSON.stringify(MirroredWindowStateStoreTests.PRIMARY), JSON.stringify(read));
    Assert.areEqual(JSON.stringify(["The window's bounds from the runtime could not be kept on this device, so its next start waits for the runtime's: RangeError: The disk is full."]),
      JSON.stringify(logged));
  }

  @TestMethod
  public async writesTheMirrorWhenThePrimaryCannotBeReachedAndRejectsWithThePrimarysFailure(): Promise<void> {
    const primary = new FakeDeviceFileStore();
    const mirror = new FakeDeviceFileStore();
    primary.writeFailure = new WindowStateNotConnectedException();
    const store = new MirroredWindowStateStore(primary, new LocalWindowStateStore(mirror, () => undefined));

    await Assert.throwsAsync(() => store.writeAsync(MirroredWindowStateStoreTests.STATE), WindowStateNotConnectedException);

    Assert.areEqual(JSON.stringify(MirroredWindowStateStoreTests.STATE), JSON.stringify(mirror.kept));
  }

  @TestMethod
  public async writesThePrimaryWhenTheMirrorFailsAndRejectsWithTheMirrorsFailure(): Promise<void> {
    const primary = new FakeDeviceFileStore();
    const mirror = new FakeDeviceFileStore();
    mirror.writeFailure = new RangeError("The disk is full.");
    const store = new MirroredWindowStateStore(primary, new LocalWindowStateStore(mirror, () => undefined));

    await Assert.throwsAsync(() => store.writeAsync(MirroredWindowStateStoreTests.STATE), RangeError);

    Assert.areEqual(JSON.stringify(MirroredWindowStateStoreTests.STATE), JSON.stringify(primary.kept));
  }
}

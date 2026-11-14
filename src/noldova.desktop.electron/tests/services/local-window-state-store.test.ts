/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DeviceFileStore } from "../../src/services/device-file-store.js";
import { LocalWindowStateStore } from "../../src/services/local-window-state-store.js";

@TestClass
export class LocalWindowStateStoreTests {
  private static readonly FILE: string = "window-state.json";
  private static readonly PREFIX: string = "The window's bounds kept on this device could not be read, so it waits for the runtime's: ";

  @TestMethod
  public async readsNothingWhileNoFileIsKeptAndLogsNothing(): Promise<void> {
    await LocalWindowStateStoreTests.withFolderAsync(async folder => {
      const logged: string[] = [];
      const store = new LocalWindowStateStore(new DeviceFileStore(join(folder, "device"), LocalWindowStateStoreTests.FILE), t => logged.push(t));

      Assert.isNull(await store.readStateAsync());
      Assert.isNull(await store.readAsync());
      Assert.areEqual(0, logged.length);
    });
  }

  @TestMethod
  public async writesTheStateThroughATemporaryFileAndReadsItBack(): Promise<void> {
    await LocalWindowStateStoreTests.withFolderAsync(async folder => {
      const logged: string[] = [];
      const store = new LocalWindowStateStore(new DeviceFileStore(folder, LocalWindowStateStoreTests.FILE), t => logged.push(t));
      await writeFile(join(folder, `${LocalWindowStateStoreTests.FILE}.tmp`), "{\"x\":");

      await store.writeAsync({ x: 300, y: 150, width: 900, height: 600, maximized: true });
      const state = await store.readStateAsync();

      Assert.areEqual("{\"x\":300,\"y\":150,\"width\":900,\"height\":600,\"maximized\":true}", await readFile(join(folder, LocalWindowStateStoreTests.FILE), "utf8"));
      Assert.isFalse(existsSync(join(folder, `${LocalWindowStateStoreTests.FILE}.tmp`)));
      Assert.areEqual("300 150 900 600 true", `${String(state?.x)} ${String(state?.y)} ${String(state?.width)} ${String(state?.height)} ${String(state?.isMaximized)}`);
      Assert.areEqual(JSON.stringify({ x: 300, y: 150, width: 900, height: 600, maximized: true }), JSON.stringify(await store.readAsync()));
      Assert.areEqual(0, logged.length);
    });
  }

  @TestMethod
  public async readsNothingAndLogsAFileThatIsNotJsonOrNotAWindowState(): Promise<void> {
    await LocalWindowStateStoreTests.withFolderAsync(async folder => {
      const logged: string[] = [];
      const store = new LocalWindowStateStore(new DeviceFileStore(folder, LocalWindowStateStoreTests.FILE), t => logged.push(t));
      const file = join(folder, LocalWindowStateStoreTests.FILE);

      await writeFile(file, "{\"x\":");
      const notJson = await store.readStateAsync();
      await writeFile(file, "[300, 150]");
      const notObject = await store.readStateAsync();
      await writeFile(file, "{\"x\":300,\"y\":null,\"width\":900,\"height\":600,\"maximized\":false}");
      const halfPlaced = await store.readStateAsync();
      await writeFile(file, "{\"x\":300,\"y\":150,\"width\":900,\"height\":600}");
      const unmaximized = await store.readAsync();

      Assert.isNull(notJson);
      Assert.isNull(notObject);
      Assert.isNull(halfPlaced);
      Assert.isNull(unmaximized);
      Assert.areEqual(4, logged.length);
      Assert.isTrue(logged.every(t => t.startsWith(LocalWindowStateStoreTests.PREFIX)), logged.join("\n"));
    });
  }

  @TestMethod
  public async readsNothingAndLogsAFileItCannotRead(): Promise<void> {
    await LocalWindowStateStoreTests.withFolderAsync(async folder => {
      const logged: string[] = [];
      const store = new LocalWindowStateStore(new DeviceFileStore(folder, LocalWindowStateStoreTests.FILE), t => logged.push(t));
      await mkdir(join(folder, LocalWindowStateStoreTests.FILE));

      const state = await store.readStateAsync();

      Assert.isNull(state);
      Assert.areEqual(1, logged.length);
      Assert.isTrue(logged[0]?.startsWith(LocalWindowStateStoreTests.PREFIX) === true, logged.join("\n"));
    });
  }

  @TestMethod
  public async rejectsAWriteItCannotMake(): Promise<void> {
    await LocalWindowStateStoreTests.withFolderAsync(async folder => {
      const blocked = join(folder, "file");
      await writeFile(blocked, String.empty);
      const store = new LocalWindowStateStore(new DeviceFileStore(join(blocked, "device"), LocalWindowStateStoreTests.FILE), () => undefined);

      await Assert.throwsAsync(() => store.writeAsync({ x: 300, y: 150, width: 900, height: 600, maximized: false }), Error);
    });
  }

  private static async withFolderAsync(run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-window-state-"));
    try {
      await run(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}

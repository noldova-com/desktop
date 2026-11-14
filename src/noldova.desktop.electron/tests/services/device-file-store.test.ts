/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DeviceFileStore } from "@noldova/desktop.electron";

@TestClass
export class DeviceFileStoreTests {
  @TestMethod
  public async readsNothingBeforeTheFirstWriteThenKeepsTheLastOfWritesMadeTogether(): Promise<void> {
    await DeviceFileStoreTests.withFolderAsync(async root => {
      const folder = join(root, "device");
      const store = new DeviceFileStore(folder, "appearance.json");

      const before = await store.readAsync();
      await Promise.all([store.writeAsync({ "desktop.mode": "Dark" }), store.writeAsync({ "desktop.mode": "Light", "desktop.panelSize": 14 })]);

      Assert.isNull(before);
      Assert.areEqual(JSON.stringify({ "desktop.mode": "Light", "desktop.panelSize": 14 }), JSON.stringify(await new DeviceFileStore(folder, "appearance.json").readAsync()));
      Assert.areEqual("{\"desktop.mode\":\"Light\",\"desktop.panelSize\":14}", await readFile(join(folder, "appearance.json"), "utf8"));
      Assert.isFalse(existsSync(join(folder, "appearance.json.tmp")));
    });
  }

  @TestMethod
  public async keepsEachFileOfAFolderApart(): Promise<void> {
    await DeviceFileStoreTests.withFolderAsync(async folder => {
      await new DeviceFileStore(folder, "appearance.json").writeAsync({ "desktop.mode": "Dark" });
      await new DeviceFileStore(folder, "device-state.json").writeAsync({ trayCloseHintShown: true });

      Assert.areEqual("{\"desktop.mode\":\"Dark\"}", JSON.stringify(await new DeviceFileStore(folder, "appearance.json").readAsync()));
      Assert.areEqual("{\"trayCloseHintShown\":true}", await readFile(join(folder, "device-state.json"), "utf8"));
    });
  }

  @TestMethod
  public refusesAnEmptyFileName(): void {
    Assert.areEqual("fileName", Assert.throws(() => new DeviceFileStore("/devices/this", " "), ArgumentException).parameterName);
  }

  @TestMethod
  public async refusesAFileThatIsNotAJsonObject(): Promise<void> {
    await DeviceFileStoreTests.withFolderAsync(async folder => {
      const store = new DeviceFileStore(folder, "appearance.json");

      await writeFile(join(folder, "appearance.json"), "{\"desktop.mode\":");
      Assert.areEqual("$: The text is not valid JSON.", (await Assert.throwsAsync(() => store.readAsync(), JsonException)).message);
      await writeFile(join(folder, "appearance.json"), "[\"Dark\"]");
      await Assert.throwsAsync(() => store.readAsync(), JsonException);
    });
  }

  @TestMethod
  public async rejectsAWriteItCannotMakeAndStillMakesTheNext(): Promise<void> {
    await DeviceFileStoreTests.withFolderAsync(async root => {
      const blocked = join(root, "file");
      await writeFile(blocked, String.empty);
      const store = new DeviceFileStore(join(blocked, "device"), "appearance.json");
      const working = new DeviceFileStore(root, "appearance.json");

      await Assert.throwsAsync(() => store.writeAsync({ "desktop.mode": "Dark" }), Error);
      await Assert.throwsAsync(() => store.writeAsync({ "desktop.mode": "Light" }), Error);
      await working.writeAsync({ "desktop.mode": "Light" });

      Assert.areEqual(JSON.stringify({ "desktop.mode": "Light" }), JSON.stringify(await working.readAsync()));
    });
  }

  @TestMethod
  public async removesTheFileAfterTheWriteInProgressAndAcceptsAMissingOne(): Promise<void> {
    await DeviceFileStoreTests.withFolderAsync(async folder => {
      const store = new DeviceFileStore(folder, "update-ready.json");

      await Promise.all([store.writeAsync({ version: "1.3.0" }), store.deleteAsync()]);
      await store.deleteAsync();

      Assert.isFalse(existsSync(join(folder, "update-ready.json")));
      Assert.isNull(await store.readAsync());
    });
  }

  @TestMethod
  public async removesTheFileAfterAWriteItCouldNotMake(): Promise<void> {
    await DeviceFileStoreTests.withFolderAsync(async folder => {
      const store = new DeviceFileStore(folder, "update-ready.json");
      const circular: Record<string, JsonValue> = { version: "1.3.0" };
      circular["self"] = circular;

      await store.writeAsync({ version: "1.2.0" });
      const write = store.writeAsync(circular);
      const deletion = store.deleteAsync();

      await Assert.throwsAsync(() => write, TypeError);
      await deletion;
      Assert.isFalse(existsSync(join(folder, "update-ready.json")));
    });
  }

  private static async withFolderAsync(run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-device-files-"));
    try {
      await run(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, sep } from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RuntimeBuild } from "@noldova/desktop.runtime";
import type { IIpcEvent } from "@noldova/desktop.electron";

import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class ClipboardCopierTests {
  @TestMethod
  public async keepsItsOwnNameAndThePackageScopesInCopiedDetailsWhenTheAccountIsNamedAfterOneOfItsWords(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("linux", [`--data-dir=${data}`], {}, "/home/noldova"));
      await MainProcessStartFixture.openAsync(electron);

      const copied = electron.ipcMain.invoke("desktop:copyDetails", MainProcessStartFixture.trustedEvent("linux"),
        "clock 0.0.1: Failed: /home/noldova/notes.json for noldova in Noldova Desktop Sample at node_modules/@noldova/desktop.cli/x.js");

      Assert.areEqual(true, copied);
      Assert.areEqual(
        "clock 0.0.1: Failed: ~/notes.json for [redacted] in Noldova Desktop Sample at node_modules/@noldova/desktop.cli/x.js",
        electron.clipboard.texts[0]?.split("\n").at(-1));
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async copiesOnlyTextFromItsOwnWindowUpToTheLimitAndLogsWhatItRefusesWithoutTheText(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const longest = "x".repeat(32 * 1024 * 1024);

    const answers = [
      electron.ipcMain.invoke("desktop:copyText", trusted, "clock: Failed"),
      electron.ipcMain.invoke("desktop:copyText", trusted, longest),
      electron.ipcMain.invoke("desktop:copyText", trusted, `${longest}x`),
      electron.ipcMain.invoke("desktop:copyText", trusted, 5),
      electron.ipcMain.invoke("desktop:copyText", { sender: { id: 1 }, senderFrame: null }, "clock: Failed")
    ];

    Assert.areEqual(JSON.stringify([true, true, false, false, false]), JSON.stringify(answers));
    Assert.areEqual("clock: Failed", electron.clipboard.texts[0]);
    Assert.areEqual(JSON.stringify([13, 33_554_432]), JSON.stringify(electron.clipboard.texts.map(t => t.length)));
    const lines = process.errors.split("\n").filter(t => t.includes("A text ")).map(t => t.slice(t.indexOf("A text ")));
    Assert.areEqual(JSON.stringify([
      "A text was not copied: it was not text, or longer than 33554432 UTF-16 code units.",
      "A text was not copied: it was not text, or longer than 33554432 UTF-16 code units.",
      "A text was not copied: the request did not come from the window's own page."
    ]), JSON.stringify(lines));
    Assert.isFalse(process.errors.includes("xxxx"));
  }

  @TestMethod
  public async copiesDetailsOnlyFromItsOwnWindowWithItsBuildAndDataFolderAndWithoutTheHomeFolderOrTokens(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("linux", [`--data-dir=${data}`], {}, tmpdir()));
      await MainProcessStartFixture.openAsync(electron);
      const trusted = MainProcessStartFixture.trustedEvent("linux");
      const token = "a".repeat(40);

      const answers = [
        electron.ipcMain.invoke("desktop:copyDetails", trusted, `Platform: linux x64\nclock 0.0.1: Failed: ${join(tmpdir(), "clock")} refused ${token}`),
        electron.ipcMain.invoke("desktop:copyDetails", trusted, 5),
        electron.ipcMain.invoke("desktop:copyDetails", { sender: { id: 1 }, senderFrame: null }, "Platform: linux x64")
      ];

      const identity = RuntimeBuild.identity;
      Assert.areEqual(JSON.stringify([true, false, false]), JSON.stringify(answers));
      Assert.areEqual(JSON.stringify([
        `Noldova Desktop Sample ${identity.productVersion}, build ${identity.fingerprint}\nData folder: ~${sep}${basename(data)}\nPlatform: linux x64\nclock 0.0.1: Failed: ~${sep}clock refused [redacted]`
      ]), JSON.stringify(electron.clipboard.texts));
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async copiesOnlyPngImagesUpToTheByteSideAndPixelLimitsFromItsOwnWindow(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const png = ClipboardCopierTests.pngOf(1, 1);
    const largest = ClipboardCopierTests.sized(ClipboardCopierTests.pngOf(5120, 2880), 64 * 1024 * 1024);
    const wide = ClipboardCopierTests.pngOf(16384, 3051);
    const tooMany = ClipboardCopierTests.sized(ClipboardCopierTests.pngOf(1, 1), 64 * 1024 * 1024 + 1);
    const refused = [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1]), new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1]), new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "),
      new Uint8Array([1, 2, 3]), png.slice(0, 8), png.slice(0, 32), new Uint8Array(), tooMany, ClipboardCopierTests.pngOf(16384, 3052), ClipboardCopierTests.pngOf(16385, 1),
      ClipboardCopierTests.pngOf(1, 16385), ClipboardCopierTests.pngOf(0xffffffff, 0xffffffff), ClipboardCopierTests.pngOf(0, 1), ClipboardCopierTests.pngOf(1, 0), new Uint8Array([...png.slice(0, 12), 0x49, 0x44, 0x41, 0x54, ...png.slice(16)]), "bytes", [...png]];
    const copy = async (bytes: unknown, event: IIpcEvent = trusted): Promise<unknown> => electron.ipcMain.invoke("desktop:copyImage", event, bytes);

    const answers = [await copy(png), await copy(largest), await copy(wide), ...await Promise.all(refused.map(t => copy(t))), await copy(png, { sender: { id: 1 }, senderFrame: null })];

    Assert.areEqual(JSON.stringify([true, true, true, ...refused.map(() => false), false]), JSON.stringify(answers));
    Assert.areEqual(3, electron.clipboard.images.length);
    Assert.isTrue(electron.clipboard.images.every((t, i) => t === [png, largest, wide][i]));
    Assert.areEqual(JSON.stringify([]), JSON.stringify(electron.clipboard.texts));
    const lines = process.errors.split("\n").filter(t => t.includes("An image ")).map(t => t.slice(t.indexOf("An image ")));
    Assert.areEqual(JSON.stringify([
      ...refused.map(() => "An image was not copied: a window part asked without the bytes of a PNG image of at most 16384 pixels a side and 50 million in all, or with more than 64 MiB of them."),
      "An image was not copied: the request did not come from the window's own page."
    ]), JSON.stringify(lines));
  }

  @TestMethod
  public async refusesAnotherImageFromAWindowWhileItsCopyRunsAndCopiesAgainOnceItEnds(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = new FakeElectron();
    await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), electron, new FakeDeviceIdentity(), process);
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const png = ClipboardCopierTests.pngOf(1, 1);
    const hold = Promise.withResolvers<void>();
    electron.clipboard.imageHold = hold.promise;

    const first = electron.ipcMain.invoke("desktop:copyImage", trusted, png);
    const second = await electron.ipcMain.invoke("desktop:copyImage", trusted, png);
    hold.resolve();
    const answers = [await first, second, await electron.ipcMain.invoke("desktop:copyImage", trusted, png)];

    Assert.areEqual("true,false,true", answers.join(","));
    Assert.areEqual(2, electron.clipboard.images.length);
    Assert.areEqual(JSON.stringify(["An image was not copied: the window was still copying another image."]),
      JSON.stringify(process.errors.split("\n").filter(t => t.includes("An image ")).map(t => t.slice(t.indexOf("An image ")))));
  }

  @TestMethod
  public async leavesTheClipboardAsItWasWhenAnImageDoesNotDecodeOrCannotBeCopied(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = new FakeElectron();
    await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), electron, new FakeDeviceIdentity(), process);
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const png = ClipboardCopierTests.pngOf(1, 1);

    electron.clipboard.decodes = false;
    const undecoded = await electron.ipcMain.invoke("desktop:copyImage", trusted, png);
    electron.clipboard.decodes = true;
    electron.clipboard.imageFailure = new Error("the clipboard is busy");
    const failed = await electron.ipcMain.invoke("desktop:copyImage", trusted, png);

    Assert.areEqual("false,false", [undecoded, failed].join(","));
    Assert.areEqual(0, electron.clipboard.images.length);
    Assert.areEqual(JSON.stringify([
      "An image was not copied: its PNG bytes did not decode.",
      "An image could not be copied: Error: the clipboard is busy"
    ]), JSON.stringify(process.errors.split("\n").filter(t => t.includes("An image ")).map(t => t.slice(t.indexOf("An image ")))));
  }

  private static sized(start: Uint8Array, byteLength: number): Uint8Array {
    const bytes = new Uint8Array(byteLength);
    bytes.set(start);
    return bytes;
  }

  private static pngOf(width: number, height: number): Uint8Array {
    const bigEndian = (value: number): number[] => [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...bigEndian(width), ...bigEndian(height), 8, 6, 0, 0, 0, 0, 0, 0, 0]);
  }
}

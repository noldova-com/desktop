/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataDirectory, DiscoveryPublisher, DiscoveryReader, DiscoveryUnreadableException, OwnershipLock, RuntimeDiscovery } from "@noldova/desktop.runtime";

import { ErrorCodeFixture } from "../../fixtures/error-code.fixture.js";
import { FolderProtectorFixture } from "../../fixtures/folder-protector.fixture.js";
import { HeldReadFixture } from "../../fixtures/held-read.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class DiscoveryReaderTests {
  @TestMethod
  public async readsWhatTheOwnerPublished(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using lock = OwnershipLock.acquire(directory);
    const published = new RuntimeDiscovery("127.0.0.1:52000", "token", 4242, "/opt/noldova-desktop/node", "0.0.1", 1, "build");
    await new DiscoveryPublisher(lock, new FolderProtectorFixture()).publishAsync(published);

    const discovery = await DiscoveryReader.readAsync(directory);

    Assert.areEqual(JSON.stringify(published.toJson()), JSON.stringify(discovery?.toJson()));
  }

  @TestMethod
  public async findsNothingWithoutADiscoveryFile(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();

    Assert.isNull(await DiscoveryReader.readAsync(new DataDirectory(folder.path)));
  }

  @TestMethod
  public async findsNothingOnceTheOwnerHasWithdrawnTheFile(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using lock = OwnershipLock.acquire(directory);
    const publisher = new DiscoveryPublisher(lock, new FolderProtectorFixture());
    const published = new RuntimeDiscovery("127.0.0.1:52000", "token", 4242, "/opt/noldova-desktop/node", "0.0.1", 1, "build");
    await publisher.publishAsync(published);
    await publisher.withdrawAsync(published);

    const discovery = await DiscoveryReader.readAsync(directory);

    Assert.isTrue(existsSync(directory.discoveryFolder));
    Assert.isNull(discovery);
  }

  @TestMethod
  public async readsTheFileOnceWindowsLetsGoOfIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using lock = OwnershipLock.acquire(directory);
    const published = new RuntimeDiscovery("127.0.0.1:52000", "token", 4242, "/opt/noldova-desktop/node", "0.0.1", 1, "build");
    await new DiscoveryPublisher(lock, new FolderProtectorFixture()).publishAsync(published);
    using held = new HeldReadFixture(directory.discoveryFile, ["EPERM", "EBUSY", "EACCES"]);

    const discovery = await DiscoveryReader.readAsync(directory, "win32");

    Assert.areEqual(4, held.attempts);
    Assert.areEqual(JSON.stringify(published.toJson()), JSON.stringify(discovery?.toJson()));
  }

  @TestMethod
  public async findsNothingWhenTheFileIsGoneOnceWindowsLetsGoOfIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using held = new HeldReadFixture(directory.discoveryFile, ["EPERM"]);

    const discovery = await DiscoveryReader.readAsync(directory, "win32");

    Assert.areEqual(2, held.attempts);
    Assert.isNull(discovery);
  }

  @TestMethod
  public async failsWithTheReasonWhenTheFileStaysHeld(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using held = new HeldReadFixture(directory.discoveryFile, Array.from({ length: 50 }, () => "EPERM"));

    const failure = await Assert.throwsAsync(() => DiscoveryReader.readAsync(directory, "win32"), Error);

    Assert.areEqual("EPERM 40", `${String(ErrorCodeFixture.of(failure))} ${held.attempts}`);
    Assert.isTrue(failure.message.endsWith(`open '${directory.discoveryFile}'`), failure.message);
  }

  @TestMethod
  public async failsAtOnceWhenTheFileIsHeldOnAnotherSystem(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using held = new HeldReadFixture(directory.discoveryFile, ["EPERM", "EACCES"]);

    const failure = await Assert.throwsAsync(() => DiscoveryReader.readAsync(directory, "linux"), Error);

    Assert.areEqual("EPERM 1", `${String(ErrorCodeFixture.of(failure))} ${held.attempts}`);
  }

  @TestMethod
  public async letsAFileThatCannotBeReadFail(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await mkdir(directory.discoveryFile, { recursive: true });

    const error = await Assert.throwsAsync(() => DiscoveryReader.readAsync(directory), Error);

    Assert.areEqual("EISDIR", ErrorCodeFixture.of(error));
  }

  @TestMethod
  public async failsAtOnceOnAnyOtherError(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using held = new HeldReadFixture(directory.discoveryFile, ["EIO"]);

    const failure = await Assert.throwsAsync(() => DiscoveryReader.readAsync(directory, "win32"), Error);

    Assert.areEqual("EIO 1", `${String(ErrorCodeFixture.of(failure))} ${held.attempts}`);
  }

  @TestMethod
  public async refusesAMalformedFileAndNamesIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await mkdir(directory.discoveryFolder);

    await writeFile(directory.discoveryFile, "{ not json");
    const unparsable = await Assert.throwsAsync(() => DiscoveryReader.readAsync(directory), DiscoveryUnreadableException);
    await writeFile(directory.discoveryFile, "{\"formatVersion\":2}");
    const newer = await Assert.throwsAsync(() => DiscoveryReader.readAsync(directory), DiscoveryUnreadableException);

    Assert.areEqual(`The discovery file ${directory.discoveryFile} is not valid: JsonException: $: The text is not valid JSON.`, unparsable.message);
    Assert.isInstanceOf(unparsable.cause, JsonException);
    Assert.isTrue(newer.message.endsWith("DiscoveryVersionUnsupportedException: The discovery metadata has the unsupported format version 2."));
  }
}

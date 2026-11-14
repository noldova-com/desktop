/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { DataDirectory } from "@noldova/desktop.runtime";

@TestClass
export class DataDirectoryTests {
  private static readonly ROOT: string = path.resolve("noldova-desktop-data");

  @TestMethod
  public normalizesTheRootAndLaysOutItsFiles(): void {
    const directory = new DataDirectory(path.join(DataDirectoryTests.ROOT, "extra", ".."));

    Assert.areEqual(DataDirectoryTests.ROOT, directory.root);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "ownership.sqlite"), directory.ownershipDatabase);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "desktop.sqlite"), directory.shellDatabase);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "discovery"), directory.discoveryFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "discovery", "runtime.json"), directory.discoveryFile);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "logs"), directory.logsFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "logs", "runtime.log"), directory.runtimeLog);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "logs", "runtime.previous.log"), directory.previousRuntimeLog);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "logs", "runtime.errors.log"), directory.runtimeErrorsLog);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "logs", "runtime.previous.errors.log"), directory.previousRuntimeErrorsLog);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "logs", "main.log"), directory.mainProcessLog);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "logs", "main.previous.log"), directory.previousMainProcessLog);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "backups"), directory.backupsFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "main"), directory.profileFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "modules"), directory.modulesFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "work"), directory.workFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "logs"), directory.logsFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "staged"), directory.stagedFolder);
  }

  @TestMethod
  public refusesARelativeRoot(): void {
    const exception = Assert.throws(() => new DataDirectory("noldova-desktop-data"), ArgumentException);

    Assert.areEqual("root", exception.parameterName);
  }

  @TestMethod
  @TestData("notes")
  @TestData("git-hub2")
  public locatesAModuleFolderUnderModules(id: string): void {
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "modules", id), new DataDirectory(DataDirectoryTests.ROOT).locateModuleFolder(id));
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "modules", id, `${id}.sqlite`), new DataDirectory(DataDirectoryTests.ROOT).locateModuleDatabase(id));
  }

  @TestMethod
  @TestData("desktop")
  @TestData("Notes")
  @TestData("-dash")
  @TestData("../escape")
  @TestData(String.empty)
  public refusesAnythingButAModuleId(id: string): void {
    const exception = Assert.throws(() => new DataDirectory(DataDirectoryTests.ROOT).locateModuleFolder(id), ArgumentException);

    Assert.areEqual("id", exception.parameterName);
  }

  @TestMethod
  @TestData("con")
  @TestData("prn")
  @TestData("aux")
  @TestData("nul")
  @TestData("com0")
  @TestData("com1")
  @TestData("com2")
  @TestData("com3")
  @TestData("com4")
  @TestData("com5")
  @TestData("com6")
  @TestData("com7")
  @TestData("com8")
  @TestData("com9")
  @TestData("lpt0")
  @TestData("lpt1")
  @TestData("lpt2")
  @TestData("lpt3")
  @TestData("lpt4")
  @TestData("lpt5")
  @TestData("lpt6")
  @TestData("lpt7")
  @TestData("lpt8")
  @TestData("lpt9")
  public refusesAWindowsDeviceNameOnEveryPlatform(id: string): void {
    const directory = new DataDirectory(DataDirectoryTests.ROOT);

    const exception = Assert.throws(() => directory.locateModuleFolder(id), ArgumentException);

    Assert.areEqual("id", exception.parameterName);
    Assert.areEqual(`The module id "${id}" names a device on Windows, so it is refused on every platform. (Parameter 'id')`, exception.message);
    Assert.throws(() => directory.locateModuleDatabase(id), ArgumentException);
    Assert.throws(() => directory.locateWorkFolder(id), ArgumentException);
  }

  @TestMethod
  @TestData("com10")
  @TestData("console")
  @TestData("nul-tools")
  @TestData("lpt")
  public locatesAnIdThatOnlyStartsLikeADeviceName(id: string): void {
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "modules", id), new DataDirectory(DataDirectoryTests.ROOT).locateModuleFolder(id));
  }
}

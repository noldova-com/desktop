/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  AddonIncompleteException,
  AddonLoadFailedException,
  AddonMissingException,
  AddonUnexpectedValueException,
  type IPosixProcessAddon,
  NativeAddon
} from "@noldova/desktop.runtime";

import { AddonModuleFixture } from "../../fixtures/addon-module.fixture.js";

@TestClass
export class NativeAddonTests {
  @TestMethod
  public locatesAnAddonInThePackagesNativeFolderForTheRunningPlatformAndArchitecture(): void {
    const file = NativeAddon.locate("windows-process.node");
    const other = NativeAddon.locate("windows-process.node", "win32", "arm64");

    Assert.areEqual(`native/${process.platform}-${process.arch}/windows-process.node`, file.split(path.sep).slice(-3).join("/"));
    Assert.areEqual("native/win32-arm64/windows-process.node", other.split(path.sep).slice(-3).join("/"));
    Assert.isTrue(path.isAbsolute(file), file);
  }

  @TestMethod
  public refusesAnAddonWithNoBuildForThePlatformAndArchitectureNamingThem(): void {
    const addon = new NativeAddon<IPosixProcessAddon>(NativeAddon.locate("posix-process.node", "freebsd", "riscv64"), ["startDetached"]);

    const missing = Assert.throws(() => addon.load(), AddonMissingException);

    Assert.areEqual("The runtime has no freebsd-riscv64 build of its addon posix-process.node: native/freebsd-riscv64/posix-process.node is missing.", missing.message);
    Assert.areEqual("freebsd-riscv64/posix-process.node", addon.name);
  }

  @TestMethod
  public async loadsTheAddonOnceAndCallsItsFunctionsOnIt(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ base: 1, peerProcessId(descriptor) { return descriptor + this.base; } }");
    const addon = new NativeAddon<IPosixProcessAddon>(fake.file, ["peerProcessId"]);

    Assert.areEqual(`${AddonModuleFixture.TARGET}/fake-addon.cjs`, addon.name);
    Assert.areEqual(6, addon.load().peerProcessId?.(5));
    Assert.areEqual(8, addon.load().peerProcessId?.(7));
    Assert.isTrue(addon.load() === addon.load());
    Assert.areEqual(7, addon.expect(7, (t): t is number => Object.isNumber(t)));
  }

  @TestMethod
  public async refusesAnAddonItCannotLoadOneThatLacksAFunctionAndAValueItDoesNotExpect(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ peerProcessId() { return 'text'; } }");

    const unloadable = path.join(path.dirname(fake.file), "unloadable.node");
    await writeFile(unloadable, "not an addon");
    const missing = Assert.throws(() => new NativeAddon<IPosixProcessAddon>(unloadable, ["peerProcessId"]).load(), AddonLoadFailedException);
    const incomplete = Assert.throws(() => new NativeAddon<IPosixProcessAddon>(fake.file, ["peerProcessId", "peerToken"]).load(), AddonIncompleteException);
    const addon = new NativeAddon<IPosixProcessAddon>(fake.file, ["peerProcessId"]);
    const unexpected = Assert.throws(() => addon.expect(addon.load().peerProcessId?.(7), (t): t is number => Object.isNumber(t)), AddonUnexpectedValueException);

    Assert.areEqual(`The runtime could not load its addon native/${AddonModuleFixture.TARGET}/unloadable.node.`, missing.message);
    Assert.isInstanceOf(missing.cause, Error);
    Assert.areEqual(`The runtime's addon native/${AddonModuleFixture.TARGET}/fake-addon.cjs lacks functions this runtime calls; it comes from another build.`, incomplete.message);
    Assert.areEqual(`The runtime's addon native/${AddonModuleFixture.TARGET}/fake-addon.cjs returned a value this runtime does not expect; it comes from another build.`, unexpected.message);
  }

  @TestMethod
  public async refusesAModuleThatIsNotAnObject(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("42");

    Assert.throws(() => new NativeAddon<IPosixProcessAddon>(fake.file, []).load(), AddonIncompleteException);
  }

  @TestMethod
  public async refusesAnExportThatIsNotAFunctionAndLoadsAgainAfterAFailure(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ peerProcessId: 7, peerToken: () => null }");
    const addon = new NativeAddon<IPosixProcessAddon>(fake.file, ["peerProcessId"]);

    const incomplete = Assert.throws(() => addon.load(), AddonIncompleteException);

    Assert.areEqual(`The runtime's addon native/${AddonModuleFixture.TARGET}/fake-addon.cjs lacks functions this runtime calls; it comes from another build.`, incomplete.message);
    Assert.throws(() => addon.load(), AddonIncompleteException);
    Assert.isNull(new NativeAddon<IPosixProcessAddon>(fake.file, ["peerToken"]).load().peerToken?.(7));
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { LockedPackage } from "../../../src/models/packaging/locked-package.js";

@TestClass
export class LockedPackageTests {
  private static readonly DATA: Buffer = Buffer.from("tarball");
  private static readonly SHA512: string = createHash("sha512").update(LockedPackageTests.DATA).digest("base64");
  private static readonly ENTRY: Readonly<Record<string, unknown>> = {
    version: "1.2.3-beta.1",
    resolved: "https://registry.example.com/@scope/sample/-/sample-1.2.3-beta.1.tgz",
    integrity: `sha1-AAAA sha512-${LockedPackageTests.SHA512}`
  };

  @TestMethod
  public readsARegistryPackageAtItsDeepestFolder(): void {
    const locked = new LockedPackage("node_modules/parent/node_modules/@scope/sample", { ...LockedPackageTests.ENTRY, name: "@scope/sample" });

    Assert.areEqual("@scope/sample 1.2.3-beta.1 false", `${locked.name} ${locked.version} ${locked.isInstalled}`);
    Assert.areEqual("@scope/sample@1.2.3-beta.1", locked.id);
    Assert.areEqual("@scope+sample-1.2.3-beta.1.tgz", locked.fileName);
    Assert.areEqual(LockedPackageTests.SHA512, locked.sha512);
    Assert.isTrue(locked.matches(LockedPackageTests.DATA));
    Assert.isFalse(locked.matches(Buffer.from("changed")));
  }

  @TestMethod
  public readsAnInstalledPackageFromTheAppsOwnArchive(): void {
    const locked = new LockedPackage("node_modules/sample", { ...LockedPackageTests.ENTRY, resolved: "file:archives/sample-1.2.3.tgz" }, true);
    const root = path.resolve("root");

    Assert.isTrue(locked.isInstalled);
    Assert.areEqual(path.resolve(root, "archives/sample-1.2.3.tgz"), locked.locateArchive(root));
  }

  @TestMethod
  public refusesAnInvalidNameOrVersion(): void {
    const cases: readonly (readonly [string, unknown])[] = [["node_modules/Sample Name", "1.0.0"], ["node_modules/sample", "latest"], ["node_modules/sample", 1]];
    for (const [location, version] of cases) {
      const error = Assert.throws(() => new LockedPackage(location, { ...LockedPackageTests.ENTRY, version }), BuildException);

      Assert.areEqual(`${location} in package-lock.json has no valid package name and version.`, error.message);
    }
  }

  @TestMethod
  public refusesABundledOrAliasedPackage(): void {
    const bundled = Assert.throws(() => new LockedPackage("node_modules/sample", { ...LockedPackageTests.ENTRY, inBundle: true }), BuildException);
    const alias = Assert.throws(() => new LockedPackage("node_modules/sample", { ...LockedPackageTests.ENTRY, name: "other" }), BuildException);

    Assert.areEqual("sample@1.2.3-beta.1 at node_modules/sample in package-lock.json is bundled inside its parent's tarball; bundled dependencies are not supported, so it cannot ship.",
      bundled.message);
    Assert.areEqual("node_modules/sample in package-lock.json installs other under the alias sample; aliases are not supported, so it cannot ship.", alias.message);
  }

  @TestMethod
  public refusesAPackageNotResolvedToARegistryTarball(): void {
    for (const resolved of ["file:archives/sample.tgz", "git+ssh://example.com/sample.git", "not a url", undefined]) {
      const error = Assert.throws(() => new LockedPackage("node_modules/sample", { ...LockedPackageTests.ENTRY, resolved }), BuildException);

      Assert.areEqual("sample@1.2.3-beta.1 at node_modules/sample in package-lock.json is not resolved to a registry tarball, so it cannot ship.", error.message);
    }
  }

  @TestMethod
  public refusesAnInstalledPackageNotFromTheAppsOwnArchive(): void {
    const error = Assert.throws(() => new LockedPackage("node_modules/sample", LockedPackageTests.ENTRY, true), BuildException);

    Assert.areEqual("sample@1.2.3-beta.1 at node_modules/sample is installed but not locked in package-lock.json, and only a package installed from the app's own archive may ship unlocked.",
      error.message);
  }

  @TestMethod
  public refusesAPackageWithoutASha512Integrity(): void {
    for (const integrity of ["sha1-AAAA", undefined]) {
      const error = Assert.throws(() => new LockedPackage("node_modules/sample", { ...LockedPackageTests.ENTRY, integrity }), BuildException);

      Assert.areEqual("sample@1.2.3-beta.1 at node_modules/sample in package-lock.json has no SHA-512 integrity, so its tarball cannot be verified.", error.message);
    }
  }
}

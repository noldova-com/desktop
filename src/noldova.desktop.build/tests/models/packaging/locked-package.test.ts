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
  public isBoundToAPlatformWhenItsLockNamesASystemProcessorOrLibrary(): void {
    const bound = [{}, { os: ["linux"] }, { cpu: ["arm64"] }, { libc: ["glibc"] }].map(t => new LockedPackage("node_modules/sample", { ...LockedPackageTests.ENTRY, ...t }).isPlatformBound);

    Assert.areEqual("false,true,true,true", bound.join(","));
  }

  @TestMethod
  public readsAnInstalledPackageFromTheAppsOwnArchive(): void {
    const locked = new LockedPackage("node_modules/sample", { ...LockedPackageTests.ENTRY, resolved: "file:archives/sample-1.2.3.tgz" }, true);
    const root = path.resolve("root");

    Assert.isTrue(locked.isInstalled);
    Assert.areEqual(path.resolve(root, "archives/sample-1.2.3.tgz"), locked.locateArchive(root));
  }

  @TestMethod
  public readsANoldovaPackageLockedToItsArchiveInThePackagesFolderOfTheAppOrAFolderAboveIt(): void {
    const root = path.resolve("root", "app");
    for (const file of ["_packages/noldova-sample-1.2.3-beta.1.tgz", "../_packages/noldova-sample-1.2.3-beta.1.tgz", "../../_packages/noldova-sample-1.2.3-beta.1.tgz"]) {
      const locked = new LockedPackage("node_modules/@noldova/sample", { ...LockedPackageTests.ENTRY, resolved: `file:${file}` });

      Assert.isFalse(locked.isInstalled, file);
      Assert.isTrue(locked.isArchive, file);
      Assert.areEqual(path.resolve(root, file), locked.locateArchive(root), file);
    }
  }

  @TestMethod
  public readsANoldovaComPackageLockedToItsArchiveInThePackagesFolder(): void {
    const root = path.resolve("root");
    const locked = new LockedPackage("node_modules/@noldova-com/sample", { ...LockedPackageTests.ENTRY, resolved: "file:_packages/noldova-com-sample-1.2.3-beta.1.tgz" });

    Assert.areEqual("@noldova-com/sample,true", [locked.name, String(locked.isArchive)].join());
    Assert.areEqual(path.resolve(root, "_packages", "noldova-com-sample-1.2.3-beta.1.tgz"), locked.locateArchive(root));
  }

  @TestMethod
  public refusesALockedArchiveNotNamedAsNpmPackNamesThePackage(): void {
    for (const file of ["sample.tgz", "noldova-sample-1.0.0.tgz", "noldova-com-sample-1.2.3-beta.1.tgz"]) {
      const resolved = `file:_packages/${file}`;
      const error = Assert.throws(() => new LockedPackage("node_modules/@noldova/sample", { ...LockedPackageTests.ENTRY, resolved }), BuildException);

      Assert.areEqual(`@noldova/sample@1.2.3-beta.1 at node_modules/@noldova/sample in package-lock.json is locked to ${resolved}; `
        + "its archive must be named noldova-sample-1.2.3-beta.1.tgz, the name npm pack gives @noldova/sample@1.2.3-beta.1.", error.message, file);
    }
  }

  @TestMethod
  public refusesALockedFileThatIsNotANoldovaArchiveDirectlyInThePackagesFolder(): void {
    const cases: readonly (readonly [string, string])[] = [
      ["node_modules/@noldova/sample", "file:archives/sample.tgz"],
      ["node_modules/@noldova/sample", "file:_packages/nested/sample.tgz"],
      ["node_modules/@noldova/sample", "file:_packages/../sample.tgz"],
      ["node_modules/@noldova/sample", "file:../other/_packages/sample.tgz"],
      ["node_modules/@noldova/sample", "file:../_packages/../_packages/sample.tgz"],
      ["node_modules/@noldova/sample", "file:/_packages/sample.tgz"],
      ["node_modules/@noldova/sample", "file:_packages/sample"],
      ["node_modules/sample", "file:_packages/sample-1.2.3-beta.1.tgz"]
    ];
    for (const [location, resolved] of cases) {
      const error = Assert.throws(() => new LockedPackage(location, { ...LockedPackageTests.ENTRY, resolved }), BuildException);

      Assert.areEqual(`${location.slice("node_modules/".length)}@1.2.3-beta.1 at ${location} in package-lock.json is locked to ${resolved}; `
        + "a locked file ships only as a .tgz archive of a Noldova package directly in the _packages folder of the app's folder or of a folder above it.", error.message, resolved);
    }
  }

  @TestMethod
  public readsALockedArchiveWithoutAnIntegrityAsOneToShipAsItIs(): void {
    const locked = new LockedPackage("node_modules/@noldova/sample", { version: "1.2.3", resolved: "file:../_packages/noldova-sample-1.2.3.tgz" });

    Assert.isNull(locked.sha512);
    Assert.isFalse(locked.matches(LockedPackageTests.DATA));
  }

  @TestMethod
  public refusesALockedArchiveWhoseIntegrityHoldsNoSha512SayingWhatToWrite(): void {
    const error = Assert.throws(() => new LockedPackage("node_modules/@noldova/sample", { version: "1.2.3", resolved: "file:../_packages/noldova-sample-1.2.3.tgz",
      integrity: "sha1-AAAA" }), BuildException);

    Assert.areEqual("@noldova/sample@1.2.3 at node_modules/@noldova/sample in package-lock.json is locked to file:../_packages/noldova-sample-1.2.3.tgz with an integrity "
      + "that holds no SHA-512, so its archive cannot be verified; write \"integrity\": \"sha512-<the archive's SHA-512 digest in base64>\" beside its \"resolved\", "
      + "or leave the integrity out to ship the archive as it is.", error.message);
  }

  @TestMethod
  public refusesALinkedFolder(): void {
    const error = Assert.throws(() => new LockedPackage("node_modules/@noldova/sample", { resolved: "packages/sample", link: true }), BuildException);

    Assert.areEqual("node_modules/@noldova/sample in package-lock.json links to the folder packages/sample; a linked folder cannot ship, "
      + "so lock the package to its archive in the repository's own _packages folder.", error.message);
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
    for (const resolved of ["git+ssh://example.com/sample.git", "not a url", undefined]) {
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

  @TestMethod
  public refusesAnInstalledArchiveWithoutIntegrityThoughAnOwnArchiveMayShipWithout(): void {
    const entry = { version: "1.2.3", resolved: "file:archives/sample-1.2.3.tgz" };

    const error = Assert.throws(() => new LockedPackage("node_modules/sample", entry, true), BuildException);

    Assert.areEqual("sample@1.2.3 at node_modules/sample in package-lock.json has no SHA-512 integrity, so its tarball cannot be verified.", error.message);
  }
}

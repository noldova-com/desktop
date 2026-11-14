/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { InstalledPackages } from "../../../src/services/packages/installed-packages.js";

@TestClass
export class InstalledPackagesTests {
  @TestMethod
  public async listsScopedNestedAndLinkedPackagesButNotHiddenEntriesOrFilesAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "installed-packages-"));
    try {
      const modules = path.join(folder, "node_modules");
      await InstalledPackagesTests.writePackageAsync(path.join(modules, "plain"), { name: "plain-real" });
      await InstalledPackagesTests.writePackageAsync(path.join(modules, "plain", "node_modules", "nested"), { name: "nested" });
      await InstalledPackagesTests.writePackageAsync(path.join(modules, "@scope", "scoped"), { name: "@scope/scoped" });
      await mkdir(path.join(modules, ".bin"), { recursive: true });
      await writeFile(path.join(modules, "loose.txt"), "file");
      await writeFile(path.join(modules, "@file"), "file");
      await mkdir(path.join(modules, "unnamed"), { recursive: true });
      await InstalledPackagesTests.writePackageAsync(path.join(folder, "linked-source"), { name: "linked" });
      await InstalledPackagesTests.writePackageAsync(path.join(folder, "linked-source", "node_modules", "inside-link"), { name: "inside-link" });
      await symlink(path.join(folder, "linked-source"), path.join(modules, "linked"), "junction");

      const found = await InstalledPackages.listAsync(folder);

      Assert.areEqual([
        `@scope/scoped=${path.join(modules, "@scope", "scoped")}`,
        `linked=${path.join(modules, "linked")}`,
        `nested=${path.join(modules, "plain", "node_modules", "nested")}`,
        `plain-real=${path.join(modules, "plain")}`,
        `unnamed=${path.join(modules, "unnamed")}`
      ].join("\n"), found.map(([name, packageFolder]) => `${name}=${packageFolder}`).sort().join("\n"));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async listsNothingWithoutInstalledPackagesAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "installed-packages-"));
    try {
      Assert.areEqual(0, (await InstalledPackages.listAsync(folder)).length);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async fallsBackOnTheFolderNameForAManifestThatIsMissingOrNotJsonOrHasNoNameAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "installed-packages-"));
    try {
      await mkdir(path.join(folder, "missing"));
      await mkdir(path.join(folder, "broken"));
      await writeFile(path.join(folder, "broken", "package.json"), "{");
      await InstalledPackagesTests.writePackageAsync(path.join(folder, "unnamed"), { version: "1.0.0" });

      const names = [
        await InstalledPackages.readNameAsync(path.join(folder, "missing"), "first"),
        await InstalledPackages.readNameAsync(path.join(folder, "broken"), "second"),
        await InstalledPackages.readNameAsync(path.join(folder, "unnamed"), "third")
      ];

      Assert.areEqual(["first", "second", "third"].join(), names.join());
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async passesOnAFailureToReadTheManifestOtherThanAMissingFileAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "installed-packages-"));
    try {
      await mkdir(path.join(folder, "package.json"));

      const error = await Assert.throwsAsync(() => InstalledPackages.readNameAsync(folder, "fallback"), Error);

      Assert.isTrue(error instanceof Error && "code" in error);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async readsTheDependencyNamesOfTheAskedFieldsThatAreObjectsAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "installed-packages-"));
    try {
      await InstalledPackagesTests.writePackageAsync(folder, { dependencies: { a: "1", b: "2" }, optionalDependencies: { c: "3" }, peerDependencies: { d: "4" }, devDependencies: ["e"] });

      const installed = await InstalledPackages.readDependencyNamesAsync(folder);
      const asked = await InstalledPackages.readDependencyNamesAsync(folder, ["peerDependencies", "devDependencies", "bundleDependencies"]);

      Assert.areEqual(["a", "b", "c"].join(), installed.join());
      Assert.areEqual("d", asked.join());
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async readsTheVersionOrNothingWhenItIsNotTextAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "installed-packages-"));
    try {
      await InstalledPackagesTests.writePackageAsync(path.join(folder, "versioned"), { version: "1.2.3" });
      await InstalledPackagesTests.writePackageAsync(path.join(folder, "numbered"), { version: 1 });

      Assert.areEqual("1.2.3", await InstalledPackages.readVersionAsync(path.join(folder, "versioned")));
      Assert.areEqual(String.empty, await InstalledPackages.readVersionAsync(path.join(folder, "numbered")));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async resolvesAPackageFromTheNearestFolderUpToTheRootAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "installed-packages-"));
    try {
      const root = path.join(folder, "root");
      const from = path.join(root, "a", "b");
      await mkdir(from, { recursive: true });
      await InstalledPackagesTests.writePackageAsync(path.join(root, "node_modules", "@scope", "shared"), { name: "@scope/shared" });
      await InstalledPackagesTests.writePackageAsync(path.join(root, "a", "node_modules", "near"), { name: "near" });
      await InstalledPackagesTests.writePackageAsync(path.join(folder, "node_modules", "outside"), { name: "outside" });

      Assert.areEqual(path.join(root, "node_modules", "@scope", "shared"), InstalledPackages.resolve(root, from, "@scope/shared"));
      Assert.areEqual(path.join(root, "a", "node_modules", "near"), InstalledPackages.resolve(root, from, "near"));
      Assert.isNull(InstalledPackages.resolve(root, from, "outside"));
      Assert.isNull(InstalledPackages.resolve(path.join(folder, "elsewhere"), path.parse(folder).root, "missing"));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async writePackageAsync(folder: string, manifest: Readonly<Record<string, unknown>>): Promise<void> {
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "package.json"), JSON.stringify(manifest));
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { LockedInstallCheck } from "../../../src/services/packages/locked-install-check.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class LockedInstallCheckTests {
  private static readonly LOCKFILE: string = "package-lock.json";
  private static readonly INSTALLED: string = "node_modules/.package-lock.json";
  private static readonly LOCKED: Readonly<Record<string, unknown>> = {
    "": { name: "app", version: "1.0.0" },
    "node_modules/@angular/common": { version: "22.2.6" },
    "node_modules/@angular/forms": { version: "22.2.6", peer: true },
    "node_modules/@noldova/window": { resolved: "src/window", link: true },
    "node_modules/@noldova/odd": { link: true },
    "node_modules/@tybys/wasm-util": { version: "0.10.4", dev: true, optional: true },
    "src/window": { version: "0.0.6" },
    "src/window/node_modules/tslib": { version: "2.8.1" }
  };

  @TestMethod
  public async acceptsAnInstallThatHoldsTheLockfilesVersionsBesideTheBuiltArchives(): Promise<void> {
    await using tree = await LockedInstallCheckTests.createAsync({
      "node_modules/@angular/common": { version: "22.2.6", resolved: "https://registry.npmjs.org/@angular/common/-/common-22.2.6.tgz" },
      "node_modules/@angular/forms": { version: "22.2.6", peer: true },
      "node_modules/@noldova/window": { version: "0.0.6", resolved: "file:_packages/noldova-window-0.0.6.tgz" },
      "node_modules/@noldova/window/node_modules/tslib": { version: "2.8.1" },
      "node_modules/@noldova/linked": { resolved: "src/linked", link: true },
      "node_modules/@noldova/odd": { link: true },
      "node_modules/unread": 5,
      "node_modules/@tybys/wasm-util": { version: "0.10.4", dev: true, optional: true },
      "src/window": { version: "0.0.6" }
    });

    await LockedInstallCheck.checkAsync(tree.path);
  }

  @TestMethod
  public async refusesAVersionTheLockfileDoesNotHold(): Promise<void> {
    await using tree = await LockedInstallCheckTests.createAsync({
      "node_modules/@angular/common": { version: "22.2.6" },
      "node_modules/@angular/forms": { version: "22.3.0", peer: true }
    });

    const error = await Assert.throwsAsync(() => LockedInstallCheck.checkAsync(tree.path), BuildException);

    Assert.areEqual(Resources.formatUnlockedInstall("node_modules/@angular/forms", "22.3.0", "22.2.6"), error.message);
    Assert.isTrue(error.message.startsWith("Installing the built packages put node_modules/@angular/forms at 22.3.0, where package-lock.json holds 22.2.6;"), error.message);
  }

  @TestMethod
  public async refusesAnOptionalPackageAtAVersionTheLockfileDoesNotHold(): Promise<void> {
    await using tree = await LockedInstallCheckTests.createAsync({ "node_modules/@tybys/wasm-util": { version: "0.10.5", dev: true, optional: true } });

    const error = await Assert.throwsAsync(() => LockedInstallCheck.checkAsync(tree.path), BuildException);

    Assert.areEqual(Resources.formatUnlockedInstall("node_modules/@tybys/wasm-util", "0.10.5", "0.10.4"), error.message);
  }

  @TestMethod
  public async refusesAPackageTheLockfileDoesNotList(): Promise<void> {
    await using added = await LockedInstallCheckTests.createAsync({ "node_modules/@angular/animations": { version: "22.3.0" } });
    await using nested = await LockedInstallCheckTests.createAsync({ "node_modules/@noldova/window/node_modules/rxjs": { version: "7.8.2" } });
    await using bare = await LockedInstallCheckTests.createAsync({ "node_modules/@angular/common": {} });

    const addedError = await Assert.throwsAsync(() => LockedInstallCheck.checkAsync(added.path), BuildException);
    const nestedError = await Assert.throwsAsync(() => LockedInstallCheck.checkAsync(nested.path), BuildException);
    const bareError = await Assert.throwsAsync(() => LockedInstallCheck.checkAsync(bare.path), BuildException);

    Assert.areEqual(Resources.formatUnlockedInstall("node_modules/@angular/animations", "22.3.0", null), addedError.message);
    Assert.isTrue(addedError.message.includes("at 22.3.0, which package-lock.json doesn't hold;"), addedError.message);
    Assert.areEqual(Resources.formatUnlockedInstall("node_modules/@noldova/window/node_modules/rxjs", "7.8.2", null), nestedError.message);
    Assert.areEqual(Resources.formatUnlockedInstall("node_modules/@angular/common", "", "22.2.6"), bareError.message);
  }

  @TestMethod
  public async namesEachLockedPeerAndInstalledOptionalPackageAtTheVersionTheLockfileHoldsAtTheTop(): Promise<void> {
    const locked = LockedInstallCheckTests.write({
      "node_modules/@angular/cdk": { version: "22.2.7", peerDependencies: { "@angular/forms": "^22.0.0", "@angular/common": "^22.0.0", "@angular/animations": "^22.0.0" } },
      "node_modules/@angular/common": { version: "22.2.6" },
      "node_modules/@angular/forms": { version: "22.2.6", peerDependencies: { "@angular/common": "22.2.6", "@noldova/window": "*", "@noldova/odd": "*" } },
      "node_modules/@noldova/window": { resolved: "src/window", link: true },
      "node_modules/@noldova/odd": { version: 1 },
      "node_modules/@tybys/wasm-util": { version: "0.10.4", dev: true, optional: true },
      "node_modules/@esbuild/win32-x64": { version: "0.27.0", dev: true, optional: true },
      "node_modules/@napi-rs/wasm-runtime": { version: "1.2.7", dev: true, optional: true, peerDependencies: { "@emnapi/core": "^1.7.1" } },
      "node_modules/@napi-rs/wasm-runtime/node_modules/tslib": { version: "2.8.1", dev: true, optional: true },
      "node_modules/tslib": { version: "2.8.1" },
      "src/window": { version: "0.0.6", peerDependencies: { "@angular/cdk": "22.2.7" } },
      "node_modules/plain": 5
    });
    await using tree = await SourceTreeFixture.createAsync({
      [LockedInstallCheckTests.LOCKFILE]: locked,
      [LockedInstallCheckTests.INSTALLED]: LockedInstallCheckTests.write({
        "node_modules/@tybys/wasm-util": { version: "0.10.5", dev: true, optional: true },
        "node_modules/@napi-rs/wasm-runtime": { version: "1.2.7", dev: true, optional: true },
        "node_modules/@napi-rs/wasm-runtime/node_modules/tslib": { version: "2.8.1", dev: true, optional: true },
        "node_modules/tslib": { version: "2.8.1" },
        "src/window": { version: "0.0.6" }
      })
    });
    await using fresh = await SourceTreeFixture.createAsync({ [LockedInstallCheckTests.LOCKFILE]: locked });
    await using none = await SourceTreeFixture.createAsync();

    Assert.areEqual(JSON.stringify(["@angular/cdk@22.2.7", "@angular/common@22.2.6", "@angular/forms@22.2.6", "@tybys/wasm-util@0.10.4"]),
      JSON.stringify(await LockedInstallCheck.listLockedSpecsAsync(tree.path)));
    Assert.areEqual(JSON.stringify(["@angular/cdk@22.2.7", "@angular/common@22.2.6", "@angular/forms@22.2.6"]), JSON.stringify(await LockedInstallCheck.listLockedSpecsAsync(fresh.path)));
    Assert.areEqual(0, (await LockedInstallCheck.listLockedSpecsAsync(none.path)).length);
  }

  @TestMethod
  public async namesEachPeerOfTheBuiltPackagesAtTheVersionTheLockfileHoldsAtTheTop(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      [LockedInstallCheckTests.LOCKFILE]: LockedInstallCheckTests.write({
        "node_modules/@noldova/ui.components.angular": { version: "0.0.12" },
        "node_modules/@noldova/context.core": { version: "0.0.9" },
        "node_modules/@noldova/desktop.protocol": { resolved: "src/protocol", link: true },
        "node_modules/@noldova/desktop.window/node_modules/rxjs": { version: "7.8.2" }
      })
    });

    const specs = await LockedInstallCheck.listLockedSpecsAsync(tree.path, ["@noldova/ui.components.angular", "@noldova/context.core", "@noldova/desktop.protocol", "rxjs", "@noldova/unlocked"]);

    Assert.areEqual(JSON.stringify(["@noldova/context.core@0.0.9", "@noldova/ui.components.angular@0.0.12"]), JSON.stringify(specs));
  }

  @TestMethod
  public async checksNothingWithoutPackageLockJson(): Promise<void> {
    await using empty = await SourceTreeFixture.createAsync();
    await using installedOnly = await SourceTreeFixture.createAsync({ [LockedInstallCheckTests.INSTALLED]: LockedInstallCheckTests.write({ "node_modules/a": { version: "1.0.0" } }) });

    await LockedInstallCheck.checkAsync(empty.path);
    await LockedInstallCheck.checkAsync(installedOnly.path);
  }

  @TestMethod
  public async refusesAnInstallThatLeftNoInstalledLockfileBesidePackageLockJson(): Promise<void> {
    await using lockedOnly = await SourceTreeFixture.createAsync({ [LockedInstallCheckTests.LOCKFILE]: LockedInstallCheckTests.write(LockedInstallCheckTests.LOCKED) });

    const error = await Assert.throwsAsync(() => LockedInstallCheck.checkAsync(lockedOnly.path), BuildException);

    Assert.areEqual(Resources.formatInstalledLockfileMissing("node_modules/.package-lock.json"), error.message);
    Assert.isTrue(error.message.startsWith("Installing the built packages left no node_modules/.package-lock.json beside package-lock.json,"), error.message);
  }

  private static async createAsync(installed: Readonly<Record<string, unknown>>): Promise<SourceTreeFixture> {
    return await SourceTreeFixture.createAsync({
      [LockedInstallCheckTests.LOCKFILE]: LockedInstallCheckTests.write(LockedInstallCheckTests.LOCKED),
      [LockedInstallCheckTests.INSTALLED]: LockedInstallCheckTests.write(installed)
    });
  }

  private static write(packages: Readonly<Record<string, unknown>>): string {
    return JSON.stringify({ name: "app", version: "1.0.0", lockfileVersion: 3, packages });
  }
}

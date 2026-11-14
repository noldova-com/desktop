/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageManifest } from "../../../src/models/packages/package-manifest.js";
import { OmittedOptionals } from "../../../src/models/packaging/omitted-optionals.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { TypeOnlyPeers } from "../../../src/models/packaging/type-only-peers.js";
import { ThirdPartyClosure } from "../../../src/services/packaging/third-party-closure.js";
import { Resources } from "../../../src/resources.js";

@TestClass
export class ThirdPartyClosureTests {
  private static readonly CORE: string = "@noldova/context.core";
  private static readonly JSON: string = "@noldova/context.json";
  private static readonly CLI: string = "@noldova/desktop.cli";
  private static readonly ELECTRON: string = "electron";
  private static readonly RANGE: string = ">=0.0.2 <0.1.0";
  private static readonly LINUX: PackageTarget = new PackageTarget(Resources.linuxTarget, "x64");

  @TestMethod
  public async shipsTheContextPackagesAShippedPackageTakesAsPeersAsync(): Promise<void> {
    const manifest = new PackageManifest("src/noldova.desktop.cli", ThirdPartyClosureTests.CLI, [], undefined, [ThirdPartyClosureTests.CORE, "electron"]);

    const shipped = await ThirdPartyClosureTests.collectAsync({ [`node_modules/${ThirdPartyClosureTests.CORE}`]: ThirdPartyClosureTests.lock("0.0.6") }, [manifest], []);

    Assert.areEqual("@noldova/context.core@0.0.6", shipped);
  }

  @TestMethod
  public async shipsTheContextPackagesALockedPackageNeedsAsPeersButNotAnOptionalOneOrAnotherPeerAsync(): Promise<void> {
    const shipped = await ThirdPartyClosureTests.collectAsync({
      [`node_modules/${ThirdPartyClosureTests.CLI}`]: {
        ...ThirdPartyClosureTests.lock("0.0.75"),
        peerDependencies: { [ThirdPartyClosureTests.CORE]: ThirdPartyClosureTests.RANGE, [ThirdPartyClosureTests.JSON]: ThirdPartyClosureTests.RANGE, [ThirdPartyClosureTests.ELECTRON]: "41.2.0" },
        peerDependenciesMeta: { [ThirdPartyClosureTests.JSON]: { optional: true } }
      },
      [`node_modules/${ThirdPartyClosureTests.CORE}`]: ThirdPartyClosureTests.lock("0.0.6"),
      [`node_modules/${ThirdPartyClosureTests.JSON}`]: ThirdPartyClosureTests.lock("0.0.6"),
      [`node_modules/${ThirdPartyClosureTests.ELECTRON}`]: ThirdPartyClosureTests.lock("41.2.0")
    }, [], [ThirdPartyClosureTests.CLI]);

    Assert.areEqual("@noldova/context.core@0.0.6, @noldova/desktop.cli@0.0.75", shipped);
  }

  @TestMethod
  public async refusesAContextPeerThatTheRootLockfileDoesNotLockAsync(): Promise<void> {
    const manifest = new PackageManifest("src/noldova.desktop.cli", ThirdPartyClosureTests.CLI, [], undefined, [ThirdPartyClosureTests.CORE]);

    const error = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({}, [manifest], []), BuildException);

    Assert.areEqual("src/noldova.desktop.cli/package.json needs @noldova/context.core, which the root package-lock.json does not lock; pin it in the root package.json and run npm install.",
      error.message);
  }

  @TestMethod
  public async refusesAPackageTheBuildShipsThatTheRootLockfileDoesNotLockAsync(): Promise<void> {
    const error = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({}, [], ["left-pad"]), BuildException);

    Assert.areEqual("The build ships left-pad, which the root package-lock.json does not lock; pin it in the root package.json and run npm install.", error.message);
  }

  @TestMethod
  public async findsEachDependencyInTheNearestNodeModulesFolderUpwardsAsync(): Promise<void> {
    const shipped = await ThirdPartyClosureTests.collectAsync({
      "node_modules/host": { ...ThirdPartyClosureTests.lock("1.0.0"), dependencies: { inner: "^1.0.0" } },
      "node_modules/host/node_modules/inner": { ...ThirdPartyClosureTests.lock("1.0.0"), dependencies: { shared: "^1.0.0", nested: "^1.0.0" } },
      "node_modules/host/node_modules/nested": ThirdPartyClosureTests.lock("2.0.0"),
      "node_modules/nested": ThirdPartyClosureTests.lock("3.0.0"),
      "node_modules/shared": { ...ThirdPartyClosureTests.lock("1.0.0"), dependencies: { host: "^1.0.0" } }
    }, [], ["host"]);

    Assert.areEqual("host@1.0.0, inner@1.0.0, nested@2.0.0, shared@1.0.0", shipped);
  }

  @TestMethod
  public async refusesTwoVersionsOfOnePackageAsync(): Promise<void> {
    const error = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({
      "node_modules/first": { ...ThirdPartyClosureTests.lock("1.0.0"), dependencies: { shared: "^2.0.0" } },
      "node_modules/first/node_modules/shared": ThirdPartyClosureTests.lock("2.0.0"),
      "node_modules/second": { ...ThirdPartyClosureTests.lock("1.0.0"), dependencies: { shared: "^1.0.0" } },
      "node_modules/shared": ThirdPartyClosureTests.lock("1.0.0")
    }, [], ["first", "second"]), BuildException);

    Assert.areEqual("The stage installs one version of each third-party package, but the shipped packages need shared@2.0.0 at node_modules/first/node_modules/shared "
      + "and shared@1.0.0 at node_modules/shared.", error.message);
  }

  @TestMethod
  public async refusesADependencyTheLockfileDoesNotLockAsync(): Promise<void> {
    const error = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({
      "node_modules/host": { ...ThirdPartyClosureTests.lock("1.0.0"), dependencies: { missing: "^1.0.0" } }
    }, [], ["host"]), BuildException);

    Assert.areEqual("node_modules/host needs missing, which package-lock.json does not lock.", error.message);
  }

  @TestMethod
  public async passesOverAnOptionalDependencyThatIsNotLockedOrDoesNotRunOnTheTargetAsync(): Promise<void> {
    const shipped = await ThirdPartyClosureTests.collectAsync({
      "node_modules/host": { ...ThirdPartyClosureTests.lock("1.0.0"), optionalDependencies: { "missing": "^1.0.0", "windows-only": "^1.0.0", "linux-only": "^1.0.0" } },
      "node_modules/windows-only": { ...ThirdPartyClosureTests.lock("1.0.0"), os: ["win32"] },
      "node_modules/linux-only": { ...ThirdPartyClosureTests.lock("1.0.0"), os: ["!win32", "!darwin"], cpu: ["x64", "arm64"], libc: ["glibc"] }
    }, [], ["host"]);

    Assert.areEqual("host@1.0.0, linux-only@1.0.0", shipped);
  }

  @TestMethod
  public async refusesADependencyThatDoesNotRunOnTheTargetAsync(): Promise<void> {
    const cpu = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({
      "node_modules/host": { ...ThirdPartyClosureTests.lock("1.0.0"), dependencies: { arm: "^1.0.0" } },
      "node_modules/arm": { ...ThirdPartyClosureTests.lock("1.0.0"), cpu: ["!x64"] }
    }, [], ["host"]), BuildException);
    const libc = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({
      "node_modules/host": { ...ThirdPartyClosureTests.lock("1.0.0"), dependencies: { musl: "^1.0.0" } },
      "node_modules/musl": { ...ThirdPartyClosureTests.lock("1.0.0"), libc: ["musl"] }
    }, [], ["host"]), BuildException);

    Assert.areEqual("node_modules/arm in package-lock.json does not run on linux-x64, yet a shipped package needs it.", cpu.message);
    Assert.areEqual("node_modules/musl in package-lock.json does not run on linux-x64, yet a shipped package needs it.", libc.message);
  }

  @TestMethod
  public async readsTheLibraryOnlyForLinuxAsync(): Promise<void> {
    const shipped = await ThirdPartyClosureTests.collectAsync({
      "node_modules/musl": { ...ThirdPartyClosureTests.lock("1.0.0"), libc: ["musl"] }
    }, [], ["musl"], null, new PackageTarget(Resources.windowsTarget, "x64"));

    Assert.areEqual("musl@1.0.0", shipped);
  }

  @TestMethod
  public async findsACompanyPackageOnlyNpmsInstalledLockfileLocksAsync(): Promise<void> {
    const sample = "@noldova/sample";

    const shipped = await ThirdPartyClosureTests.collectAsync({}, [], [sample], {
      [`node_modules/${sample}`]: { ...ThirdPartyClosureTests.lock("0.0.1"), resolved: "file:archives/noldova-sample-0.0.1.tgz" }
    });
    const thirdParty = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({}, [], ["left-pad"], {
      "node_modules/left-pad": { ...ThirdPartyClosureTests.lock("1.0.0"), resolved: "file:archives/left-pad-1.0.0.tgz" }
    }), BuildException);

    Assert.areEqual("@noldova/sample@0.0.1", shipped);
    Assert.isTrue(thirdParty.message.startsWith("The build ships left-pad, "), thirdParty.message);
  }

  @TestMethod
  public async refusesALockfileThatIsNotJsonOrNotOfVersionThreeAsync(): Promise<void> {
    const text = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({}, [], [], null, ThirdPartyClosureTests.LINUX, "{"), BuildException);
    const version = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({}, [], [], null, ThirdPartyClosureTests.LINUX,
      JSON.stringify({ lockfileVersion: 2, packages: {} })), BuildException);
    const packages = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({}, [], [], null, ThirdPartyClosureTests.LINUX,
      JSON.stringify({ lockfileVersion: 3 })), BuildException);
    const installed = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({}, [], [], "["), BuildException);

    Assert.areEqual("The root package-lock.json could not be read as JSON.", text.message);
    Assert.areEqual("The root package-lock.json must be a lockfile of version 3 with its packages.", version.message);
    Assert.areEqual("The root package-lock.json must be a lockfile of version 3 with its packages.", packages.message);
    Assert.areEqual("npm's node_modules/.package-lock.json could not be read as JSON.", installed.message);
  }

  @TestMethod
  public async refusesARequiredPeerOfAnOwnSourcePackageThatNothingShipsUnlessItIsOptionalTypeOnlyOrShippedAsync(): Promise<void> {
    const id = `${ThirdPartyClosureTests.CLI}@1.2.3`;
    const required = new PackageManifest("src/noldova.desktop.cli", ThirdPartyClosureTests.CLI, [], undefined, [ThirdPartyClosureTests.ELECTRON, "optional", "react"],
      undefined, undefined, undefined, undefined, undefined, ["optional"]);
    const optional = new PackageManifest("src/noldova.desktop.cli", ThirdPartyClosureTests.CLI, [], undefined, ["react"], undefined, undefined, undefined, undefined, undefined, ["react"]);
    const collect = (manifest: PackageManifest, roots: readonly string[], typeOnly: TypeOnlyPeers): Promise<string> => ThirdPartyClosureTests.withClosureAsync(
      { "node_modules/react": ThirdPartyClosureTests.lock("18.3.1") }, t => t.collect([manifest], roots, typeOnly, new Set(), new OmittedOptionals(), () => "1.2.3")[0].map(u => u.id).join());

    const error = await Assert.throwsAsync(() => collect(required, [], new TypeOnlyPeers()), BuildException);
    const passed = [await collect(optional, [], new TypeOnlyPeers()), await collect(required, [], new TypeOnlyPeers(new Map([[id, new Set(["react"])]]))),
      await collect(required, ["react"], new TypeOnlyPeers())];

    Assert.areEqual(`${id} at src/noldova.desktop.cli needs the peer dependency react, which no shipped package brings and Electron does not provide, so it would fail at runtime.`,
      error.message);
    Assert.areEqual(JSON.stringify(["", "", "react@18.3.1"]), JSON.stringify(passed));
  }

  @TestMethod
  public async refusesAPeerNoShippedPackageBringsButNotElectronAnOwnPackageOrAnOptionalPeerAsync(): Promise<void> {
    const host = {
      ...ThirdPartyClosureTests.lock("1.0.0"),
      peerDependencies: { "electron": "44.9.1", [ThirdPartyClosureTests.CLI]: "^0.0.1", "optional": "^1.0.0", "react": "^18.0.0" },
      peerDependenciesMeta: { optional: { optional: true } }
    };
    const own = new PackageManifest("src/noldova.desktop.cli", ThirdPartyClosureTests.CLI, []);

    const error = await Assert.throwsAsync(() => ThirdPartyClosureTests.collectAsync({ "node_modules/host": host }, [own], ["host"]), BuildException);

    Assert.areEqual("host@1.0.0 at node_modules/host needs the peer dependency react, which no shipped package brings and Electron does not provide, so it would fail at runtime.",
      error.message);
  }

  @TestMethod
  public async leavesOutTheOptionalDependenciesTheAppOmitsAndListsThoseThatWouldShipAsync(): Promise<void> {
    const omitted = new OmittedOptionals(new Map([["host@1.0.0", new Set(["sdk", "windows-only"])]]));

    const [shipped, leftOut] = await ThirdPartyClosureTests.withClosureAsync({
      "node_modules/host": { ...ThirdPartyClosureTests.lock("1.0.0"), optionalDependencies: { "sdk": "^1.0.0", "windows-only": "^1.0.0" } },
      "node_modules/sdk": ThirdPartyClosureTests.lock("1.0.0"),
      "node_modules/windows-only": { ...ThirdPartyClosureTests.lock("1.0.0"), os: ["win32"] }
    }, t => t.collect([], ["host"], new TypeOnlyPeers(), new Set(), omitted));

    Assert.areEqual("host@1.0.0", shipped.map(t => t.id).join(", "));
    Assert.areEqual(JSON.stringify([["host@1.0.0", ["sdk"]]]), JSON.stringify([...leftOut]));
  }

  @TestMethod
  public async refusesLeavingOutADependencyThatIsNotOptionalAsync(): Promise<void> {
    const omitted = new OmittedOptionals(new Map([["host@1.0.0", new Set(["sdk"])]]));

    const error = await Assert.throwsAsync(() => ThirdPartyClosureTests.withClosureAsync({
      "node_modules/host": { ...ThirdPartyClosureTests.lock("1.0.0"), dependencies: { sdk: "^1.0.0" } },
      "node_modules/sdk": ThirdPartyClosureTests.lock("1.0.0")
    }, t => t.collect([], ["host"], new TypeOnlyPeers(), new Set(), omitted)), BuildException);

    Assert.areEqual("desktop.packaging.omittedOptionals leaves out sdk of host@1.0.0, which is not one of its optional dependencies; an app leaves out only an optional "
      + "dependency it never loads.", error.message);
  }

  @TestMethod
  public async leavesAModulesWindowPackageToTheWindowBuildAsync(): Promise<void> {
    const [shipped] = await ThirdPartyClosureTests.withClosureAsync({
      "node_modules/@noldova/sample": { ...ThirdPartyClosureTests.lock("0.0.1"), dependencies: { "@noldova/sample.window": "0.0.1" } }
    }, t => t.collect([], ["@noldova/sample"], new TypeOnlyPeers(), new Set(["@noldova/sample.window"])));

    Assert.areEqual("@noldova/sample@0.0.1", shipped.map(t => t.id).join(", "));
  }

  private static lock(version: string): Readonly<Record<string, unknown>> {
    return { version, resolved: `https://registry.example.com/package-${version}.tgz`, integrity: `sha512-${createHash("sha512").update(version).digest("base64")}` };
  }

  private static async collectAsync(packages: Readonly<Record<string, unknown>>, manifests: readonly PackageManifest[], rootPackages: readonly string[],
    installed: Readonly<Record<string, unknown>> | string | null = null, target: PackageTarget = ThirdPartyClosureTests.LINUX, lockfile: string | null = null): Promise<string> {
    const [shipped] = await ThirdPartyClosureTests.withClosureAsync(packages, t => t.collect(manifests, rootPackages), installed, target, lockfile);
    return shipped.map(t => t.id).sort().join(", ");
  }

  private static async withClosureAsync<T>(packages: Readonly<Record<string, unknown>>, run: (closure: ThirdPartyClosure) => T,
    installed: Readonly<Record<string, unknown>> | string | null = null, target: PackageTarget = ThirdPartyClosureTests.LINUX, lockfile: string | null = null): Promise<T> {
    const root = await mkdtemp(path.join(tmpdir(), "desktop-closure-"));
    try {
      await writeFile(path.join(root, "package-lock.json"), lockfile ?? JSON.stringify({ lockfileVersion: 3, packages }));
      if (!Object.isNull(installed)) {
        await mkdir(path.join(root, "node_modules"));
        await writeFile(path.join(root, "node_modules", ".package-lock.json"),
          Object.isString(installed) ? installed : JSON.stringify({ lockfileVersion: 3, packages: installed }));
      }
      return run(await ThirdPartyClosure.readAsync(root, target));
    }
    finally {
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }
}

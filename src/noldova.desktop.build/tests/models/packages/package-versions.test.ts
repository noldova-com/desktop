/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageManifest } from "../../../src/models/packages/package-manifest.js";
import { PackageVersions } from "../../../src/models/packages/package-versions.js";
import { Resources } from "../../../src/resources.js";
import { ModuleCatalog } from "../../../src/services/modules/module-catalog.js";
import { PackageNaming } from "../../../src/services/packages/package-naming.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class PackageVersionsTests {
  @TestMethod
  public async versionsAModulesPackagesAtItsModulesVersionAndAFixturePackageAtItsOwn(): Promise<void> {
    const fixture = `${Resources.modulePackageFixturesFolder}/weather`;
    await using tree = await SourceTreeFixture.createAsync({
      "src/modules/notes/module.json": PackageVersionsTests.declare("notes", "0.0.7", ["runtime"]),
      "src/modules/notes/runtime/runtime-part.ts": "",
      [`${fixture}/module.json`]: PackageVersionsTests.declare("weather", "0.0.3", []),
      [`${Resources.modulePackageFixturesFolder}/empty/README.md`]: "# Empty"
    });
    const packages = [new PackageManifest("src/modules/notes/runtime", "@noldova/desktop.notes.runtime", []), new PackageManifest("src/noldova.desktop.protocol", "@noldova/desktop.protocol", [])];

    const versions = await PackageVersions.readAsync(new ModuleCatalog(tree.path), "1.2.3", packages, "abc123");

    Assert.areEqual("0.0.7|1.2.3|0.0.3|abc123", [
      versions.of("@noldova/desktop.notes.runtime"),
      versions.of("@noldova/desktop.protocol"),
      versions.of(PackageNaming.nameFixturePackage(fixture.slice(Resources.moduleFixtureFolder.length + 1))),
      versions.commit
    ].join("|"));
  }

  @TestMethod
  public async refusesToVersionPackagesWhenAModuleCannotBeRead(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "src/modules/broken/module.json": "{" });

    const error = await Assert.throwsAsync(() => PackageVersions.readAsync(new ModuleCatalog(tree.path), "1.2.3", []), BuildException);

    Assert.isTrue(error.message.includes("src/modules/broken/module.json"), error.message);
  }

  @TestMethod
  public stampsTheVersionTheOwnDependenciesAndTheCommit(): void {
    const versions = new PackageVersions("1.2.3", "abc123", new Map([["@noldova/desktop.notes.runtime", "0.0.7"]]));
    const manifest = new PackageManifest("src/noldova.desktop.electron", "@noldova/desktop.electron", ["@noldova/desktop.notes.runtime", "@noldova/desktop.protocol"]);
    const text = JSON.stringify({
      name: "@noldova/desktop.electron",
      version: "__VERSION__",
      dependencies: { "@noldova/desktop.notes.runtime": "__VERSION__", "left-pad": "1.0.0" },
      peerDependencies: { "@noldova/desktop.protocol": "__VERSION__" }
    });

    const stamped = JsonReader.parse(versions.stampManifest(manifest, text));

    Assert.areEqual("1.2.3|0.0.7|1.0.0|1.2.3|abc123", [
      stamped.readString("version"),
      stamped.readObject("dependencies").readString("@noldova/desktop.notes.runtime"),
      stamped.readObject("dependencies").readString("left-pad"),
      stamped.readObject("peerDependencies").readString("@noldova/desktop.protocol"),
      stamped.readString("gitHead")
    ].join("|"));
  }

  @TestMethod
  public stampsNoCommitOrDependenciesItDoesNotHave(): void {
    const stamped = JsonReader.parse(new PackageVersions("1.2.3").stampManifest(new PackageManifest("src/noldova.desktop.cli", "@noldova/desktop.cli", []),
      JSON.stringify({ name: "@noldova/desktop.cli" })));

    Assert.areEqual("1.2.3", stamped.readString("version"));
    Assert.isFalse(stamped.hasField("gitHead") || stamped.hasField("dependencies") || stamped.hasField("peerDependencies"));
    Assert.isNull(new PackageVersions("1.2.3").commit);
  }

  private static declare(id: string, version: string, parts: readonly string[]): string {
    return JSON.stringify({ id, version, displayName: id, description: "Used by the tests.", parts, dependencies: {}, contributes: {} });
  }
}

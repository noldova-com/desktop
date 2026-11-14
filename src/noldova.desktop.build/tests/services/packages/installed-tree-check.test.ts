/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildCommandLine } from "@noldova/desktop.build";

import { ModuleAppFixture } from "../../fixtures/module-app.fixture.js";

@TestClass
export class InstalledTreeCheckTests {
  private static readonly CONTEXT: string = "@noldova/context.core";
  private static readonly SECOND_COPY: string = "The app's install holds a second copy of";
  private static readonly REACHES: string = "reaches the Angular package";

  @TestMethod
  public async acceptsATreeWithOneCopyOfEachSharedPackageAndAngularOnlyOnTheWindowSide(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();

    const output = await InstalledTreeCheckTests.runAsync(app, environment);

    Assert.isFalse(output.includes(InstalledTreeCheckTests.SECOND_COPY), output);
    Assert.isFalse(output.includes(InstalledTreeCheckTests.REACHES), output);
    Assert.isTrue(output.includes("Angular packages built and installed: 0.\n"), output);
  }

  @TestMethod
  public async refusesACopyOfAPackageTheAppHoldsOnceInstalledUnderAnNpmAlias(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.installPackageAsync([], "alias", InstalledTreeCheckTests.CONTEXT);

    const output = await InstalledTreeCheckTests.runAsync(app, environment);

    Assert.isTrue(output.includes(`${InstalledTreeCheckTests.SECOND_COPY} ${InstalledTreeCheckTests.CONTEXT}, at node_modules/alias;`), output);
  }

  @TestMethod
  public async refusesACopyOfAPackageTheAppHoldsOnceThatIsALinkToAFolder(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.linkPackageAsync([], "linked", ModuleAppFixture.RUNTIME);

    const output = await InstalledTreeCheckTests.runAsync(app, environment);

    Assert.isTrue(output.includes(`${InstalledTreeCheckTests.SECOND_COPY} ${ModuleAppFixture.RUNTIME}, at node_modules/linked;`), output);
  }

  @TestMethod
  public async refusesASecondCopyOfAnAngularPackageNestedUnderAnotherPackage(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.installPackageAsync(["node_modules", ...ModuleAppFixture.RUNTIME_PACKAGE.split("/")], ModuleAppFixture.ANGULAR_CORE, ModuleAppFixture.ANGULAR_CORE);

    const output = await InstalledTreeCheckTests.runAsync(app, environment);

    Assert.isTrue(output.includes(
      `${InstalledTreeCheckTests.SECOND_COPY} ${ModuleAppFixture.ANGULAR_CORE}, at node_modules/${ModuleAppFixture.RUNTIME_PACKAGE}/node_modules/${ModuleAppFixture.ANGULAR_CORE};`), output);
  }

  @TestMethod
  public async refusesACopyOfASharedPackageInTheWindowAppsOwnFolder(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.installPackageAsync(ModuleAppFixture.WINDOW_APP, InstalledTreeCheckTests.CONTEXT, InstalledTreeCheckTests.CONTEXT);

    const output = await InstalledTreeCheckTests.runAsync(app, environment);

    Assert.isTrue(output.includes(
      `${InstalledTreeCheckTests.SECOND_COPY} ${InstalledTreeCheckTests.CONTEXT}, at ${ModuleAppFixture.WINDOW_APP.join("/")}/node_modules/${InstalledTreeCheckTests.CONTEXT};`), output);
  }

  @TestMethod
  public async refusesARuntimePackageThatReachesAngularThroughItsDependencies(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.installPackageAsync([], ModuleAppFixture.THIRD_PARTY, ModuleAppFixture.THIRD_PARTY);
    await app.editInstalledManifestAsync(ModuleAppFixture.THIRD_PARTY, { peerDependencies: { [ModuleAppFixture.ANGULAR_CORE]: ModuleAppFixture.ANGULAR_VERSION } });
    await app.editInstalledManifestAsync(ModuleAppFixture.RUNTIME, { dependencies: { [ModuleAppFixture.THIRD_PARTY]: ModuleAppFixture.THIRD_PARTY_VERSION } });

    const output = await InstalledTreeCheckTests.runAsync(app, environment);

    Assert.isTrue(output.includes(`${ModuleAppFixture.RUNTIME} ${InstalledTreeCheckTests.REACHES} ${ModuleAppFixture.ANGULAR_CORE} through `
      + `${ModuleAppFixture.RUNTIME} -> ${ModuleAppFixture.THIRD_PARTY} -> ${ModuleAppFixture.ANGULAR_CORE};`), output);
  }

  @TestMethod
  public async refusesAModuleWhoseRuntimePartReachesAngularThroughAPackageItDependsOn(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.editInstalledManifestAsync(ModuleAppFixture.PROTOCOL_PACKAGE, {
      dependencies: { [ModuleAppFixture.LOCKED_PACKAGE]: ModuleAppFixture.MODULE_VERSION, [ModuleAppFixture.ANGULAR_CORE]: ModuleAppFixture.ANGULAR_VERSION }
    });

    const output = await InstalledTreeCheckTests.runAsync(app, environment);

    Assert.isTrue(output.includes(`sample's package ${ModuleAppFixture.MODULE_PACKAGE} ${InstalledTreeCheckTests.REACHES} ${ModuleAppFixture.ANGULAR_CORE} outside its window part: `
      + `node_modules/${ModuleAppFixture.PROTOCOL_PACKAGE} lists it among its dependencies;`), output);
  }

  private static async runAsync(app: ModuleAppFixture, environment: NodeJS.ProcessEnv): Promise<string> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    await new BuildCommandLine(app.path, environment, process.platform, process.arch, output, new PassThrough()).runAsync(["build"]);
    return chunks.join(String.empty);
  }
}

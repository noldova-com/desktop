/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildIdentity } from "@noldova/desktop.protocol";
import { ProductInfo, RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeCopyFixture } from "../fixtures/runtime-copy.fixture.js";

@TestClass
export class RuntimeBuildTests {
  private static readonly IDENTITY_READER: string = [
    "const runtime = await import(process.argv[1]);",
    "let refusal = \"none\";",
    "try { runtime.RuntimeBuild.identity; } catch (error) { refusal = `${String(error instanceof runtime.ProductFileException)} ${error.message}`; }",
    "process.stdout.write(refusal);"
  ].join(" ");

  @TestMethod
  public identifiesTheBuildByTheCurrentProductAndTheSupportedProtocol(): void {
    const current = ProductInfo.current;

    const identity = RuntimeBuild.identity;

    Assert.areEqual(`${current.version} ${current.build}`, `${identity.productVersion} ${identity.fingerprint}`);
    Assert.areEqual(BuildIdentity.supportedProtocolVersion, identity.protocolVersion);
    Assert.areEqual(identity, RuntimeBuild.identity);
  }

  @TestMethod
  public async importsWithoutAProductFileAndRefusesTheIdentityWhenFirstAskedForIt(): Promise<void> {
    await using copy = await RuntimeCopyFixture.createAsync();

    const { stdout } = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", RuntimeBuildTests.IDENTITY_READER, copy.packageUrl], { encoding: "utf8" });

    Assert.isTrue(stdout.startsWith(`true The build's product file ${copy.productFile} is not valid: Error: ENOENT`), stdout);
  }
}

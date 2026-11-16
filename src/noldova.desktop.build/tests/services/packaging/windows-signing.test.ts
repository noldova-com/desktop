/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { WindowsSigning } from "../../../src/services/packaging/windows-signing.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";

class SigningRunner extends ProcessRunner {
  public files: readonly string[] = [];

  public override captureAsync(...call: Parameters<ProcessRunner["captureAsync"]>): Promise<ProcessResult> {
    this.files = (call[4]?.["NOLDOVA_DESKTOP_SIGNED_FILES"] ?? String.empty).split("\n");
    return Promise.resolve(new ProcessResult(0, this.files.map(t => `${t}\tValid\tyes\t*\r\n`).join(String.empty), String.empty));
  }
}

@TestClass
export class WindowsSigningTests {
  private static readonly PRODUCT: ProductIdentity = ProductIdentity.fromManifest(JsonReader.fromValue({
    desktop: {
      product: {
        name: "Sample App",
        publisher: "Sample",
        slug: "sample-app",
        applicationId: "com.example.sample",
        developmentApplicationId: "com.example.sample.development",
        dataFolder: ".sample/app",
        deviceFolders: { windows: "Sample/App", macos: "Sample/App", linux: "sample/app" },
        dataDirectoryVariable: "SAMPLE_APP_DATA_DIR",
        icons: "assets/icons",
        releaseRepository: "example/sample-app",
        windowsSigning: { endpoint: "https://sample.codesigning.example.com/", account: "sample-signing", profile: "SampleApp" }
      }
    }
  }));
  private static readonly CREDENTIALS: NodeJS.ProcessEnv = {
    AZURE_TENANT_ID: "test-value",
    AZURE_CLIENT_ID: "test-value",
    AZURE_CLIENT_SECRET: "test-value",
    WINDOWS_PUBLISHER: "CN=Sample, O=Sample"
  };

  @TestMethod
  public async checksEachProgramLibraryAndAddonWhateverTheCaseOfItsExtension(): Promise<void> {
    const output = await mkdtemp(path.join(tmpdir(), "windows-signing-"));
    try {
      const unpacked = path.join(output, "win-unpacked");
      const modules = path.join(unpacked, "resources", "app.asar.unpacked", "node_modules", "sample");
      const own = [path.join(unpacked, "HELPER.EXE"), path.join(unpacked, "Sample App.exe"), path.join(unpacked, "resources", "app.asar.unpacked", "native", "ADDON.NODE")];
      const libraries = [path.join(modules, "CONPTY.DLL"), path.join(modules, "Tool.Exe")];
      for (const file of [...own, ...libraries, path.join(unpacked, "LICENSE.TXT")]) {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, String.empty);
      }
      const runner = new SigningRunner();
      const signing = new WindowsSigning(runner, output, output, output, new PackageTarget("windows", "x64"), {}, WindowsSigningTests.CREDENTIALS, [],
        WindowsSigningTests.PRODUCT);

      await signing.verifyAsync([], WindowsSigningTests.PRODUCT);

      Assert.areEqual([...own, ...libraries].join("\n"), runner.files.join("\n"));
    }
    finally {
      await rm(output, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async checksThePackagesAndTheArmProgramInItsOwnUnpackedFolder(): Promise<void> {
    const output = await mkdtemp(path.join(tmpdir(), "windows-signing-"));
    try {
      const program = path.join(output, "win-arm64-unpacked", "Sample App.exe");
      const installer = path.join(output, "Sample App-1.2.3-windows-arm64.exe");
      await mkdir(path.dirname(program), { recursive: true });
      await writeFile(program, String.empty);
      const runner = new SigningRunner();
      const signing = new WindowsSigning(runner, output, output, output, new PackageTarget("windows", "arm64"), {}, WindowsSigningTests.CREDENTIALS, [],
        WindowsSigningTests.PRODUCT);

      await signing.verifyAsync([installer], WindowsSigningTests.PRODUCT);

      Assert.areEqual([installer, program].join("\n"), runner.files.join("\n"));
    }
    finally {
      await rm(output, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async refusesAnOutputWithoutTheUnpackedProgram(): Promise<void> {
    const output = await mkdtemp(path.join(tmpdir(), "windows-signing-"));
    try {
      const signing = new WindowsSigning(new SigningRunner(), output, output, output, new PackageTarget("windows", "x64"), {}, WindowsSigningTests.CREDENTIALS, [],
        WindowsSigningTests.PRODUCT);

      const error = await Assert.throwsAsync(() => signing.verifyAsync([], WindowsSigningTests.PRODUCT), BuildException);

      Assert.areEqual(`electron-builder finished without the unpacked program ${path.join(output, "win-unpacked", "Sample App.exe")}, whose signature the check reads.`,
        error.message);
    }
    finally {
      await rm(output, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async describesTheBuildersEnvironmentAndExpandsTheModuleWithNothingToFinishOrDispose(): Promise<void> {
    const output = await mkdtemp(path.join(tmpdir(), "windows-signing-"));
    try {
      const folder = path.join(output, "signing");
      const signing = new WindowsSigning(new SigningRunner(), output, folder, output, new PackageTarget("windows", "x64"), {}, WindowsSigningTests.CREDENTIALS, [],
        WindowsSigningTests.PRODUCT);

      await signing.prepareAsync();
      const finished = await signing.finishAsync();
      await signing.disposeAsync();

      Assert.areEqual(String.empty, finished);
      Assert.areEqual("CN=Sample, O=Sample", signing.windowsPublisher);
      Assert.areEqual(JSON.stringify({ AZURE_TENANT_ID: "test-value", AZURE_CLIENT_ID: "test-value", AZURE_CLIENT_SECRET: "test-value", NOLDOVA_DESKTOP_SIGNING_FOLDER: folder,
        NOLDOVA_DESKTOP_SIGNING_ENDPOINT: "https://sample.codesigning.example.com/", NOLDOVA_DESKTOP_SIGNING_ACCOUNT: "sample-signing", NOLDOVA_DESKTOP_SIGNING_PROFILE: "SampleApp" }),
      JSON.stringify(signing.builderEnvironment));
      Assert.isTrue(existsSync(folder));
    }
    finally {
      await rm(output, { recursive: true, force: true });
    }
  }
}

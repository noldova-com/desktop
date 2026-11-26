/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PinnedPackage } from "../../../src/models/packaging/pinned-package.js";
import { WindowsSigningAccount } from "../../../src/models/packaging/windows-signing-account.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { TrustedSigningModule } from "../../../src/services/packaging/trusted-signing-module.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { UnendingAnswerFixture } from "../../fixtures/unending-answer.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

class PowerShellRunner extends ProcessRunner {
  private readonly result: ProcessResult;

  public readonly calls: string[] = [];
  public readonly environments: NodeJS.ProcessEnv[] = [];
  public readonly listings: string[][] = [];

  public constructor(result: ProcessResult) {
    super();
    this.result = result;
  }

  public override async captureAsync(...call: Parameters<ProcessRunner["captureAsync"]>): Promise<ProcessResult> {
    const [command, commandArguments, directory, , environment] = call;
    this.calls.push(`${command} ${commandArguments.slice(0, -1).join(" ")} ${directory}`);
    this.environments.push(environment ?? {});
    this.listings.push(existsSync(directory) ? (await readdir(directory)).sort() : []);
    return this.result;
  }
}

@TestClass
export class TrustedSigningModuleTests {
  private static readonly ACCOUNT: WindowsSigningAccount = new WindowsSigningAccount("https://eus.codesigning.azure.net/", "sample-account", "sample-profile");
  private static readonly SUCCEEDED: ProcessResult = new ProcessResult(0, String.empty, String.empty);
  private static readonly FAILED: ProcessResult = new ProcessResult(1, String.empty, "Sign failed.");
  private static readonly CREDENTIALS: NodeJS.ProcessEnv = { AZURE_TENANT_ID: "tenant", AZURE_CLIENT_ID: "client", AZURE_CLIENT_SECRET: "secret" };

  @TestMethod
  public pinsTheModuleAndTheThreeNuGetTools(): void {
    const [module, ...tools] = TrustedSigningModule.PACKAGES;

    Assert.isTrue(module?.url.startsWith("https://www.powershellgallery.com/api/v2/package/") ?? false, module?.url);
    Assert.areEqual(3, tools.length);
    Assert.isTrue(tools.every(t => t.url.startsWith("https://api.nuget.org/v3-flatcontainer/") && t.url === t.url.toLowerCase()), tools.map(t => t.url).join(", "));
  }

  @TestMethod
  public readsTheModuleFolderAndAccountFromTheEnvironment(): void {
    const folder = path.resolve("signing");
    const runner = new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED);

    const module = TrustedSigningModule.fromEnvironment(runner, {
      NOLDOVA_DESKTOP_SIGNING_FOLDER: folder, NOLDOVA_DESKTOP_SIGNING_ENDPOINT: "https://eus.codesigning.azure.net/", NOLDOVA_DESKTOP_SIGNING_ACCOUNT: "sample-account",
      NOLDOVA_DESKTOP_SIGNING_PROFILE: "sample-profile"
    });

    Assert.areEqual(JSON.stringify({ ...TrustedSigningModuleTests.CREDENTIALS, NOLDOVA_DESKTOP_SIGNING_FOLDER: folder,
      NOLDOVA_DESKTOP_SIGNING_ENDPOINT: "https://eus.codesigning.azure.net/", NOLDOVA_DESKTOP_SIGNING_ACCOUNT: "sample-account", NOLDOVA_DESKTOP_SIGNING_PROFILE: "sample-profile" }),
    JSON.stringify(module.describeEnvironment({ ...TrustedSigningModuleTests.CREDENTIALS, OTHER: "other" })));
  }

  @TestMethod
  public refusesARelativeOrMissingModuleFolder(): void {
    const runner = new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED);

    const relative = Assert.throws(() => TrustedSigningModule.fromEnvironment(runner, { NOLDOVA_DESKTOP_SIGNING_FOLDER: "signing" }), BuildException);
    const missing = Assert.throws(() => TrustedSigningModule.fromEnvironment(runner, {}), BuildException);

    Assert.isTrue(relative.message.startsWith("NOLDOVA_DESKTOP_SIGNING_FOLDER must name the folder that holds the prepared "), relative.message);
    Assert.isTrue(relative.message.endsWith(" module, not \"signing\"."), relative.message);
    Assert.isTrue(missing.message.endsWith(" module, not \"\"."), missing.message);
  }

  @TestMethod
  public refusesAnEnvironmentWithoutTheSigningAccount(): void {
    const runner = new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED);

    const error = Assert.throws(() => TrustedSigningModule.fromEnvironment(runner, { NOLDOVA_DESKTOP_SIGNING_FOLDER: path.resolve("signing"),
      NOLDOVA_DESKTOP_SIGNING_ACCOUNT: "sample-account" }), BuildException);

    Assert.areEqual("Signing a Windows file needs NOLDOVA_DESKTOP_SIGNING_ENDPOINT, NOLDOVA_DESKTOP_SIGNING_PROFILE, which packaging sets from "
      + "desktop.product.windowsSigning.", error.message);
  }

  @TestMethod
  public refusesAnEnvironmentWithOnlyTheModuleFolderAndNamesTheWholeAccount(): void {
    const runner = new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED);

    const error = Assert.throws(() => TrustedSigningModule.fromEnvironment(runner, { NOLDOVA_DESKTOP_SIGNING_FOLDER: path.resolve("signing") }), BuildException);

    Assert.areEqual("Signing a Windows file needs NOLDOVA_DESKTOP_SIGNING_ENDPOINT, NOLDOVA_DESKTOP_SIGNING_ACCOUNT, NOLDOVA_DESKTOP_SIGNING_PROFILE, which packaging sets "
      + "from desktop.product.windowsSigning.", error.message);
  }

  @TestMethod
  public refusesCredentialsWithoutTheServicePrincipal(): void {
    const module = new TrustedSigningModule(new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED), path.resolve("signing"), TrustedSigningModuleTests.ACCOUNT, {});

    const error = Assert.throws(() => module.describeEnvironment({ AZURE_TENANT_ID: "tenant", AZURE_CLIENT_SECRET: String.empty }), BuildException);

    Assert.areEqual("Signing Windows packages needs AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, the Azure service principal for the Artifact Signing account.",
      error.message);
  }

  @TestMethod
  public async signsAProgramAndALibraryEachWithItsOwnScriptAndTheAccount(): Promise<void> {
    const runner = new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED);
    const folder = path.resolve("signing");
    const module = new TrustedSigningModule(runner, folder, TrustedSigningModuleTests.ACCOUNT, { Path: "C:\\Windows", localappdata: "C:\\Users\\sample\\AppData\\Local" });
    const program = path.resolve("out", "win-unpacked", "Sample App.exe");
    const library = path.resolve("out", "win-unpacked", "resources", "app.asar.unpacked", "node_modules", "node-pty", "conpty.dll");

    await module.signAsync(program);
    await module.signAsync(library);

    const [programCall, libraryCall] = runner.calls;
    const [environment] = runner.environments;
    Assert.areEqual(`pwsh -NoProfile -NonInteractive -EncodedCommand ${path.dirname(program)}`, programCall);
    Assert.areEqual(`pwsh -NoProfile -NonInteractive -EncodedCommand ${path.dirname(library)}`, libraryCall);
    Assert.areEqual(JSON.stringify({
      Path: "C:\\Windows", NOLDOVA_DESKTOP_SIGNING_FOLDER: folder, NOLDOVA_DESKTOP_SIGNING_ENDPOINT: "https://eus.codesigning.azure.net/", NOLDOVA_DESKTOP_SIGNING_ACCOUNT: "sample-account",
      NOLDOVA_DESKTOP_SIGNING_PROFILE: "sample-profile", NOLDOVA_DESKTOP_SIGNING_FILE: program, LOCALAPPDATA: path.join(folder, "tools")
    }), JSON.stringify(environment));
  }

  @TestMethod
  public async refusesAFileWhoseNameTheModuleWouldReadAsAList(): Promise<void> {
    const runner = new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED);
    const module = new TrustedSigningModule(runner, path.resolve("signing"), TrustedSigningModuleTests.ACCOUNT, {});

    const error = await Assert.throwsAsync(() => module.signAsync("one,two.exe"), BuildException);

    Assert.isTrue(error.message.endsWith(" takes a comma-separated list of files, so it cannot sign one,two.exe."), error.message);
    Assert.areEqual(0, runner.calls.length);
  }

  @TestMethod
  public async refusesASigningRunThatFails(): Promise<void> {
    const module = new TrustedSigningModule(new PowerShellRunner(TrustedSigningModuleTests.FAILED), path.resolve("signing"), TrustedSigningModuleTests.ACCOUNT, {});

    const error = await Assert.throwsAsync(() => module.signAsync("Sample.exe"), BuildException);

    Assert.isTrue(error.message.startsWith("pwsh failed signing Sample.exe with the "), error.message);
    Assert.isTrue(error.message.endsWith(" module with exit code 1:\nSign failed."), error.message);
  }

  @TestMethod
  public async expandsThePackagesItDownloadedAndRemovesTheirArchives(): Promise<void> {
    await using server = await TrustedSigningModuleTests.serveAsync(new Map([["/module", "module bytes"], ["/tool", "tool bytes"]]));
    await using folder = await TrustedSigningModuleTests.createFolderAsync();
    const runner = new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED);
    const module = new TrustedSigningModule(runner, path.join(folder.path, "signing"), TrustedSigningModuleTests.ACCOUNT, {});

    await module.prepareAsync([TrustedSigningModuleTests.pin(server.url, "/module", "module bytes", "TrustedSigning"),
      TrustedSigningModuleTests.pin(server.url, "/tool", "tool bytes", "tools/sign/1.0.0")]);

    const [environment] = runner.environments;
    Assert.areEqual(JSON.stringify(["1.0.0.zip", "TrustedSigning.zip"]), JSON.stringify(runner.listings[0]));
    Assert.areEqual([path.join(folder.path, "signing", "TrustedSigning.zip"), path.join(folder.path, "signing", "1.0.0.zip")].join("\n"),
      environment?.["NOLDOVA_DESKTOP_SIGNING_ARCHIVES"]);
    Assert.areEqual([path.join(folder.path, "signing", "TrustedSigning"), path.join(folder.path, "signing", "tools", "sign", "1.0.0")].join("\n"),
      environment?.["NOLDOVA_DESKTOP_SIGNING_DESTINATIONS"]);
    Assert.areEqual(0, (await readdir(path.join(folder.path, "signing"))).length);
  }

  @TestMethod
  public async removesTheArchivesWhenExpandingFails(): Promise<void> {
    await using server = await TrustedSigningModuleTests.serveAsync(new Map([["/module", "module bytes"]]));
    await using folder = await TrustedSigningModuleTests.createFolderAsync();
    const module = new TrustedSigningModule(new PowerShellRunner(TrustedSigningModuleTests.FAILED), path.join(folder.path, "signing"), TrustedSigningModuleTests.ACCOUNT, {});

    const error = await Assert.throwsAsync(() => module.prepareAsync([TrustedSigningModuleTests.pin(server.url, "/module", "module bytes", "TrustedSigning")]),
      BuildException);

    Assert.isTrue(error.message.startsWith("pwsh failed expanding and loading the "), error.message);
    Assert.areEqual(0, (await readdir(path.join(folder.path, "signing"))).length);
  }

  @TestMethod
  public async refusesAPackageWhoseHashIsNotTheRecordedOneBeforeChangingTheFolder(): Promise<void> {
    await using server = await TrustedSigningModuleTests.serveAsync(new Map([["/module", "changed bytes"]]));
    await using folder = await TrustedSigningModuleTests.createFolderAsync();
    const runner = new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED);
    const module = new TrustedSigningModule(runner, path.join(folder.path, "signing"), TrustedSigningModuleTests.ACCOUNT, {});
    const pinned = TrustedSigningModuleTests.pin(server.url, "/module", "module bytes", "TrustedSigning");

    const error = await Assert.throwsAsync(() => module.prepareAsync([pinned]), BuildException);

    Assert.areEqual(`The package from ${pinned.url} has the SHA-512 ${TrustedSigningModuleTests.hash("changed bytes")}, not the recorded ${pinned.sha512}, `
      + "so no signing package was expanded.", error.message);
    Assert.isFalse(existsSync(path.join(folder.path, "signing")));
    Assert.areEqual(0, runner.calls.length);
  }

  @TestMethod
  public async refusesAPackageTheServerDoesNotHave(): Promise<void> {
    await using server = await TrustedSigningModuleTests.serveAsync(new Map());
    const module = new TrustedSigningModule(new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED), path.resolve("signing"), TrustedSigningModuleTests.ACCOUNT, {});

    const error = await Assert.throwsAsync(() => module.prepareAsync([TrustedSigningModuleTests.pin(server.url, "/missing", String.empty, "TrustedSigning")]),
      BuildException);

    Assert.areEqual(`A signing package could not be downloaded from ${server.url}/missing: HTTP 404.`, error.message);
  }

  @TestMethod
  public async letsGoOfAFailedAnswerBeforeItRefusesThePackage(): Promise<void> {
    await using failing = await UnendingAnswerFixture.startAsync(500);
    const module = new TrustedSigningModule(new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED), path.resolve("signing"), TrustedSigningModuleTests.ACCOUNT, {});

    const error = await Assert.throwsAsync(() => module.prepareAsync([TrustedSigningModuleTests.pin(failing.url, "/module", String.empty, "TrustedSigning")]),
      BuildException);

    Assert.areEqual(`A signing package could not be downloaded from ${failing.url}/module: HTTP 500.`, error.message);
    Assert.isTrue(await WaitFixture.untilAsync(() => failing.isClosed, 10_000), "The failed answer's connection stayed open.");
  }

  @TestMethod
  public async refusesAPackageThatCannotBeDownloaded(): Promise<void> {
    const module = new TrustedSigningModule(new PowerShellRunner(TrustedSigningModuleTests.SUCCEEDED), path.resolve("signing"), TrustedSigningModuleTests.ACCOUNT, {});

    const error = await Assert.throwsAsync(() => module.prepareAsync([new PinnedPackage("http://127.0.0.1:9/module", String.empty, "TrustedSigning")]),
      BuildException);

    Assert.isTrue(error.message.startsWith("A signing package could not be downloaded from http://127.0.0.1:9/module: "), error.message);
    Assert.isDefined(error.cause);
  }

  private static pin(url: string, route: string, content: string, folder: string): PinnedPackage {
    return new PinnedPackage(`${url}${route}`, TrustedSigningModuleTests.hash(content), folder);
  }

  private static hash(content: string): string {
    return createHash("sha512").update(Buffer.from(content)).digest("base64");
  }

  private static async serveAsync(routes: ReadonlyMap<string, string>): Promise<{ url: string } & AsyncDisposable> {
    const server: Server = createServer((request, response) => {
      const body = routes.get(request.url ?? String.empty);
      response.statusCode = Object.isUndefined(body) ? 404 : 200;
      response.end(body ?? String.empty);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address: AddressInfo | string | null = server.address();
    const port = Object.isString(address) || Object.isNull(address) ? 0 : address.port;
    return {
      url: `http://127.0.0.1:${port}`,
      [Symbol.asyncDispose]: async () => {
        server.closeAllConnections();
        server.close();
        await once(server, "close");
      }
    };
  }

  private static async createFolderAsync(): Promise<{ path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "trusted-signing-"));
    return { path: folder, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true }) };
  }
}

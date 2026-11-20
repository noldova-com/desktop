/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { AcceptedLicenses } from "../../../src/models/packaging/accepted-licenses.js";
import { LockedPackage } from "../../../src/models/packaging/locked-package.js";
import { ThirdPartyPackage } from "../../../src/models/packaging/third-party-package.js";
import { TypeOnlyPeers } from "../../../src/models/packaging/type-only-peers.js";
import { Resources } from "../../../src/resources.js";
import { TarballFixture } from "../../fixtures/tarball.fixture.js";
import { UnendingAnswerFixture } from "../../fixtures/unending-answer.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class ThirdPartyPackageTests {
  private static readonly ID: string = "sample@1.0.0";
  private static readonly MANIFEST: string = JSON.stringify({ name: "sample", version: "1.0.0", license: "MIT" });
  private static readonly UNREACHABLE: string = "http://127.0.0.1:9/sample-1.0.0.tgz";
  private static readonly LIMIT: number = 200;

  @TestMethod
  public async preparesAKeptTarballWithItsLicenseFilesInOrder(): Promise<void> {
    const tarball = TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST, "LICENSE.md": "Second\n", "COPYING": "First\n", "index.js": "module.exports = 1;\n" });

    const prepared = await ThirdPartyPackageTests.prepareKeptAsync(tarball);

    Assert.areEqual("sample@1.0.0\nLicense: MIT\n\nFirst\n\nSecond\n", prepared.formatNotice());
    Assert.areEqual(0, prepared.skipped.length);
    Assert.areEqual("MIT", prepared.license.chosen);
  }

  @TestMethod
  public async downloadsATarballThatIsNotKeptOrNoLongerMatchesAndKeepsIt(): Promise<void> {
    const tarball = TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST, "LICENSE": "License\n" });
    await using server = await ThirdPartyPackageTests.serveAsync(200, tarball);
    await using folder = await ThirdPartyPackageTests.createFolderAsync();
    const locked = ThirdPartyPackageTests.lock(tarball, `${server.url}/sample-1.0.0.tgz`);
    await writeFile(path.join(folder.path, locked.fileName), "changed");

    const prepared = await ThirdPartyPackage.prepareAsync(locked, folder.path, [], new AcceptedLicenses(), new TypeOnlyPeers(), new PassThrough());

    Assert.areEqual(path.join(folder.path, "sample-1.0.0.tgz"), prepared.file);
    Assert.isTrue(locked.matches(await readFile(prepared.file)));
  }

  @TestMethod
  public async refusesATarballThatCannotBeDownloadedOrDoesNotMatch(): Promise<void> {
    const tarball = TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST, "LICENSE": "License\n" });
    await using missing = await ThirdPartyPackageTests.serveAsync(404, Buffer.alloc(0));
    await using changed = await ThirdPartyPackageTests.serveAsync(200, TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST }));
    await using folder = await ThirdPartyPackageTests.createFolderAsync();
    const output = new PassThrough();
    const prepare = (resolved: string): Promise<ThirdPartyPackage> => ThirdPartyPackage.prepareAsync(ThirdPartyPackageTests.lock(tarball, resolved), folder.path, [],
      new AcceptedLicenses(), new TypeOnlyPeers(), output);

    const status = await Assert.throwsAsync(() => prepare(`${missing.url}/sample-1.0.0.tgz`), BuildException);
    const integrity = await Assert.throwsAsync(() => prepare(`${changed.url}/sample-1.0.0.tgz`), BuildException);
    const failed = await Assert.throwsAsync(() => prepare(ThirdPartyPackageTests.UNREACHABLE), BuildException);

    Assert.areEqual(`sample@1.0.0 could not be downloaded from ${missing.url}/sample-1.0.0.tgz: HTTP 404.`, status.message);
    Assert.areEqual(`The tarball of sample@1.0.0 from ${changed.url}/sample-1.0.0.tgz does not match the SHA-512 integrity in package-lock.json, so it cannot ship.`,
      integrity.message);
    Assert.isTrue(failed.message.startsWith(`sample@1.0.0 could not be downloaded from ${ThirdPartyPackageTests.UNREACHABLE}: `), failed.message);
    Assert.areEqual(0, output.readableLength);
  }

  @TestMethod
  public async downloadsATarballOnceAServerErrorADroppedConnectionAndACutDownloadGiveWay(): Promise<void> {
    const tarball = TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST, "LICENSE": "License\n" });
    await using server = await ThirdPartyPackageTests.serveInTurnAsync([
      (_request, response) => ThirdPartyPackageTests.answer(response, 503, Buffer.alloc(0)),
      request => request.socket.destroy(),
      (_request, response) => {
        response.writeHead(200, { "content-length": String(tarball.length) });
        response.write(tarball.subarray(0, 1), () => response.destroy());
      },
      (_request, response) => ThirdPartyPackageTests.answer(response, 200, tarball)
    ]);
    await using folder = await ThirdPartyPackageTests.createFolderAsync();
    const locked = ThirdPartyPackageTests.lock(tarball, `${server.url}/sample-1.0.0.tgz`);
    const output = new PassThrough();

    const prepared = await ThirdPartyPackage.prepareAsync(locked, folder.path, [], new AcceptedLicenses(), new TypeOnlyPeers(), output, Resources.thirdPartyDownloadTimeout, 0);

    const subject = `sample@1.0.0 from ${server.url}/sample-1.0.0.tgz`;
    Assert.isTrue(locked.matches(await readFile(prepared.file)));
    Assert.areEqual(4, server.requests());
    Assert.areEqual([1, 2, 3].map(t => Resources.formatDownloadRetry(subject, t)).join(String.empty), output.read(output.readableLength)?.toString() ?? String.empty);
  }

  @TestMethod
  public async givesUpOnATarballWhoseServerIsStillBusyAtTheLastAttempt(): Promise<void> {
    const tarball = TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST, "LICENSE": "License\n" });
    await using server = await ThirdPartyPackageTests.serveInTurnAsync([]);
    await using folder = await ThirdPartyPackageTests.createFolderAsync();
    const locked = ThirdPartyPackageTests.lock(tarball, `${server.url}/sample-1.0.0.tgz`);

    const error = await Assert.throwsAsync(() => ThirdPartyPackage.prepareAsync(locked, folder.path, [], new AcceptedLicenses(), new TypeOnlyPeers(), new PassThrough(),
      Resources.thirdPartyDownloadTimeout, 0), BuildException);

    Assert.areEqual(`sample@1.0.0 from ${server.url}/sample-1.0.0.tgz could not be installed in 4 attempts; the last failed with HTTP 429.`, error.message);
    Assert.areEqual(Resources.downloadAttempts, server.requests());
  }

  @TestMethod
  public async givesUpOnATarballWhoseConnectionIsCutAtEveryAttemptWithTheCauseOfTheLast(): Promise<void> {
    const tarball = TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST, "LICENSE": "License\n" });
    const cut = (request: IncomingMessage): void => {
      request.socket.destroy();
    };
    await using server = await ThirdPartyPackageTests.serveInTurnAsync([cut, cut, cut, cut]);
    await using folder = await ThirdPartyPackageTests.createFolderAsync();
    const locked = ThirdPartyPackageTests.lock(tarball, `${server.url}/sample-1.0.0.tgz`);

    const error = await Assert.throwsAsync(() => ThirdPartyPackage.prepareAsync(locked, folder.path, [], new AcceptedLicenses(), new TypeOnlyPeers(), new PassThrough(),
      Resources.thirdPartyDownloadTimeout, 0), BuildException);

    Assert.isTrue(error.message.startsWith(`sample@1.0.0 from ${server.url}/sample-1.0.0.tgz could not be installed in 4 attempts; the last failed with TypeError: fetch failed (`),
      error.message);
    Assert.isTrue(/ \([A-Z_]+\)\.$/.test(error.message), error.message);
    Assert.areEqual(Resources.downloadAttempts, server.requests());
  }

  @TestMethod
  public async failsAtOnceWhenItsLimitRunsOutBeforeTheAnswerOrDuringItsBody(): Promise<void> {
    const tarball = TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST, "LICENSE": "License\n" });
    await using silent = await ThirdPartyPackageTests.serveInTurnAsync([() => undefined]);
    await using folder = await ThirdPartyPackageTests.createFolderAsync();
    const output = new PassThrough();
    let answered = 0;
    const stalled = (_input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
      answered++;
      const signal = init?.signal ?? null;
      const stream = new ReadableStream<Uint8Array>({
        start: controller => {
          if (!Object.isNull(signal))
            signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
        }
      });
      return Promise.resolve(new Response(stream, { status: 200 }));
    };
    const prepare = (resolved: string, download: typeof fetch = fetch): Promise<ThirdPartyPackage> =>
      ThirdPartyPackage.prepareAsync(ThirdPartyPackageTests.lock(tarball, resolved), folder.path, [], new AcceptedLicenses(), new TypeOnlyPeers(), output,
        ThirdPartyPackageTests.LIMIT, 0, download);

    const headers = await Assert.throwsAsync(() => prepare(`${silent.url}/sample-1.0.0.tgz`), BuildException);
    const body = await Assert.throwsAsync(() => prepare("https://registry.example.test/sample-1.0.0.tgz", stalled), BuildException);

    Assert.isTrue(headers.message.startsWith(`sample@1.0.0 could not be downloaded from ${silent.url}/sample-1.0.0.tgz: TimeoutError`), headers.message);
    Assert.isTrue(body.message.startsWith("sample@1.0.0 could not be downloaded from https://registry.example.test/sample-1.0.0.tgz: TimeoutError"), body.message);
    Assert.areEqual(1, silent.requests());
    Assert.areEqual(1, answered);
    Assert.areEqual(0, output.readableLength);
  }

  @TestMethod
  public async cancelsTheBodyOfAnAnswerItTriesAgain(): Promise<void> {
    const tarball = TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST, "LICENSE": "License\n" });
    const busy = Promise.withResolvers<void>();
    await using server = await ThirdPartyPackageTests.serveInTurnAsync([
      (_request, response) => {
        response.once("close", () => busy.resolve());
        response.writeHead(503, { "content-length": "1024" });
        response.write(Buffer.alloc(1));
      },
      (_request, response) => ThirdPartyPackageTests.answer(response, 200, tarball)
    ]);
    await using folder = await ThirdPartyPackageTests.createFolderAsync();
    const locked = ThirdPartyPackageTests.lock(tarball, `${server.url}/sample-1.0.0.tgz`);

    await ThirdPartyPackage.prepareAsync(locked, folder.path, [], new AcceptedLicenses(), new TypeOnlyPeers(), new PassThrough(), Resources.thirdPartyDownloadTimeout, 0);

    await busy.promise;
    Assert.areEqual(2, server.requests());
  }

  @TestMethod
  public async refusesATarballWithoutItsOwnReadableManifest(): Promise<void> {
    const none = await ThirdPartyPackageTests.messageAsync(TarballFixture.create({ "LICENSE": "License\n" }));
    const unreadable = await ThirdPartyPackageTests.messageAsync(TarballFixture.create({ "package.json": "[" }));
    const other = await ThirdPartyPackageTests.messageAsync(TarballFixture.create({ "package.json": JSON.stringify({ name: "other", version: "2.0.0" }) }));

    Assert.areEqual(`The tarball of sample@1.0.0 from ${ThirdPartyPackageTests.UNREACHABLE} has no package.json, so it cannot ship.`, none);
    Assert.areEqual("The package.json in the tarball of sample@1.0.0 could not be read as a JSON object, so it cannot ship.", unreadable);
    Assert.areEqual(`The tarball of sample@1.0.0 from ${ThirdPartyPackageTests.UNREACHABLE} holds other@2.0.0 instead, so it cannot ship.`, other);
  }

  @TestMethod
  public async refusesATypesOnlyPeerAScriptLoads(): Promise<void> {
    const tarball = TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST, "LICENSE": "License\n", "README.md": "require(\"types-only\")",
      "lib/index.cjs": "const schema = require(\"types-only/schema\");\n" });

    const message = await ThirdPartyPackageTests.messageAsync(tarball, new AcceptedLicenses(), new TypeOnlyPeers(new Map([[ThirdPartyPackageTests.ID, new Set(["types-only"])]])));

    Assert.areEqual("sample@1.0.0 loads types-only in lib/index.cjs, so it would fail at runtime without it, but the app names types-only as a types-only peer of sample@1.0.0.",
      message);
  }

  @TestMethod
  public async shipsOnlyTheFileAnAcceptedLicenseNames(): Promise<void> {
    const manifest = JSON.stringify({ name: "sample", version: "1.0.0", license: "SEE LICENSE IN TERMS.md" });
    const accepted = new AcceptedLicenses(new Map([[ThirdPartyPackageTests.ID, "SEE LICENSE IN TERMS.md"]]));
    const tarball = TarballFixture.create({ "package.json": manifest, "TERMS.md": "Terms\n", "LICENSE": "Other\n" });

    const prepared = await ThirdPartyPackageTests.prepareKeptAsync(tarball, accepted);

    Assert.areEqual("sample@1.0.0\nLicense: SEE LICENSE IN TERMS.md, accepted by the app\n\nTerms\n", prepared.formatNotice());
  }

  @TestMethod
  public async refusesAnAcceptedLicenseThatNamesAFileTheTarballLacks(): Promise<void> {
    const manifest = JSON.stringify({ name: "sample", version: "1.0.0", license: "SEE LICENSE IN TERMS.md" });
    const accepted = new AcceptedLicenses(new Map([[ThirdPartyPackageTests.ID, "SEE LICENSE IN TERMS.md"]]));

    const message = await ThirdPartyPackageTests.messageAsync(TarballFixture.create({ "package.json": manifest, "LICENSE": "Other\n" }), accepted);

    Assert.areEqual("sample@1.0.0 names its license in TERMS.md, which its tarball does not hold, so its license cannot ship.", message);
  }

  @TestMethod
  public async shipsAnAcceptedLicenseThatNamesNoFileWithItsLicenseFiles(): Promise<void> {
    const manifest = JSON.stringify({ name: "sample", version: "1.0.0", license: "Custom-1.0" });
    const accepted = new AcceptedLicenses(new Map([[ThirdPartyPackageTests.ID, "Custom-1.0"]]));

    const prepared = await ThirdPartyPackageTests.prepareKeptAsync(TarballFixture.create({ "package.json": manifest, "LICENSE": "Custom\n" }), accepted);

    Assert.areEqual("sample@1.0.0\nLicense: Custom-1.0, accepted by the app\n\nCustom\n", prepared.formatNotice());
  }

  @TestMethod
  public async takesTheFirstReviewedLicenseTextForATarballWithoutALicenseFile(): Promise<void> {
    await using folder = await ThirdPartyPackageTests.createFolderAsync();
    const own = path.join(folder.path, "own");
    const fallback = path.join(folder.path, "fallback");
    await mkdir(fallback, { recursive: true });
    await writeFile(path.join(fallback, "sample-1.0.0.txt"), "Reviewed\n");

    const prepared = await ThirdPartyPackageTests.prepareKeptAsync(TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST }), new AcceptedLicenses(),
      new TypeOnlyPeers(), [own, fallback]);

    Assert.areEqual("Reviewed", prepared.licenseText);
  }

  @TestMethod
  public async refusesATarballWithoutALicenseFileOrAReviewedText(): Promise<void> {
    const own = path.resolve("own");

    const message = await ThirdPartyPackageTests.messageAsync(TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST }), new AcceptedLicenses(),
      new TypeOnlyPeers(), [own]);

    Assert.areEqual(`sample@1.0.0 has no license file in its tarball, such as LICENSE, LICENCE or COPYING, and neither ${path.join(own, "sample-1.0.0.txt")} holds a reviewed `
      + "license text for it, so its license cannot ship.", message);
  }

  @TestMethod
  public async listsTheEntriesItSkipsByTheirPathInThePackage(): Promise<void> {
    const tarball = TarballFixture.createEntries([
      { name: "package/package.json", text: ThirdPartyPackageTests.MANIFEST }, { name: "package/LICENSE", text: "License\n" },
      { name: "package/bin/link", type: "2" }, { name: "outside", type: "1" }
    ]);

    const prepared = await ThirdPartyPackageTests.prepareKeptAsync(tarball);

    Assert.areEqual("bin/link as a symbolic link|outside as a hard link", prepared.skipped.join("|"));
  }

  @TestMethod
  public async letsGoOfAFailedDownloadsAnswerBeforeItRefusesTheTarball(): Promise<void> {
    const tarball = TarballFixture.create({ "package.json": ThirdPartyPackageTests.MANIFEST, "LICENSE": "License\n" });
    await using failing = await UnendingAnswerFixture.startAsync(404);
    await using folder = await ThirdPartyPackageTests.createFolderAsync();
    const resolved = `${failing.url}/sample-1.0.0.tgz`;

    const error = await Assert.throwsAsync(() => ThirdPartyPackage.prepareAsync(ThirdPartyPackageTests.lock(tarball, resolved), folder.path, [], new AcceptedLicenses(),
      new TypeOnlyPeers(), new PassThrough()), BuildException);

    Assert.areEqual(`sample@1.0.0 could not be downloaded from ${resolved}: HTTP 404.`, error.message);
    Assert.isTrue(await WaitFixture.untilAsync(() => failing.isClosed, 10_000), "The failed answer's connection stayed open.");
  }

  private static lock(tarball: Buffer, resolved: string = ThirdPartyPackageTests.UNREACHABLE): LockedPackage {
    return new LockedPackage("node_modules/sample", { version: "1.0.0", resolved, integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}` });
  }

  private static async prepareKeptAsync(tarball: Buffer, accepted: AcceptedLicenses = new AcceptedLicenses(), typeOnly: TypeOnlyPeers = new TypeOnlyPeers(),
    reviewed: readonly string[] = []): Promise<ThirdPartyPackage> {
    await using folder = await ThirdPartyPackageTests.createFolderAsync();
    const locked = ThirdPartyPackageTests.lock(tarball);
    await writeFile(path.join(folder.path, locked.fileName), tarball);
    return await ThirdPartyPackage.prepareAsync(locked, folder.path, reviewed, accepted, typeOnly, new PassThrough());
  }

  private static async messageAsync(tarball: Buffer, accepted: AcceptedLicenses = new AcceptedLicenses(), typeOnly: TypeOnlyPeers = new TypeOnlyPeers(),
    reviewed: readonly string[] = []): Promise<string> {
    const error = await Assert.throwsAsync(() => ThirdPartyPackageTests.prepareKeptAsync(tarball, accepted, typeOnly, reviewed), BuildException);
    return error.message;
  }

  private static async serveAsync(status: number, body: Buffer): Promise<{ url: string } & AsyncDisposable> {
    const server = createServer((_request, response) => {
      response.statusCode = status;
      response.end(body);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    const port = Object.isNull(address) || Object.isString(address) ? 0 : address.port;
    return {
      url: `http://127.0.0.1:${port}`,
      [Symbol.asyncDispose]: async () => {
        server.closeAllConnections();
        server.close();
        await once(server, "close");
      }
    };
  }

  private static async serveInTurnAsync(answers: readonly ((request: IncomingMessage, response: ServerResponse) => void)[]):
    Promise<{ url: string; requests: () => number } & AsyncDisposable> {
    let requests = 0;
    const server = createServer((request, response) => {
      const answer = answers[requests] ?? ((_request: IncomingMessage, busy: ServerResponse): void => ThirdPartyPackageTests.answer(busy, 429, Buffer.alloc(0)));
      requests++;
      answer(request, response);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    const port = Object.isNull(address) || Object.isString(address) ? 0 : address.port;
    return {
      url: `http://127.0.0.1:${port}`,
      requests: () => requests,
      [Symbol.asyncDispose]: async () => {
        server.closeAllConnections();
        server.close();
        await once(server, "close");
      }
    };
  }

  private static answer(response: ServerResponse, status: number, body: Buffer): void {
    response.statusCode = status;
    response.end(body);
  }

  private static async createFolderAsync(): Promise<{ path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "third-party-package-"));
    return { path: folder, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true }) };
  }
}

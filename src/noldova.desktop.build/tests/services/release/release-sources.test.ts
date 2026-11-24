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
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { SourceArchive } from "../../../src/models/packaging/source-archive.js";
import { ReleaseSources } from "../../../src/services/release/release-sources.js";

@TestClass
export class ReleaseSourcesTests {
  private static readonly CONTENT: Buffer = Buffer.from("sample source\n".repeat(5000));

  @TestMethod
  public async downloadsEachArchiveIntoTheReleaseFolderAndGivesItsDigestAsync(): Promise<void> {
    await using fixture = await ReleaseSourcesTests.createAsync();
    const archive = fixture.archive("sample-source.tar");

    const files = await new ReleaseSources(fixture.folder, ["Sample App-1.0.0-linux-x64.AppImage"]).downloadAsync([archive]);

    Assert.areEqual("sample-source.tar", files.map(t => t.name).join());
    Assert.areEqual(archive.sha256, files[0]?.digest.sha256);
    Assert.isTrue(ReleaseSourcesTests.CONTENT.equals(await readFile(path.join(fixture.folder, "sample-source.tar"))));
  }

  @TestMethod
  public async refusesAnArchiveWhoseSizeOrSha256IsNotTheOneItsPackageNamesAsync(): Promise<void> {
    await using fixture = await ReleaseSourcesTests.createAsync();
    const archive = fixture.archive("sample-source.tar");
    const named = new SourceArchive(archive.url, archive.size + 1, "f".repeat(64));

    const error = await Assert.throwsAsync(() => new ReleaseSources(fixture.folder, []).downloadAsync([named]), BuildException);

    Assert.areEqual(`The source archive ${archive.url} has ${String(archive.size)} bytes and the SHA-256 ${archive.sha256}, not the ${String(named.size)} bytes and `
      + `${named.sha256} its package names.`, error.message);
  }

  @TestMethod
  public async refusesAnArchiveTheServerDoesNotGiveAsync(): Promise<void> {
    await using fixture = await ReleaseSourcesTests.createAsync();
    const archive = fixture.archive("missing-source.tar");

    const error = await Assert.throwsAsync(() => new ReleaseSources(fixture.folder, []).downloadAsync([archive]), BuildException);

    Assert.areEqual(`The source archive ${archive.url} could not be downloaded: HTTP 404.`, error.message);
    Assert.isFalse(existsSync(path.join(fixture.folder, "missing-source.tar")));
  }

  @TestMethod
  public async refusesAnArchiveItCannotReachWithItsCauseAsync(): Promise<void> {
    await using fixture = await ReleaseSourcesTests.createAsync();
    const archive = new SourceArchive("http://127.0.0.1:9/sample-source.tar", 10, "f".repeat(64));

    const error = await Assert.throwsAsync(() => new ReleaseSources(fixture.folder, []).downloadAsync([archive]), BuildException);

    Assert.isTrue(error.message.startsWith(`The source archive ${archive.url} could not be downloaded: TypeError`), error.message);
  }

  @TestMethod
  public async refusesAnArchiveNamedLikeAReleaseFileOrAnotherArchiveBeforeDownloadingAsync(): Promise<void> {
    await using fixture = await ReleaseSourcesTests.createAsync();
    const archive = fixture.archive("sample-source.tar");
    const other = new SourceArchive(archive.url.replace("/files/", "/other/"), archive.size, archive.sha256);

    const taken = await Assert.throwsAsync(() => new ReleaseSources(fixture.folder, ["sample-source.tar"]).downloadAsync([archive]), BuildException);
    const twice = await Assert.throwsAsync(() => new ReleaseSources(fixture.folder, []).downloadAsync([archive, other]), BuildException);

    Assert.areEqual("The source archive sample-source.tar has the name of a release file or of another source archive.", taken.message);
    Assert.areEqual(taken.message, twice.message);
    Assert.areEqual(0, fixture.requests.length);
  }

  private static async createAsync(): Promise<{ readonly folder: string; readonly requests: readonly string[]; archive(name: string): SourceArchive } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "release-sources-"));
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(request.url ?? String.empty);
      if (request.url === "/files/sample-source.tar")
        response.end(ReleaseSourcesTests.CONTENT);
      else {
        response.statusCode = 404;
        response.end();
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    const port = Object.isNull(address) || Object.isString(address) ? 0 : address.port;
    const sha256 = createHash("sha256").update(ReleaseSourcesTests.CONTENT).digest("hex");
    return {
      folder,
      requests,
      archive: (name: string): SourceArchive => new SourceArchive(`http://127.0.0.1:${String(port)}/files/${name}`, ReleaseSourcesTests.CONTENT.length, sha256),
      [Symbol.asyncDispose]: async (): Promise<void> => {
        server.closeAllConnections();
        server.close();
        await once(server, "close");
        await rm(folder, { recursive: true, force: true });
      }
    };
  }
}

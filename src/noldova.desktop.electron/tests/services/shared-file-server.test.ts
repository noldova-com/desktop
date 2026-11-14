/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { appendFile, lstat, mkdtemp, rename, rm, symlink, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode, FileGrant, Response as RuntimeAnswer } from "@noldova/desktop.protocol";
import { SharedFileServer } from "@noldova/desktop.electron";
import { FileIdentity } from "@noldova/desktop.runtime";

import { FailingFileCallFixture } from "../fixtures/failing-file-call.fixture.js";
import { FakeWindowSession } from "../fixtures/fake-window-session.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";

interface IServing {
  readonly folder: string;
  readonly file: string;
  readonly logs: string[];
  readonly asked: string[];
  shareAsync(mediaType?: string): Promise<FileGrant>;
  serveAsync(request?: Request): Promise<Response>;
  answer: RuntimeAnswer | null;
  isLive: boolean;
}

@TestClass
export class SharedFileServerTests {
  private static readonly GRANT: string = "8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21";
  private static readonly ADDRESS: string = `desktop-file://${SharedFileServerTests.GRANT}/`;
  private static readonly BYTES: Uint8Array = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

  @TestMethod
  public registersOnlyAStandardSecureSchemeAndServesItOnceOnASession(): void {
    const session = new FakeWindowSession();
    const server = new SharedFileServer(() => Promise.reject(new Error("Not asked.")), () => true, () => undefined);

    server.serveOn(session);
    server.serveOn(session);

    Assert.areEqual("{\"scheme\":\"desktop-file\",\"privileges\":{\"standard\":true,\"secure\":true}}", JSON.stringify(SharedFileServer.scheme));
    Assert.areEqual("desktop-file", session.protocol.handled.join(","));
  }

  @TestMethod
  public servesASharedImageWithItsTypeAsOftenAsThePageLoadsIt(): Promise<void> {
    return SharedFileServerTests.runAsync(async t => {
      await t.shareAsync("image/png");

      const answers = [await t.serveAsync(), await t.serveAsync()];
      const bodies = await Promise.all(answers.map(async u => [...new Uint8Array(await u.arrayBuffer())].join(",")));

      Assert.areEqual("200,200", answers.map(u => u.status).join(","));
      Assert.areEqual([...SharedFileServerTests.BYTES].join(","), [...new Set(bodies)].join("|"));
      Assert.areEqual("image/png|11|nosniff|no-store|default-src 'none'; sandbox", SharedFileServerTests.headers(answers[0]));
      Assert.areEqual(`${SharedFileServerTests.GRANT},${SharedFileServerTests.GRANT}`, t.asked.join(","));
      Assert.areEqual(0, t.logs.length);
    });
  }

  @TestMethod
  public endsTheFilesStreamWhenThePageStopsReadingIt(): Promise<void> {
    return SharedFileServerTests.runAsync(async t => {
      await t.shareAsync("image/png");
      const answer = await t.serveAsync();
      const body = answer.body;
      Assert.isNotNull(body);

      await body.cancel();

      Assert.areEqual("200|0", `${answer.status}|${t.logs.length}`);
      await Assert.throwsAsync(() => answer.arrayBuffer(), TypeError);
    });
  }

  @TestMethod
  @TestData("image/svg+xml")
  @TestData("text/html")
  @TestData("application/xhtml+xml")
  @TestData("image/png; charset=utf-8")
  @TestData("application/octet-stream")
  public servesAnyFileOffTheImageAllowListAsBytes(mediaType: string): Promise<void> {
    return SharedFileServerTests.runAsync(async t => {
      await t.shareAsync(mediaType);

      const answer = await t.serveAsync();
      const bytes = (await answer.arrayBuffer()).byteLength;

      Assert.areEqual("200|11", `${answer.status}|${bytes}`);
      Assert.areEqual("application/octet-stream|11|nosniff|no-store|default-src 'none'; sandbox", SharedFileServerTests.headers(answer));
    });
  }

  @TestMethod
  @TestData("POST", "desktop-file://8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21/")
  @TestData("GET", "desktop-file://8C1F0A3E9B2D4C6F8E0A1B3C5D7E9F21/")
  @TestData("GET", "desktop-file://8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f2/")
  @TestData("GET", "desktop-file://8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21/photo.png")
  @TestData("GET", "desktop-file://8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21/?path=/etc/hosts")
  @TestData("GET", "desktop-file://8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21:1/")
  @TestData("GET", "desktop-file:///etc/hosts")
  @TestData("GET", "file:///8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21/")
  public refusesARequestThatIsNotAGetOfAShareExactAddressBeforeAskingTheRuntime(method: string, address: string): Promise<void> {
    return SharedFileServerTests.runAsync(async t => {
      await t.shareAsync("image/png");

      const answer = await t.serveAsync(new Request(address, { method }));

      await SharedFileServerTests.expectRefusedAsync(t, answer, "not a GET of a share's address");
      Assert.areEqual(0, t.asked.length);
    });
  }

  @TestMethod
  public refusesAGrantTheRuntimeRefusesAndAShareWhosePageEnded(): Promise<void> {
    return SharedFileServerTests.runAsync(async t => {
      await t.shareAsync("image/png");
      t.isLive = false;
      const ended = await t.serveAsync();
      t.answer = RuntimeAnswer.failure("r", new Failure(FailureCode.NotFound, "The shared file is unknown or has ended."));
      const unknown = await t.serveAsync();

      await SharedFileServerTests.expectRefusedAsync(t, ended, "its page ended", 2);
      await SharedFileServerTests.expectRefusedAsync(t, unknown, "NotFound", 2);
    });
  }

  @TestMethod
  public refusesAFileChangedOrGoneSinceItWasShared(): Promise<void> {
    return SharedFileServerTests.runAsync(async t => {
      await t.shareAsync("image/png");
      await appendFile(t.file, "more");
      const changed = await t.serveAsync();
      await unlink(t.file);
      const gone = await t.serveAsync();

      await SharedFileServerTests.expectRefusedAsync(t, changed, "the file changed or was replaced", 2);
      await SharedFileServerTests.expectRefusedAsync(t, gone, "ENOENT", 2);
    });
  }

  @TestMethod
  public refusesAFileThatFailsToOpenWithoutACodeByItsFailure(): Promise<void> {
    return SharedFileServerTests.runAsync(async t => {
      await t.shareAsync("image/png");
      using _open = new FailingFileCallFixture("open", t.file, null);

      const answer = await t.serveAsync();

      await SharedFileServerTests.expectRefusedAsync(t, answer, String(new Error("open failed without a code")));
    });
  }

  @TestMethod
  public refusesAFileReplacedByAnotherWithTheSameBytes(): Promise<void> {
    return SharedFileServerTests.runAsync(async t => {
      const shared = await t.shareAsync("image/png");
      const other = path.join(t.folder, "other.png");
      await writeFile(other, SharedFileServerTests.BYTES);
      const stats = await lstat(t.file);
      await utimes(other, stats.atime, stats.mtime);
      await rename(other, t.file);
      const swapped = FileIdentity.of(await lstat(t.file, { bigint: true }));

      const answer = await t.serveAsync();

      Assert.areNotEqual(shared.identity, swapped);
      await SharedFileServerTests.expectRefusedAsync(t, answer, "the file changed or was replaced");
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public neitherFollowsALinkNorWaitsOnAFifoSwappedInForTheFile(): Promise<void> {
    return SharedFileServerTests.runAsync(async t => {
      await t.shareAsync("image/png");
      const kept = path.join(t.folder, "kept.png");
      await rename(t.file, kept);
      await symlink(kept, t.file);
      const linked = await t.serveAsync();
      await unlink(t.file);
      execFileSync("mkfifo", [t.file]);
      const fifo = await t.serveAsync();

      await SharedFileServerTests.expectRefusedAsync(t, linked, "ELOOP", 2);
      await SharedFileServerTests.expectRefusedAsync(t, fifo, "the file changed or was replaced", 2);
    });
  }

  private static async runAsync(test: (serving: IServing) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-shared-files-"));
    try {
      const file = path.join(folder, "photo.png");
      await writeFile(file, SharedFileServerTests.BYTES);
      const serving: IServing = {
        folder,
        file,
        logs: [],
        asked: [],
        answer: null,
        isLive: true,
        shareAsync: async mediaType => {
          const stats = await lstat(file, { bigint: true });
          const share = new FileGrant(SharedFileServerTests.GRANT, file, "photo.png", mediaType ?? "image/png", Number(stats.size), FileIdentity.of(stats), "notes", 3, 2,
            600_000, false);
          serving.answer = RuntimeAnswer.success("r", share.toJson());
          return share;
        },
        serveAsync: request => server.serveAsync(request ?? new Request(SharedFileServerTests.ADDRESS))
      };
      const server = new SharedFileServer(grant => {
        serving.asked.push(grant);
        return Promise.resolve(serving.answer ?? RuntimeAnswer.failure("r", new Failure(FailureCode.NotFound, "Not shared.")));
      }, (window, page) => serving.isLive && window === 3 && page === 2, line => serving.logs.push(line));
      await test(serving);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static headers(answer: Response | undefined): string {
    return ["Content-Type", "Content-Length", "X-Content-Type-Options", "Cache-Control", "Content-Security-Policy"].map(t => answer?.headers.get(t)).join("|");
  }

  private static async expectRefusedAsync(serving: IServing, answer: Response, reason: string, refusals: number = 1): Promise<void> {
    Assert.areEqual("404|0|||nosniff|no-store|default-src 'none'; sandbox", `${answer.status}|${(await answer.arrayBuffer()).byteLength}|${SharedFileServerTests.headers(answer)}`);
    Assert.areEqual(refusals, serving.logs.length);
    Assert.isTrue(serving.logs.includes(`A shared file was not served: ${reason}.`), serving.logs.join("\n"));
    Assert.isFalse(serving.logs.some(t => t.includes(SharedFileServerTests.GRANT) || t.includes(serving.folder)), serving.logs.join("\n"));
  }
}

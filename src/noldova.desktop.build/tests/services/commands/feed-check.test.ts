/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FeedCheck } from "../../../src/services/commands/feed-check.js";

type Route = (request: IncomingMessage, response: ServerResponse) => void;

@TestClass
export class FeedCheckTests {
  private static readonly LINUX: Buffer = Buffer.from("the Linux package");
  private static readonly WINDOWS: Buffer = Buffer.from("the Windows installer");

  @TestMethod
  public async checksTheVersionAndEachFilesSha512AndSizeForEveryTargetAsync(): Promise<void> {
    await FeedCheckTests.withFeedAsync(FeedCheckTests.release("1.2.3"), async (feed, requests) => {
      const result = await FeedCheckTests.runAsync(FeedCheckTests.check(feed));

      Assert.areEqual(0, result.exitCode, result.output);
      Assert.areEqual(
        "linux-x64: latest-linux-x64.yml names 1.2.3, and App-1.2.3.AppImage match its SHA-512 and size.\n"
          + "windows-x64: latest-windows-x64.yml names 1.2.3, and App Setup 1.2.3.exe, App's notes.txt match its SHA-512 and size.\n"
          + `The update feed ${feed} serves 1.2.3 for linux-x64, windows-x64.\n`,
        result.output);
      Assert.areEqual("/latest-linux-x64.yml,/App-1.2.3.AppImage,/latest-windows-x64.yml,/App%20Setup%201.2.3.exe,/App's%20notes.txt", requests.join());
    });
  }

  @TestMethod
  public async waitsTheDefaultTimeWhenTheReleaseGivesNoneAsync(): Promise<void> {
    await FeedCheckTests.withFeedAsync(FeedCheckTests.release("1.2.3"), async feed => {
      const result = await FeedCheckTests.runAsync({ ...FeedCheckTests.check(feed), FEED_WAIT_SECONDS: String.empty });

      Assert.areEqual(0, result.exitCode, result.output);
      Assert.areEqual(0, result.pauses.length);
    });
  }

  @TestMethod
  public async refusesAFeedThatNamesAnotherVersionAsync(): Promise<void> {
    await FeedCheckTests.withFeedAsync(FeedCheckTests.release("1.2.2"), async feed => {
      const result = await FeedCheckTests.runAsync(FeedCheckTests.check(feed));

      Assert.areEqual(1, result.exitCode);
      Assert.areEqual(`latest-linux-x64.yml in ${feed} names the version "1.2.2", not 1.2.3.\n`, result.output);
    });
  }

  @TestMethod
  public async refusesUpdateInformationThatNamesNoVersionAsync(): Promise<void> {
    const routes = FeedCheckTests.release("1.2.3");
    routes.set("/latest-linux-x64.yml", FeedCheckTests.file(Buffer.from("files:\n")));
    await FeedCheckTests.withFeedAsync(routes, async feed => {
      const result = await FeedCheckTests.runAsync(FeedCheckTests.check(feed));

      Assert.areEqual(1, result.exitCode);
      Assert.areEqual(`latest-linux-x64.yml in ${feed} names the version "", not 1.2.3.\n`, result.output);
    });
  }

  @TestMethod
  public async refusesAFeedWithoutATargetsUpdateInformationAsync(): Promise<void> {
    const routes = FeedCheckTests.release("1.2.3");
    routes.delete("/latest-windows-x64.yml");
    await FeedCheckTests.withFeedAsync(routes, async feed => {
      const result = await FeedCheckTests.runAsync(FeedCheckTests.check(feed));

      Assert.areEqual(1, result.exitCode);
      Assert.isTrue(result.output.endsWith(`latest-windows-x64.yml could not be read from ${feed}: HTTP 404.\n`), result.output);
    });
  }

  @TestMethod
  public async refusesAFeedThatAnswersWithAnotherFailureOrARedirectWithoutALocationAsync(): Promise<void> {
    for (const status of [500, 302]) {
      const routes = FeedCheckTests.release("1.2.3");
      routes.set("/latest-linux-x64.yml", (_request, response) => response.writeHead(status).end());
      await FeedCheckTests.withFeedAsync(routes, async (feed, requests) => {
        const result = await FeedCheckTests.runAsync({ ...FeedCheckTests.check(feed), FEED_WAIT_SECONDS: "60" });

        Assert.areEqual(1, result.exitCode);
        Assert.areEqual(`latest-linux-x64.yml could not be read from ${feed}: HTTP ${status}.\n`, result.output);
        Assert.areEqual(1, requests.length);
      });
    }
  }

  @TestMethod
  public async refusesAPackageThatIsNotThereAsync(): Promise<void> {
    const routes = FeedCheckTests.release("1.2.3");
    routes.delete("/App-1.2.3.AppImage");
    await FeedCheckTests.withFeedAsync(routes, async feed => {
      const result = await FeedCheckTests.runAsync(FeedCheckTests.check(feed));

      Assert.areEqual(1, result.exitCode);
      Assert.areEqual(`App-1.2.3.AppImage could not be read from ${feed}: HTTP 404.\n`, result.output);
    });
  }

  @TestMethod
  public async refusesAPackageWhoseDownloadBreaksOffAsync(): Promise<void> {
    const routes = FeedCheckTests.release("1.2.3");
    routes.set("/App-1.2.3.AppImage", (_request, response) => {
      response.writeHead(200, { "content-length": "100" });
      response.write("partial", () => response.destroy());
    });
    await FeedCheckTests.withFeedAsync(routes, async feed => {
      const result = await FeedCheckTests.runAsync(FeedCheckTests.check(feed));

      Assert.areEqual(1, result.exitCode);
      Assert.isTrue(result.output.startsWith(`App-1.2.3.AppImage could not be read from ${feed}: `), result.output);
    });
  }

  @TestMethod
  public async refusesAPackageWhoseSha512OrSizeDiffersFromTheUpdateInformationAsync(): Promise<void> {
    const other = FeedCheckTests.release("1.2.3");
    other.set("/App-1.2.3.AppImage", FeedCheckTests.file(Buffer.from("another Linux package")));
    const sized = FeedCheckTests.release("1.2.3");
    sized.set("/latest-linux-x64.yml", FeedCheckTests.file(FeedCheckTests.metadata("1.2.3", [["'App-1.2.3.AppImage'", FeedCheckTests.LINUX, 5]])));

    const changed = await FeedCheckTests.withFeedAsync(other, async feed => ({ feed, result: await FeedCheckTests.runAsync({ ...FeedCheckTests.check(feed), FEED_WAIT_SECONDS: "60" }) }));
    const resized = await FeedCheckTests.withFeedAsync(sized, async feed => ({ feed, result: await FeedCheckTests.runAsync(FeedCheckTests.check(feed)) }));

    Assert.areEqual("1,1", [changed.result.exitCode, resized.result.exitCode].join());
    Assert.areEqual(0, changed.result.pauses.length);
    Assert.areEqual(
      `App-1.2.3.AppImage in ${changed.feed} has the SHA-512 ${FeedCheckTests.sha512(Buffer.from("another Linux package"))}, but latest-linux-x64.yml gives ${FeedCheckTests.sha512(FeedCheckTests.LINUX)}.\n`,
      changed.result.output);
    Assert.areEqual(`App-1.2.3.AppImage in ${resized.feed} has 17 bytes, but latest-linux-x64.yml gives 5.\n`, resized.result.output);
  }

  @TestMethod
  public async refusesUpdateInformationThatListsNoFilesAsync(): Promise<void> {
    const routes = FeedCheckTests.release("1.2.3");
    routes.set("/latest-linux-x64.yml", FeedCheckTests.file(Buffer.from("version: 1.2.3\nfiles:\npath: 'App-1.2.3.AppImage'\n")));
    await FeedCheckTests.withFeedAsync(routes, async feed => {
      const result = await FeedCheckTests.runAsync(FeedCheckTests.check(feed));

      Assert.areEqual(1, result.exitCode);
      Assert.areEqual(`latest-linux-x64.yml in ${feed} lists no files.\n`, result.output);
    });
  }

  @TestMethod
  public async refusesAFeedThatLeadsToASignInPageAsync(): Promise<void> {
    const routes = FeedCheckTests.release("1.2.3");
    routes.set("/latest-linux-x64.yml", (_request, response) => response.writeHead(302, { location: "/login?return_to=secret" }).end());
    routes.set("/login", (_request, response) => response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end("<form>Sign in</form>"));
    await FeedCheckTests.withFeedAsync(routes, async feed => {
      const result = await FeedCheckTests.runAsync(FeedCheckTests.check(feed));

      Assert.areEqual(1, result.exitCode);
      Assert.areEqual(
        `latest-linux-x64.yml could not be read from ${feed}: it led to a web page, such as a sign-in page, at ${new URL("/login", feed).href}, so the feed is not anonymous.\n`,
        result.output);
    });
  }

  @TestMethod
  public async refusesAFeedThatCannotBeReachedWithoutTryingAgainAsync(): Promise<void> {
    await FeedCheckTests.withRefusingServerAsync(async feed => {
      const result = await FeedCheckTests.runAsync({ ...FeedCheckTests.check(feed), FEED_WAIT_SECONDS: "60" });

      Assert.areEqual(1, result.exitCode);
      Assert.isTrue(result.output.startsWith(`latest-linux-x64.yml could not be read from ${feed}: TypeError: fetch failed`), result.output);
      Assert.areEqual(0, result.pauses.length);
    });
  }

  @TestMethod
  public async refusesARedirectAwayFromTheFeedOrOneThatNeverEndsAsync(): Promise<void> {
    await FeedCheckTests.withFeedAsync(FeedCheckTests.release("1.2.3"), async other => {
      const away = FeedCheckTests.release("1.2.3");
      away.set("/latest-linux-x64.yml", (_request, response) => response.writeHead(302, { location: `${other}latest-linux-x64.yml?token=secret` }).end());
      const looping = FeedCheckTests.release("1.2.3");
      looping.set("/latest-linux-x64.yml", (_request, response) => response.writeHead(307, { location: "/latest-linux-x64.yml" }).end());

      const outcomes = [];
      for (const routes of [away, looping])
        outcomes.push(await FeedCheckTests.withFeedAsync(routes, async feed => ({ feed, result: await FeedCheckTests.runAsync(FeedCheckTests.check(feed)) })));

      Assert.areEqual(JSON.stringify([
        `latest-linux-x64.yml could not be read from ${outcomes[0]?.feed}: it redirected to ${new URL(other).origin}, which is neither the feed's origin nor GitHub's release asset host.\n`,
        `latest-linux-x64.yml could not be read from ${outcomes[1]?.feed}: it redirected more than 5 times.\n`
      ]), JSON.stringify(outcomes.map(t => t.result.output)));
    });
  }

  @TestMethod
  public async refusesAFeedUrlThatCouldHoldASecretWithoutShowingItAsync(): Promise<void> {
    const urls = ["https://person:secret@updates.example.test/app/", "https://secret@updates.example.test/app/", "https://updates.example.test/app/?token=secret", "https://updates.example.test/app/#secret"];

    for (const url of urls) {
      const result = await FeedCheckTests.runAsync(FeedCheckTests.check(url));

      Assert.areEqual(1, result.exitCode, url);
      Assert.areEqual("FEED_URL must not carry user info, a query or a fragment, which could hold a secret, so it is not shown here.\n", result.output);
    }
  }

  @TestMethod
  public async refusesAFilesEntryWithoutItsUrlSha512AndSizeAsync(): Promise<void> {
    const routes = FeedCheckTests.release("1.2.3");
    const text = FeedCheckTests.metadata("1.2.3", [["'App-1.2.3.AppImage'", FeedCheckTests.LINUX, FeedCheckTests.LINUX.length]]).toString("utf8")
      .replace("files:\n", "files:\n  - url: 'App-1.2.3.zsync'\n    size: 4\n");
    routes.set("/latest-linux-x64.yml", FeedCheckTests.file(Buffer.from(text)));
    await FeedCheckTests.withFeedAsync(routes, async (feed, requests) => {
      const result = await FeedCheckTests.runAsync(FeedCheckTests.check(feed));

      Assert.areEqual(1, result.exitCode);
      Assert.areEqual(`latest-linux-x64.yml in ${feed} lists a file without its url, sha512 and size, one to a line in that order.\n`, result.output);
      Assert.areEqual("/latest-linux-x64.yml", requests.join());
    });
  }

  @TestMethod
  public async stopsTryingAgainAtTheDeadlineAsync(): Promise<void> {
    const routes = FeedCheckTests.release("1.2.3");
    let reads = 0;
    routes.set("/latest-linux-x64.yml", (_request, response) => {
      reads += 1;
      response.writeHead(404).end();
    });
    await FeedCheckTests.withFeedAsync(routes, async feed => {
      const result = await FeedCheckTests.runAsync({ ...FeedCheckTests.check(feed), FEED_WAIT_SECONDS: "20" });

      Assert.areEqual(1, result.exitCode);
      Assert.areEqual("15000,5000", result.pauses.join());
      Assert.areEqual(3, reads);
      Assert.isTrue(result.output.endsWith(`tries again.\nlatest-linux-x64.yml could not be read from ${feed}: HTTP 404.\n`), result.output);
    });
  }

  @TestMethod
  public async triesAgainWhileTheFeedIsBehindAsync(): Promise<void> {
    const routes = FeedCheckTests.release("1.2.3");
    const behind = FeedCheckTests.file(FeedCheckTests.metadata("1.2.2", [["'App-1.2.2.AppImage'", FeedCheckTests.LINUX, FeedCheckTests.LINUX.length]]));
    const current = routes.get("/latest-linux-x64.yml");
    let reads = 0;
    routes.set("/latest-linux-x64.yml", (request, response) => {
      reads += 1;
      (reads === 1 ? behind : current ?? behind)(request, response);
    });
    await FeedCheckTests.withFeedAsync(routes, async feed => {
      const result = await FeedCheckTests.runAsync({ ...FeedCheckTests.check(feed), FEED_WAIT_SECONDS: "60" });

      Assert.areEqual(0, result.exitCode, result.output);
      Assert.areEqual(2, reads);
      Assert.areEqual("15000", result.pauses.join());
      Assert.isTrue(
        result.output.startsWith(`latest-linux-x64.yml in ${feed} names the version "1.2.2", not 1.2.3. The feed may still be catching up, so the check tries again.\nlinux-x64: `),
        result.output);
    });
  }

  @TestMethod
  public async skipsTheCheckWithoutReadingTheFeedWhenTheReleaseAsksAsync(): Promise<void> {
    await FeedCheckTests.withFeedAsync(FeedCheckTests.release("1.2.2"), async (feed, requests) => {
      const result = await FeedCheckTests.runAsync({ ...FeedCheckTests.check(feed), SKIP_FEED_CHECK: "true" });

      Assert.areEqual(0, result.exitCode, result.output);
      Assert.areEqual("SKIP_FEED_CHECK is true, so the release skips the update feed check, and nothing is checked.\n", result.output);
      Assert.areEqual(0, requests.length);
    });
  }

  @TestMethod
  public async checksTheFeedWhenTheReleaseLeavesTheCheckOnAsync(): Promise<void> {
    await FeedCheckTests.withFeedAsync(FeedCheckTests.release("1.2.2"), async (feed, requests) => {
      const result = await FeedCheckTests.runAsync({ ...FeedCheckTests.check(feed), SKIP_FEED_CHECK: "false" });

      Assert.areEqual(1, result.exitCode);
      Assert.areEqual(`latest-linux-x64.yml in ${feed} names the version "1.2.2", not 1.2.3.\n`, result.output);
      Assert.areEqual("/latest-linux-x64.yml", requests.join());
    });
  }

  @TestMethod
  public async refusesASkipFeedVersionTargetsOrWaitItCannotUseAsync(): Promise<void> {
    const feed = "https://updates.example.test/app/";
    const cases: readonly (readonly [Readonly<Record<string, string>>, string])[] = [
      [{ SKIP_FEED_CHECK: "yes" }, "SKIP_FEED_CHECK must be true or false, not \"yes\"."],
      [{ FEED_URL: "http://updates.example.test/app/" }, "FEED_URL must be an HTTPS folder URL ending in /, or a loopback http one, not \"http://updates.example.test/app/\"."],
      [{ FEED_URL: "updates" }, "FEED_URL must be an HTTPS folder URL ending in /, or a loopback http one, not \"updates\"."],
      [{ FEED_URL: String.empty, RELEASE_REPOSITORY: "app" }, "Without FEED_URL, RELEASE_REPOSITORY must name the repository whose latest release is the feed, as owner/name, not \"app\"."],
      [{ FEED_URL: String.empty, RELEASE_REPOSITORY: "noldova-com/app", FEED_VERSION: "v1.2.3" }, "FEED_VERSION must be the version the feed serves, such as 0.0.2 or 0.0.2-internal.10, not \"v1.2.3\"."],
      [{ RELEASE_TARGETS: "linux-x64,linux-x64" }, "RELEASE_TARGETS must list the targets the feed serves, distinct and among "],
      [{ RELEASE_TARGETS: String.empty }, "RELEASE_TARGETS must list the targets the feed serves, distinct and among "],
      [{ FEED_WAIT_SECONDS: "3601" }, "FEED_WAIT_SECONDS must be the seconds to wait for a feed that is behind, from 0 to 3600, not \"3601\"."],
      [{ FEED_WAIT_SECONDS: "1.5" }, "FEED_WAIT_SECONDS must be the seconds to wait for a feed that is behind, from 0 to 3600, not \"1.5\"."]
    ];

    for (const [environment, message] of cases) {
      const result = await FeedCheckTests.runAsync({ ...FeedCheckTests.check(feed), ...environment });

      Assert.areEqual(1, result.exitCode, message);
      Assert.isTrue(result.output.startsWith(message), result.output);
    }
  }

  @TestMethod
  public async passesOnAFailureThatIsNoReleaseProblemAsync(): Promise<void> {
    const output = new PassThrough();
    const clock = {
      now: (): number => {
        throw new RangeError("the clock stopped");
      },
      pauseAsync: (): Promise<void> => Promise.resolve()
    };

    const error = await Assert.throwsAsync(() => new FeedCheck(FeedCheckTests.check("https://updates.example.test/app/"), output, "noldova-desktop-release", clock).runAsync([]), RangeError);

    Assert.areEqual("the clock stopped", error.message);
    Assert.isNull(output.read());
  }

  @TestMethod
  public async answersAnArgumentWithItsUsageAsync(): Promise<void> {
    const result = await FeedCheckTests.runAsync(FeedCheckTests.check("https://updates.example.test/app/"), ["now"]);

    Assert.areEqual(2, result.exitCode);
    Assert.areEqual(
      "Usage: [SKIP_FEED_CHECK=<true or false>] FEED_VERSION=<version> RELEASE_TARGETS=<target ids> "
        + "{RELEASE_REPOSITORY=<owner/name> | FEED_URL=<URL>} [FEED_WAIT_SECONDS=<seconds>] noldova-desktop-release feed-check\n",
      result.output);
  }

  private static check(feed: string): Readonly<Record<string, string>> {
    return { FEED_URL: feed, FEED_VERSION: "1.2.3", RELEASE_TARGETS: "linux-x64,windows-x64", FEED_WAIT_SECONDS: "0" };
  }

  private static release(version: string): Map<string, Route> {
    const notes = Buffer.from("notes");
    return new Map([
      ["/latest-linux-x64.yml", FeedCheckTests.file(FeedCheckTests.metadata(version, [[`'App-${version}.AppImage'`, FeedCheckTests.LINUX, FeedCheckTests.LINUX.length]]))],
      ["/App-1.2.3.AppImage", FeedCheckTests.file(FeedCheckTests.LINUX)],
      ["/latest-windows-x64.yml", FeedCheckTests.file(FeedCheckTests.metadata(version, [
        [`App Setup ${version}.exe`, FeedCheckTests.WINDOWS, FeedCheckTests.WINDOWS.length],
        ["'App''s notes.txt'", notes, notes.length]
      ]))],
      ["/App%20Setup%201.2.3.exe", FeedCheckTests.file(FeedCheckTests.WINDOWS)],
      ["/App's%20notes.txt", FeedCheckTests.file(notes)]
    ]);
  }

  private static metadata(version: string, files: readonly (readonly [string, Buffer, number])[]): Buffer {
    return Buffer.from([
      `version: ${version}`,
      "files:",
      ...files.flatMap(([url, bytes, size]) => [`  - url: ${url}`, `    sha512: ${FeedCheckTests.sha512(bytes)}`, `    size: ${size}`]),
      `path: ${files[0]?.[0]}`,
      `sha512: ${FeedCheckTests.sha512(files[0]?.[1] ?? Buffer.alloc(0))}`,
      "releaseDate: '2026-11-07T10:00:00.000Z'",
      String.empty
    ].join("\n"));
  }

  private static file(bytes: Buffer): Route {
    return (_request, response) => response.end(bytes);
  }

  private static sha512(bytes: Buffer): string {
    return createHash("sha512").update(bytes).digest("base64");
  }

  private static async withFeedAsync<T>(routes: ReadonlyMap<string, Route>, use: (feed: string, requests: readonly string[]) => Promise<T>): Promise<T> {
    const requests: string[] = [];
    const server = createServer((request, response) => {
      const url = request.url ?? String.empty;
      requests.push(url);
      const route = routes.get(url.split("?")[0] ?? url);
      if (Object.isUndefined(route))
        response.writeHead(404).end();
      else
        route(request, response);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      return await use(Object.isNull(address) || Object.isString(address) ? String.empty : `http://127.0.0.1:${address.port}/`, requests);
    }
    finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }

  private static async withRefusingServerAsync<T>(use: (feed: string) => Promise<T>): Promise<T> {
    const server = createServer();
    server.on("connection", socket => socket.destroy());
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      return await use(Object.isNull(address) || Object.isString(address) ? String.empty : `http://127.0.0.1:${address.port}/`);
    }
    finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }

  private static async runAsync(
    environment: Readonly<Record<string, string>>,
    commandArguments: readonly string[] = []): Promise<{ readonly exitCode: number; readonly output: string; readonly pauses: readonly number[] }> {
    const output = new PassThrough();
    const pauses: number[] = [];
    let now = 1_000_000;
    const clock = {
      now: (): number => now,
      pauseAsync: (milliseconds: number): Promise<void> => {
        pauses.push(milliseconds);
        now += milliseconds;
        return Promise.resolve();
      }
    };
    const exitCode = await new FeedCheck(environment, output, "noldova-desktop-release", clock).runAsync(commandArguments);
    return { exitCode, output: output.read()?.toString() ?? String.empty, pauses };
  }
}

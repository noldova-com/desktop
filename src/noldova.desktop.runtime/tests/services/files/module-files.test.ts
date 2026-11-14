/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { lstat, mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  FailureCode, FileGrant, FileGrantsDiscard, FileGrantsEnded, FileShareResolve, QualifiedName, Request, type Response, ShellMethods, WindowClosed
} from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { MethodFailureException } from "../../../src/exceptions/method-failure.exception.js";
import { RequestContext } from "../../../src/models/request-context.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { FileGrantTable } from "../../../src/services/files/file-grant-table.js";
import { FileIdentity } from "../../../src/services/files/file-identity.js";
import { ModuleFiles } from "../../../src/services/files/module-files.js";
import { FailedStatFixture } from "../../fixtures/failed-stat.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import type { RawConnectionFixture } from "../../fixtures/raw-connection.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ModuleFilesTests {
  private static readonly SHARE: QualifiedName = new QualifiedName("notes", "echo");
  private static readonly PART: string = [
    "export class RuntimePart {",
    "  async activateAsync(context) {",
    "    context.registerMethod(`${context.moduleId}.echo`, { handleAsync: request => context.files.shareAsync(request.payload.path, request, request.payload.options) });",
    "  }",
    String.empty,
    "  async deactivateAsync() {",
    "  }",
    "}",
    String.empty
  ].join("\n");

  private static sent: number = 0;

  @TestMethod
  public sharesAFileInTheModulesDataOrWorkFolderWithItsPageAndMainResolvesItWhileItLives(): Promise<void> {
    return ModuleFilesTests.runAsync(async (fixture, mainProcess) => {
      const photo = await ModuleFilesTests.writeAsync(fixture.dataDirectory.locateModuleFolder("notes"), "photo.png", "png");
      const report = await ModuleFilesTests.writeAsync(fixture.dataDirectory.locateWorkFolder("notes"), "report.pdf", "a report");
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      const shared = await ModuleFilesTests.shareAsync(mainProcess, photo, { mediaType: "image/png", lifetime: 60_000 });
      const other = await ModuleFilesTests.shareAsync(mainProcess, report);
      const resolved = [
        await ModuleFilesTests.resolveAsync(mainProcess, shared),
        await ModuleFilesTests.resolveAsync(mainProcess, shared),
        await ModuleFilesTests.resolveAsync(mainProcess, other)
      ].map(t => FileGrant.fromJson(t.payload));
      const refusals = [
        await ModuleFilesTests.resolveAsync(cli, shared),
        await ModuleFilesTests.resolveAsync(mainProcess, shared, 3, 2),
        await ModuleFilesTests.resolveAsync(mainProcess, "f".repeat(32))
      ];

      Assert.isTrue([shared, other].every(t => /^[0-9a-f]{32}$/.test(t)) && shared !== other, `${shared} ${other}`);
      Assert.areEqual(`${await realpath(photo)}|photo.png|image/png|3|notes|3|2|60000|false`, ModuleFilesTests.describe(resolved[0]));
      Assert.areEqual(ModuleFilesTests.describe(resolved[0]), ModuleFilesTests.describe(resolved[1]));
      Assert.areEqual(`${await realpath(report)}|report.pdf|application/octet-stream|8|notes|3|2|600000|false`, ModuleFilesTests.describe(resolved[2]));
      Assert.areEqual(
        ["Unauthorized: Only the app's main process resolves a shared file.", "Unauthorized: Only the app's main process resolves a shared file.", "NotFound: The shared file is unknown or has ended."].join("|"),
        refusals.map(t => `${t.failure?.code}: ${t.failure?.message}`).join("|"));
    });
  }

  @TestMethod
  public refusesAFileOutsideItsFoldersOneALinkLeadsOutToAFolderAMissingFileAndARequestNotFromAPage(): Promise<void> {
    return ModuleFilesTests.runAsync(async (fixture, mainProcess) => {
      const folder = fixture.dataDirectory.locateModuleFolder("notes");
      await mkdir(folder, { recursive: true });
      const outside = await ModuleFilesTests.writeAsync(path.join(fixture.root, "outside"), "secret.txt", "secret");
      const otherModule = await ModuleFilesTests.writeAsync(fixture.dataDirectory.locateModuleFolder("terminal"), "photo.png", "png");
      await symlink(path.dirname(outside), path.join(folder, "linked"), "junction");
      await mkdir(path.join(folder, "pictures"));
      const inside = await ModuleFilesTests.writeAsync(folder, "photo.png", "png");
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      const answers = [
        await ModuleFilesTests.sendAsync(mainProcess, ModuleFilesTests.SHARE, { path: outside }, 3, 2),
        await ModuleFilesTests.sendAsync(mainProcess, ModuleFilesTests.SHARE, { path: otherModule }, 3, 2),
        await ModuleFilesTests.sendAsync(mainProcess, ModuleFilesTests.SHARE, { path: path.join(folder, "linked", "secret.txt") }, 3, 2),
        await ModuleFilesTests.sendAsync(mainProcess, ModuleFilesTests.SHARE, { path: path.join(folder, "..", "terminal", "photo.png") }, 3, 2),
        await ModuleFilesTests.sendAsync(mainProcess, ModuleFilesTests.SHARE, { path: path.join(folder, "pictures") }, 3, 2),
        await ModuleFilesTests.sendAsync(mainProcess, ModuleFilesTests.SHARE, { path: folder }, 3, 2),
        await ModuleFilesTests.sendAsync(mainProcess, ModuleFilesTests.SHARE, { path: path.join(folder, "missing.png") }, 3, 2),
        await ModuleFilesTests.sendAsync(mainProcess, ModuleFilesTests.SHARE, { path: inside }),
        await ModuleFilesTests.sendAsync(mainProcess, ModuleFilesTests.SHARE, { path: inside }, 3),
        await ModuleFilesTests.sendAsync(cli, ModuleFilesTests.SHARE, { path: inside })
      ];

      Assert.areEqual([
        ...Array<string>(4).fill("InvalidParams: The file to share is outside the module's own data and work folders, so it is not shared."),
        ...Array<string>(2).fill("InvalidParams: The file to share is not a regular file, so it is not shared."),
        "NotFound: The file to share can't be read (ENOENT), so it is not shared.",
        ...Array<string>(3).fill("Unauthorized: A runtime part shares a file only while it answers a request from its window's page.")
      ].join("|"), answers.map(t => `${t.failure?.code}: ${t.failure?.message}`).join("|"));
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public refusesToShareAFifo(): Promise<void> {
    return ModuleFilesTests.runAsync(async (fixture, mainProcess) => {
      const folder = fixture.dataDirectory.locateModuleFolder("notes");
      await mkdir(folder, { recursive: true });
      const fifo = path.join(folder, "pipe");
      execFileSync("mkfifo", [fifo]);

      const answer = await ModuleFilesTests.sendAsync(mainProcess, ModuleFilesTests.SHARE, { path: fifo }, 3, 2);

      Assert.areEqual("InvalidParams: The file to share is not a regular file, so it is not shared.", `${answer.failure?.code}: ${answer.failure?.message}`);
    });
  }

  @TestMethod
  public endsAShareThePageDiscardsAndThoseOfAPageOrAWindowThatEnded(): Promise<void> {
    return ModuleFilesTests.runAsync(async (fixture, mainProcess) => {
      const photo = await ModuleFilesTests.writeAsync(fixture.dataDirectory.locateModuleFolder("notes"), "photo.png", "png");
      const discarded = await ModuleFilesTests.shareAsync(mainProcess, photo);
      const ofPage = await ModuleFilesTests.shareAsync(mainProcess, photo);
      const ofWindow = await ModuleFilesTests.shareAsync(mainProcess, photo, {}, 4, 1);
      const kept = await ModuleFilesTests.shareAsync(mainProcess, photo, {}, 5, 1);

      await ModuleFilesTests.sendAsync(mainProcess, ShellMethods.discardFileGrants, new FileGrantsDiscard([discarded]).toJson(), 3, 2);
      const afterDiscard = await ModuleFilesTests.resolveAsync(mainProcess, ofPage);
      await ModuleFilesTests.sendAsync(mainProcess, ShellMethods.endFileGrants, new FileGrantsEnded(3, 2).toJson());
      await ModuleFilesTests.sendAsync(mainProcess, ShellMethods.windowClosed, new WindowClosed(4).toJson());
      const answers: Response[] = [];
      for (const share of [discarded, ofPage, ofWindow, kept])
        answers.push(await ModuleFilesTests.resolveAsync(mainProcess, share));

      Assert.isUndefined(afterDiscard.failure);
      Assert.areEqual("NotFound|NotFound|NotFound|", answers.map(t => t.failure?.code ?? String.empty).join("|"));
    });
  }

  @TestMethod
  public sharesAFileInsideItsFoldersWithTheRequestingPageOnTheTable(): Promise<void> {
    return ModuleFilesTests.runFilesAsync(async (files, table, inside) => {
      const photo = await ModuleFilesTests.writeAsync(inside, "photo.png", "png");

      const grant = await files.shareAsync(photo, ModuleFilesTests.pageRequest(), { mediaType: "image/png" });
      const kept = await files.shareAsync(photo, ModuleFilesTests.pageRequest());

      const shared = table.resolve(1, grant);
      Assert.areEqual(`${await realpath(photo)}|photo.png|image/png|3|notes|3|2|false`,
        [shared.path, shared.name, shared.mediaType, shared.size, shared.module, shared.window, shared.page, shared.isStaged].join("|"));
      Assert.areEqual(FileGrant.maximumLifetime, shared.lifetime);
      Assert.areEqual("application/octet-stream", table.resolve(1, kept).mediaType);
    });
  }

  @TestMethod
  public refusesARequestNotFromAPageAFileOutsideItsFoldersAndAMissingFile(): Promise<void> {
    return ModuleFilesTests.runFilesAsync(async (files, _table, inside, outside) => {
      const photo = await ModuleFilesTests.writeAsync(inside, "photo.png", "png");
      const secret = await ModuleFilesTests.writeAsync(outside, "secret.txt", "secret");

      const refusals = [
        await Assert.throwsAsync(() => files.shareAsync(photo, new RequestContext("main", null, new AbortController().signal, 1, 3)), MethodFailureException),
        await Assert.throwsAsync(() => files.shareAsync(photo, new RequestContext("cli", null, new AbortController().signal, 1, 3, 2)), MethodFailureException),
        await Assert.throwsAsync(() => files.shareAsync(secret, ModuleFilesTests.pageRequest()), MethodFailureException),
        await Assert.throwsAsync(() => files.shareAsync(inside, ModuleFilesTests.pageRequest()), MethodFailureException),
        await Assert.throwsAsync(() => files.shareAsync(path.join(inside, "missing.png"), ModuleFilesTests.pageRequest()), MethodFailureException)
      ];

      Assert.areEqual([
        `${FailureCode.Unauthorized}: A runtime part shares a file only while it answers a request from its window's page.`,
        `${FailureCode.Unauthorized}: A runtime part shares a file only while it answers a request from its window's page.`,
        `${FailureCode.InvalidParams}: The file to share is outside the module's own data and work folders, so it is not shared.`,
        `${FailureCode.InvalidParams}: The file to share is not a regular file, so it is not shared.`,
        `${FailureCode.NotFound}: The file to share can't be read (ENOENT), so it is not shared.`
      ].join("|"), refusals.map(t => `${t.failure.code}: ${t.failure.message}`).join("|"));
    });
  }

  @TestMethod
  public failsWhenOneOfItsFoldersCannotBeReadForAnUnmodeledReason(): Promise<void> {
    return ModuleFilesTests.runFilesAsync(async (_files, table, inside) => {
      const photo = await ModuleFilesTests.writeAsync(inside, "photo.png", "png");
      const files = new ModuleFiles("notes", table, [path.join(inside, "n\u0000tes")]);

      const error = await Assert.throwsAsync(() => files.shareAsync(photo, ModuleFilesTests.pageRequest()), Error);

      Assert.isTrue(error.message.includes("null bytes"), error.message);
    });
  }

  @TestMethod
  public passesOnAFailureToReadTheFileThatCarriesNoCode(): Promise<void> {
    return ModuleFilesTests.runFilesAsync(async (files, _table, inside) => {
      const photo = await ModuleFilesTests.writeAsync(inside, "photo.png", "png");
      const failure = new RangeError("The file cannot be measured.");
      using _stat = new FailedStatFixture(await realpath(photo), failure);

      const error = await Assert.throwsAsync(() => files.shareAsync(photo, ModuleFilesTests.pageRequest()), RangeError);

      Assert.areEqual(failure, error);
    });
  }

  @TestMethod
  public passesOnAFailureToReadTheFileThatIsNotAMissingPath(): Promise<void> {
    return ModuleFilesTests.runFilesAsync(async (files, _table, inside) => {
      const photo = await ModuleFilesTests.writeAsync(inside, "photo.png", "png");
      const failure = Object.assign(new Error("EACCES: permission denied, lstat"), { code: "EACCES" });
      using _stat = new FailedStatFixture(await realpath(photo), failure);

      const error = await Assert.throwsAsync(() => files.shareAsync(photo, ModuleFilesTests.pageRequest()), Error);

      Assert.areEqual(failure, error);
    });
  }

  @TestMethod
  public redeemsOnlyTheGrantsIssuedForItsOwnModule(): Promise<void> {
    return ModuleFilesTests.runFilesAsync(async (files, table, inside) => {
      const notes = await ModuleFilesTests.writeAsync(inside, "notes.txt", "kept notes");
      const stats = await lstat(notes, { bigint: true });
      table.issue(1, new FileGrant("1".repeat(32), notes, "notes.txt", "text/plain", Number(stats.size), FileIdentity.of(stats), "notes", 3, 2, 600_000, false));
      table.issue(1, new FileGrant("2".repeat(32), notes, "notes.txt", "text/plain", Number(stats.size), FileIdentity.of(stats), "terminal", 3, 2, 600_000, false));

      const granted = await files.redeemAsync("1".repeat(32), ModuleFilesTests.pageRequest());
      const text = await granted.handle.readFile("utf8");
      await granted.closeAsync();
      const other = await Assert.throwsAsync(() => files.redeemAsync("2".repeat(32), ModuleFilesTests.pageRequest()), MethodFailureException);

      Assert.areEqual("kept notes", text);
      Assert.areEqual(FailureCode.NotFound, other.failure.code);
    });
  }

  private static async runFilesAsync(test: (files: ModuleFiles, table: FileGrantTable, inside: string, outside: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const inside = path.join(folder.path, "modules", "notes");
    const work = path.join(folder.path, "work", "notes");
    await mkdir(inside, { recursive: true });
    const table = new FileGrantTable(path.join(folder.path, "staged"), new ClientClosures(new TextOutputFixture()));
    try {
      await test(new ModuleFiles("notes", table, [inside, work]), table, inside, path.join(folder.path, "outside"));
    }
    finally {
      table.dispose();
    }
  }

  private static pageRequest(): RequestContext {
    return new RequestContext("main", null, new AbortController().signal, 1, 3, 2);
  }

  private static async runAsync(test: (fixture: RuntimeHostFixture, mainProcess: RawConnectionFixture) => Promise<void>): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([["notes", ModuleFilesTests.PART], ["terminal", ModuleFilesTests.PART]]));
      const [mainProcess] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      await test(fixture, mainProcess);
    });
  }

  private static async writeAsync(folder: string, name: string, text: string): Promise<string> {
    await mkdir(folder, { recursive: true });
    const file = path.join(folder, name);
    await writeFile(file, text);
    return file;
  }

  private static async shareAsync(connection: RawConnectionFixture, file: string, options: JsonObject = {}, window: number = 3, page: number = 2): Promise<string> {
    const answer = await ModuleFilesTests.sendAsync(connection, ModuleFilesTests.SHARE, { path: file, options }, window, page);
    Assert.isUndefined(answer.failure, answer.failure?.message);
    return String(answer.payload);
  }

  private static resolveAsync(connection: RawConnectionFixture, grant: string, window?: number, page?: number): Promise<Response> {
    return ModuleFilesTests.sendAsync(connection, ShellMethods.resolveFileShare, new FileShareResolve(grant).toJson(), window, page);
  }

  private static async sendAsync(connection: RawConnectionFixture, method: QualifiedName, payload: JsonValue, window?: number, page?: number): Promise<Response> {
    connection.sendMessages(new Request(`call:${ModuleFilesTests.sent++}`, method, payload, undefined, window, page));
    return connection.readResponseAsync();
  }

  private static describe(file: FileGrant | undefined): string {
    return [file?.path, file?.name, file?.mediaType, file?.size, file?.module, file?.window, file?.page, file?.lifetime, file?.isStaged].join("|");
  }
}

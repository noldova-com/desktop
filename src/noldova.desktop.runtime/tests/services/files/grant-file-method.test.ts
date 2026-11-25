/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { access, lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonException, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FailureCode, FileGrant, FileGrantsDiscard, FileGrantsEnded, QualifiedName, Request, type Response, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { MethodFailureException } from "../../../src/exceptions/method-failure.exception.js";
import { RequestContext } from "../../../src/models/request-context.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { FileGrantTable } from "../../../src/services/files/file-grant-table.js";
import { FileIdentity } from "../../../src/services/files/file-identity.js";
import { GrantFileMethod } from "../../../src/services/files/grant-file-method.js";
import { ModuleSourceFixture } from "../../fixtures/module-source.fixture.js";
import type { RawConnectionFixture } from "../../fixtures/raw-connection.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class GrantFileMethodTests {
  private static readonly READ: QualifiedName = new QualifiedName("notes", "echo");
  private static readonly OTHER_READ: QualifiedName = new QualifiedName("terminal", "echo");
  private static readonly PART: string = [
    "export class RuntimePart {",
    "  async activateAsync(context) {",
    "    context.registerMethod(`${context.moduleId}.echo`, { handleAsync: async request => {",
    "      const file = await context.files.redeemAsync(request.payload.grant, request);",
    "      try {",
    "        return { name: file.name, mediaType: file.mediaType, size: file.size, text: await file.handle.readFile(\"utf8\") };",
    "      }",
    "      finally {",
    "        await file.closeAsync();",
    "      }",
    "    } });",
    "  }",
    String.empty,
    "  async deactivateAsync() {",
    "  }",
    "}",
    String.empty
  ].join("\n");

  private static sent: number = 0;

  @TestMethod
  public letsAPartRedeemTheGrantMainIssuedForItsPageOnce(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const left = path.join(fixture.dataDirectory.stagedFolder, "left");
      await mkdir(fixture.dataDirectory.stagedFolder, { recursive: true });
      await writeFile(left, "pasted before a crash");
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("notes", GrantFileMethodTests.PART), new ModuleSourceFixture("terminal", GrantFileMethodTests.PART)]));
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const file = path.join(fixture.root, "notes.txt");
      await writeFile(file, "kept notes");
      const grant = await GrantFileMethodTests.grantAsync(file, "1");

      const issued = await GrantFileMethodTests.sendAsync(mainProcess, ShellMethods.grantFile, grant.toJson());
      const otherPage = await GrantFileMethodTests.sendAsync(mainProcess, GrantFileMethodTests.READ, { grant: grant.grant }, 3, 1);
      const otherModule = await GrantFileMethodTests.sendAsync(mainProcess, GrantFileMethodTests.OTHER_READ, { grant: grant.grant }, 3, 2);
      const read = await GrantFileMethodTests.sendAsync(mainProcess, GrantFileMethodTests.READ, { grant: grant.grant }, 3, 2);
      const again = await GrantFileMethodTests.sendAsync(mainProcess, GrantFileMethodTests.READ, { grant: grant.grant }, 3, 2);

      Assert.areEqual("null", GrantFileMethodTests.describe(issued));
      Assert.areEqual("NotFound|NotFound", `${otherPage.failure?.code}|${otherModule.failure?.code}`);
      Assert.areEqual("{\"name\":\"notes.txt\",\"mediaType\":\"text/plain\",\"size\":10,\"text\":\"kept notes\"}", GrantFileMethodTests.describe(read));
      Assert.areEqual("NotFound", again.failure?.code);
      Assert.isFalse(await access(left).then(() => true, () => false), "A staged copy from an earlier run stayed.");
    });
  }

  @TestMethod
  public endsTheGrantsAPageDiscardsAndThoseMainEndsForAPage(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("notes", GrantFileMethodTests.PART)]));
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const file = path.join(fixture.root, "notes.txt");
      await writeFile(file, "kept notes");
      const discarded = await GrantFileMethodTests.grantAsync(file, "1");
      const ended = await GrantFileMethodTests.grantAsync(file, "2");
      await GrantFileMethodTests.sendAsync(mainProcess, ShellMethods.grantFile, discarded.toJson());
      await GrantFileMethodTests.sendAsync(mainProcess, ShellMethods.grantFile, ended.toJson());

      const discard = await GrantFileMethodTests.sendAsync(mainProcess, ShellMethods.discardFileGrants, new FileGrantsDiscard([discarded.grant]).toJson(), 3, 2);
      const end = await GrantFileMethodTests.sendAsync(mainProcess, ShellMethods.endFileGrants, new FileGrantsEnded(3, 2).toJson());
      const reads = [
        await GrantFileMethodTests.sendAsync(mainProcess, GrantFileMethodTests.READ, { grant: discarded.grant }, 3, 2),
        await GrantFileMethodTests.sendAsync(mainProcess, GrantFileMethodTests.READ, { grant: ended.grant }, 3, 2)
      ];

      Assert.areEqual("null|null", `${GrantFileMethodTests.describe(discard)}|${GrantFileMethodTests.describe(end)}`);
      Assert.areEqual("NotFound|NotFound", reads.map(t => t.failure?.code).join("|"));
    });
  }

  @TestMethod
  public refusesGrantsFromAnyoneButMainDiscardsFromOutsideAPageAndAnInvalidGrant(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("notes", GrantFileMethodTests.PART)]));
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const file = path.join(fixture.root, "notes.txt");
      await writeFile(file, "kept notes");
      const grant = await GrantFileMethodTests.grantAsync(file, "1");
      const discard = new FileGrantsDiscard([grant.grant]).toJson();

      const refusals = [
        await GrantFileMethodTests.sendAsync(cli, ShellMethods.grantFile, grant.toJson()),
        await GrantFileMethodTests.sendAsync(cli, ShellMethods.endFileGrants, new FileGrantsEnded(3, 2).toJson()),
        await GrantFileMethodTests.sendAsync(mainProcess, ShellMethods.grantFile, grant.toJson(), 3, 2),
        await GrantFileMethodTests.sendAsync(mainProcess, ShellMethods.endFileGrants, new FileGrantsEnded(3, 2).toJson(), 3, 2),
        await GrantFileMethodTests.sendAsync(cli, ShellMethods.discardFileGrants, discard),
        await GrantFileMethodTests.sendAsync(mainProcess, ShellMethods.discardFileGrants, discard, 3),
        await GrantFileMethodTests.sendAsync(mainProcess, ShellMethods.grantFile, { grant: grant.grant })
      ];
      const read = await GrantFileMethodTests.sendAsync(mainProcess, GrantFileMethodTests.READ, { grant: grant.grant }, 3, 2);

      Assert.areEqual(
        [
          ...Array<string>(4).fill("Unauthorized: Only the app's main process grants files and ends a page's grants."),
          "Unauthorized: Only a window's page discards its file grants.",
          "Unauthorized: Only a window's page discards its file grants."
        ].join("|"),
        refusals.slice(0, 6).map(t => `${t.failure?.code}: ${t.failure?.message}`).join("|"));
      Assert.areEqual("InvalidParams", refusals[6]?.failure?.code);
      Assert.areEqual("NotFound", read.failure?.code);
    });
  }

  @TestMethod
  public issuesTheGrantTheMainProcessSends(): Promise<void> {
    return GrantFileMethodTests.runTableAsync(async (table, file) => {
      const method = new GrantFileMethod(table);

      const answer = await method.handleAsync(new RequestContext("main", (await GrantFileMethodTests.grantAsync(file, "1")).toJson(), new AbortController().signal, 1));
      const granted = await table.redeemAsync("notes", "1".repeat(32), new RequestContext("main", null, new AbortController().signal, 1, 3, 2));
      await granted.closeAsync();

      Assert.isNull(answer);
      Assert.areEqual("notes.txt", granted.name);
    });
  }

  @TestMethod
  public refusesAGrantFromAnotherClientOrFromAWindowAndAnInvalidOne(): Promise<void> {
    return GrantFileMethodTests.runTableAsync(async (table, file) => {
      const method = new GrantFileMethod(table);
      const grant = (await GrantFileMethodTests.grantAsync(file, "1")).toJson();

      const fromCli = await Assert.throwsAsync(() => method.handleAsync(new RequestContext("cli", grant, new AbortController().signal, 2)), MethodFailureException);
      const fromWindow = await Assert.throwsAsync(() => method.handleAsync(new RequestContext("main", grant, new AbortController().signal, 1, 3)), MethodFailureException);
      Assert.throws(() => method.handleAsync(new RequestContext("main", { grant: "1".repeat(32) }, new AbortController().signal, 1)), JsonException);

      Assert.areEqual(
        `${FailureCode.Unauthorized}: Only the app's main process grants files and ends a page's grants.|${FailureCode.Unauthorized}`,
        `${fromCli.failure.code}: ${fromCli.failure.message}|${fromWindow.failure.code}`);
      Assert.areEqual(0, table.count);
    });
  }

  private static async runTableAsync(test: (table: FileGrantTable, file: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "notes.txt");
    await writeFile(file, "kept notes");
    const table = new FileGrantTable(path.join(folder.path, "staged"), new ClientClosures(new TextOutputFixture()));
    try {
      await test(table, file);
    }
    finally {
      table.dispose();
    }
  }

  private static async grantAsync(file: string, digit: string): Promise<FileGrant> {
    const stats = await lstat(file, { bigint: true });
    return new FileGrant(digit.repeat(32), file, "notes.txt", "text/plain", Number(stats.size), FileIdentity.of(stats), "notes", 3, 2, 600_000, false);
  }

  private static async sendAsync(connection: RawConnectionFixture, method: QualifiedName, payload: JsonValue, window?: number, page?: number): Promise<Response> {
    connection.sendMessages(new Request(`call:${GrantFileMethodTests.sent++}`, method, payload, undefined, window, page));
    return connection.readResponseAsync();
  }

  private static describe(response: Response): string {
    return JSON.stringify(response.payload ?? null);
  }
}

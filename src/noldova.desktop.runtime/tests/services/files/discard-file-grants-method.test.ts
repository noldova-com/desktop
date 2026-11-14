/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { lstat, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonException, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FailureCode, FileGrant, FileGrantsDiscard } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../../src/exceptions/method-failure.exception.js";
import { RequestContext } from "../../../src/models/request-context.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { DiscardFileGrantsMethod } from "../../../src/services/files/discard-file-grants-method.js";
import { FileGrantTable } from "../../../src/services/files/file-grant-table.js";
import { FileIdentity } from "../../../src/services/files/file-identity.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class DiscardFileGrantsMethodTests {
  private static readonly DISCARDED: string = "1".repeat(32);
  private static readonly KEPT: string = "2".repeat(32);

  @TestMethod
  public endsOnlyTheGrantsThePageNames(): Promise<void> {
    return DiscardFileGrantsMethodTests.runAsync(async table => {
      const method = new DiscardFileGrantsMethod(table);

      const answer = await method.handleAsync(DiscardFileGrantsMethodTests.request(new FileGrantsDiscard([DiscardFileGrantsMethodTests.DISCARDED]).toJson(), 3, 2));

      Assert.isNull(answer);
      Assert.areEqual(1, table.count);
      const kept = await table.redeemAsync("notes", DiscardFileGrantsMethodTests.KEPT, DiscardFileGrantsMethodTests.request(null, 3, 2));
      await kept.closeAsync();
    });
  }

  @TestMethod
  public refusesADiscardFromAnotherClientOrFromOutsideAPageAndAnInvalidOne(): Promise<void> {
    return DiscardFileGrantsMethodTests.runAsync(async table => {
      const method = new DiscardFileGrantsMethod(table);
      const discard = new FileGrantsDiscard([DiscardFileGrantsMethodTests.DISCARDED]).toJson();

      const fromCli = await Assert.throwsAsync(
        () => method.handleAsync(new RequestContext("cli", discard, new AbortController().signal, 1, 3, 2)), MethodFailureException);
      const fromWindow = await Assert.throwsAsync(() => method.handleAsync(DiscardFileGrantsMethodTests.request(discard, 3, null)), MethodFailureException);
      Assert.throws(() => method.handleAsync(DiscardFileGrantsMethodTests.request({ grants: "all" }, 3, 2)), JsonException);

      Assert.areEqual(
        `${FailureCode.Unauthorized}: Only a window's page discards its file grants.|${FailureCode.Unauthorized}`,
        `${fromCli.failure.code}: ${fromCli.failure.message}|${fromWindow.failure.code}`);
      Assert.areEqual(2, table.count);
    });
  }

  private static async runAsync(test: (table: FileGrantTable) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "notes.txt");
    await writeFile(file, "kept notes");
    const stats = await lstat(file, { bigint: true });
    const table = new FileGrantTable(path.join(folder.path, "staged"), new ClientClosures(new TextOutputFixture()));
    for (const grant of [DiscardFileGrantsMethodTests.DISCARDED, DiscardFileGrantsMethodTests.KEPT])
      table.issue(1, new FileGrant(grant, file, "notes.txt", "text/plain", Number(stats.size), FileIdentity.of(stats), "notes", 3, 2, 600_000, false));
    try {
      await test(table);
    }
    finally {
      table.dispose();
    }
  }

  private static request(payload: JsonValue, window: number | null, page: number | null): RequestContext {
    return new RequestContext("main", payload, new AbortController().signal, 1, window, page);
  }
}

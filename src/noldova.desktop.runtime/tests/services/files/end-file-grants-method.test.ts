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
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FailureCode, FileGrant, FileGrantsEnded } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../../src/exceptions/method-failure.exception.js";
import { RequestContext } from "../../../src/models/request-context.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { EndFileGrantsMethod } from "../../../src/services/files/end-file-grants-method.js";
import { FileGrantTable } from "../../../src/services/files/file-grant-table.js";
import { FileIdentity } from "../../../src/services/files/file-identity.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class EndFileGrantsMethodTests {
  @TestMethod
  public endsTheGrantsOfThePageTheMainProcessNamesOnItsOwnConnection(): Promise<void> {
    return EndFileGrantsMethodTests.runAsync(async table => {
      const method = new EndFileGrantsMethod(table);

      const other = await method.handleAsync(new RequestContext("main", new FileGrantsEnded(3, 2).toJson(), new AbortController().signal, 2));
      const kept = table.count;
      const answer = await method.handleAsync(new RequestContext("main", new FileGrantsEnded(3, 2).toJson(), new AbortController().signal, 1));

      Assert.isNull(other);
      Assert.isNull(answer);
      Assert.areEqual("2|1", `${kept}|${table.count}`);
    });
  }

  @TestMethod
  public refusesAnEndFromAnotherClientOrFromAWindowAndAnInvalidOne(): Promise<void> {
    return EndFileGrantsMethodTests.runAsync(async table => {
      const method = new EndFileGrantsMethod(table);
      const ended = new FileGrantsEnded(3, 2).toJson();

      const fromCli = await Assert.throwsAsync(() => method.handleAsync(new RequestContext("cli", ended, new AbortController().signal, 1)), MethodFailureException);
      const fromWindow = await Assert.throwsAsync(() => method.handleAsync(new RequestContext("main", ended, new AbortController().signal, 1, 3)), MethodFailureException);
      Assert.throws(() => method.handleAsync(new RequestContext("main", { window: 3 }, new AbortController().signal, 1)), JsonException);

      Assert.areEqual(
        `${FailureCode.Unauthorized}: Only the app's main process grants files and ends a page's grants.|${FailureCode.Unauthorized}`,
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
    table.issue(1, new FileGrant("1".repeat(32), file, "notes.txt", "text/plain", Number(stats.size), FileIdentity.of(stats), "notes", 3, 2, 600_000, false));
    table.issue(1, new FileGrant("2".repeat(32), file, "notes.txt", "text/plain", Number(stats.size), FileIdentity.of(stats), "notes", 3, 4, 600_000, false));
    try {
      await test(table);
    }
    finally {
      table.dispose();
    }
  }
}

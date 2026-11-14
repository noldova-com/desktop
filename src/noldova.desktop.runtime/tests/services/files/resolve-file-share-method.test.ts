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
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FailureCode, FileGrant, FileShareResolve } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../../src/exceptions/method-failure.exception.js";
import { RequestContext } from "../../../src/models/request-context.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { FileGrantTable } from "../../../src/services/files/file-grant-table.js";
import { FileIdentity } from "../../../src/services/files/file-identity.js";
import { ResolveFileShareMethod } from "../../../src/services/files/resolve-file-share-method.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ResolveFileShareMethodTests {
  private static readonly SHARED: string = "1".repeat(32);

  @TestMethod
  public answersTheSharedFileToTheMainProcessOnTheConnectionItWasSharedWith(): Promise<void> {
    return ResolveFileShareMethodTests.runAsync(async (table, file) => {
      const method = new ResolveFileShareMethod(table);

      const answer = await method.handleAsync(new RequestContext("main", new FileShareResolve(ResolveFileShareMethodTests.SHARED).toJson(), new AbortController().signal, 1));

      const resolved = FileGrant.fromJson(answer);
      Assert.areEqual(`${file}|photo.png|image/png|notes`, `${resolved.path}|${resolved.name}|${resolved.mediaType}|${resolved.module}`);
      Assert.areEqual(1, table.count);
    });
  }

  @TestMethod
  public refusesAnotherClientAWindowAndAnUnknownShare(): Promise<void> {
    return ResolveFileShareMethodTests.runAsync(async table => {
      const method = new ResolveFileShareMethod(table);
      const resolve = new FileShareResolve(ResolveFileShareMethodTests.SHARED).toJson();

      const fromCli = await Assert.throwsAsync(() => method.handleAsync(new RequestContext("cli", resolve, new AbortController().signal, 1)), MethodFailureException);
      const fromWindow = await Assert.throwsAsync(() => method.handleAsync(new RequestContext("main", resolve, new AbortController().signal, 1, 3, 2)), MethodFailureException);
      const otherConnection = Assert.throws(() => method.handleAsync(new RequestContext("main", resolve, new AbortController().signal, 2)), MethodFailureException);
      const unknown = Assert.throws(
        () => method.handleAsync(new RequestContext("main", new FileShareResolve("f".repeat(32)).toJson(), new AbortController().signal, 1)), MethodFailureException);

      Assert.areEqual(
        [
          `${FailureCode.Unauthorized}: Only the app's main process resolves a shared file.`,
          `${FailureCode.Unauthorized}: Only the app's main process resolves a shared file.`,
          `${FailureCode.NotFound}: The shared file is unknown or has ended.`,
          `${FailureCode.NotFound}: The shared file is unknown or has ended.`
        ].join("|"),
        [fromCli, fromWindow, otherConnection, unknown].map(t => `${t.failure.code}: ${t.failure.message}`).join("|"));
    });
  }

  private static async runAsync(test: (table: FileGrantTable, file: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "photo.png");
    await writeFile(file, "png");
    const stats = await lstat(file, { bigint: true });
    const table = new FileGrantTable(path.join(folder.path, "staged"), new ClientClosures(new TextOutputFixture()));
    table.share(1, new FileGrant(ResolveFileShareMethodTests.SHARED, file, "photo.png", "image/png", Number(stats.size), FileIdentity.of(stats), "notes", 3, 2, 600_000, false));
    try {
      await test(table, file);
    }
    finally {
      table.dispose();
    }
  }
}

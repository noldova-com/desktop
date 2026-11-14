/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName } from "@noldova/desktop.protocol";

import { DataDirectory } from "../../../src/services/data-directory/data-directory.js";
import { ShellDatabase } from "../../../src/services/database/shell-database.js";
import { ShellMigrations } from "../../../src/services/database/shell-migrations.js";
import { OwnershipLock } from "../../../src/services/ownership/ownership-lock.js";
import { SecretTable } from "../../../src/services/secrets/secret-table.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class SecretTableTests {
  private static readonly TOKEN: QualifiedName = QualifiedName.parse("vault.token");

  @TestMethod
  public async savesReplacesReadsAndRemovesACiphertextForItsDevice(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    using database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    const table = new SecretTable(database);

    const before = table.read("device-1", SecretTableTests.TOKEN);
    table.save("device-1", SecretTableTests.TOKEN, "c2VhbGVkLTE=");
    const saved = table.read("device-1", SecretTableTests.TOKEN);
    table.save("device-1", SecretTableTests.TOKEN, "c2VhbGVkLTI=");
    const replaced = table.read("device-1", SecretTableTests.TOKEN);
    table.remove("device-1", SecretTableTests.TOKEN);
    const removed = table.read("device-1", SecretTableTests.TOKEN);

    Assert.isNull(before);
    Assert.areEqual("c2VhbGVkLTE=", saved);
    Assert.areEqual("c2VhbGVkLTI=", replaced);
    Assert.isNull(removed);
  }

  @TestMethod
  public async keepsEachDeviceAndEachModulesSecretsApart(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    using database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    const table = new SecretTable(database);
    const other = QualifiedName.parse("clock.token");
    table.save("device-1", SecretTableTests.TOKEN, "Zmlyc3Q=");
    table.save("device-2", SecretTableTests.TOKEN, "c2Vjb25k");

    table.remove("device-2", SecretTableTests.TOKEN);

    Assert.areEqual("Zmlyc3Q=", table.read("device-1", SecretTableTests.TOKEN));
    Assert.isNull(table.read("device-2", SecretTableTests.TOKEN));
    Assert.isNull(table.read("device-1", other));
  }
}

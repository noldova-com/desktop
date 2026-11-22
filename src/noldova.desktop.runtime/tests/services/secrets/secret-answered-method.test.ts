/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FailureCode, QualifiedName, SecretAnswered, SecretFailureKind } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../../src/exceptions/method-failure.exception.js";
import { CaughtFailure } from "../../../src/models/caught-failure.js";
import { EventChannel } from "../../../src/models/event-channel.js";
import { RequestContext } from "../../../src/models/request-context.js";
import { DataDirectory } from "../../../src/services/data-directory/data-directory.js";
import { ShellDatabase } from "../../../src/services/database/shell-database.js";
import { ShellMigrations } from "../../../src/services/database/shell-migrations.js";
import { OwnershipLock } from "../../../src/services/ownership/ownership-lock.js";
import { MachineSecretBackend } from "../../../src/services/secrets/machine-secret-backend.js";
import { SecretAnsweredMethod } from "../../../src/services/secrets/secret-answered-method.js";
import { SecretTable } from "../../../src/services/secrets/secret-table.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class SecretAnsweredMethodTests {
  private static readonly MAIN: number = 7;

  @TestMethod
  public async givesTheAnswerToTheCallItAnswersOnlyFromTheConnectionThatWasAskedAndAnswersNull(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    using database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    const published: JsonValue[] = [];
    const backend = SecretAnsweredMethodTests.createBackend(database, published);
    const method = new SecretAnsweredMethod(backend);
    let isSettled = false;

    const status = backend.isSetAsync(QualifiedName.parse("vault.token")).finally(() => {
      isSettled = true;
    });
    const ignored = await method.handleAsync(SecretAnsweredMethodTests.context(SecretAnsweredMethodTests.MAIN + 1, new SecretAnswered(1, "device-1")));
    const isSettledByAnother = isSettled;
    const answer = await method.handleAsync(SecretAnsweredMethodTests.context(SecretAnsweredMethodTests.MAIN, new SecretAnswered(1, "device-1")));

    Assert.areEqual("[{\"call\":1,\"action\":\"Device\"}]", JSON.stringify(published));
    Assert.isNull(ignored);
    Assert.isFalse(isSettledByAnother);
    Assert.isNull(answer);
    Assert.isFalse(await status);
  }

  @TestMethod
  public async turnsAFailedAnswerIntoTheCallsFailure(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    using database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    const backend = SecretAnsweredMethodTests.createBackend(database, []);
    const method = new SecretAnsweredMethod(backend);

    const status = backend.isSetAsync(QualifiedName.parse("vault.token"));
    const failed = Assert.throwsAsync(() => status, MethodFailureException);
    await method.handleAsync(SecretAnsweredMethodTests.context(SecretAnsweredMethodTests.MAIN, new SecretAnswered(1, null, SecretFailureKind.NoDevice)));
    const failure = await failed;

    Assert.areEqual(FailureCode.Unavailable, failure.failure.code);
  }

  @TestMethod
  public async refusesAPayloadThatIsNoAnswer(): Promise<void> {
    const method = new SecretAnsweredMethod(new MachineSecretBackend());

    await Assert.throwsAsync(() => method.handleAsync(new RequestContext("main", { call: 1 }, new AbortController().signal, SecretAnsweredMethodTests.MAIN)), Error);
  }

  @TestMethod
  public async givesUpOnADeviceAskTheAppDoesNotAnswerInTimeAndAsksAgainNextTime(): Promise<void> {
    const published: JsonValue[] = [];
    const backend = new MachineSecretBackend(new EventChannel(t => published.push(t), () => undefined), 10);
    backend.check(SecretAnsweredMethodTests.MAIN);

    const lapsed = await backend.readDeviceAsync().then(() => null, (error: unknown) => CaughtFailure.expect(error, MethodFailureException).failure);
    const again = backend.readDeviceAsync();
    backend.answer(SecretAnsweredMethodTests.MAIN, new SecretAnswered(2, "device-1"));

    Assert.areEqual(JSON.stringify([FailureCode.Unavailable, "Noldova Desktop Sample did not say in time which device it runs on, so this machine's secret store was not used."]),
      JSON.stringify([lapsed?.code, lapsed?.message]));
    Assert.areEqual(JSON.stringify(["device-1", [{ call: 1, action: "Device" }, { call: 2, action: "Device" }]]), JSON.stringify([await again, published]));
  }

  private static createBackend(database: ShellDatabase, published: JsonValue[]): MachineSecretBackend {
    const backend = new MachineSecretBackend(new EventChannel(t => published.push(t), () => undefined));
    backend.open(new SecretTable(database));
    backend.check(SecretAnsweredMethodTests.MAIN);
    return backend;
  }

  private static context(connection: number, answered: SecretAnswered): RequestContext {
    return new RequestContext("main", answered.toJson(), new AbortController().signal, connection);
  }
}

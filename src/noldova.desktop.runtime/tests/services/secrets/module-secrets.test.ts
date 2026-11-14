/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SecretNotOwnedException } from "@noldova/desktop.runtime";

import { ModuleSecrets } from "../../../src/services/secrets/module-secrets.js";
import { SecretBackendFixture } from "../../fixtures/secret-backend.fixture.js";

@TestClass
export class ModuleSecretsTests {
  @TestMethod
  public async savesReadsChecksAndRemovesItsOwnSecretsThroughTheBackend(): Promise<void> {
    const backend = new SecretBackendFixture();
    const secrets = new ModuleSecrets("vault", backend);

    await secrets.saveAsync("vault.token", "s3cret");
    const read = await secrets.readAsync("vault.token");
    const isSet = await secrets.isSetAsync("vault.token");
    await secrets.removeAsync("vault.token");
    const isSetAfter = await secrets.isSetAsync("vault.token");
    const readAfter = await secrets.readAsync("vault.token");

    Assert.areEqual("s3cret", read);
    Assert.isTrue(isSet);
    Assert.isFalse(isSetAfter);
    Assert.isNull(readAfter);
    Assert.areEqual("save vault.token,read vault.token,isSet vault.token,remove vault.token,isSet vault.token,read vault.token", backend.calls.join(","));
  }

  @TestMethod
  public async refusesAnotherModulesSecretWithoutReachingTheBackend(): Promise<void> {
    const backend = new SecretBackendFixture();
    const secrets = new ModuleSecrets("vault", backend);

    const saved = await Assert.throwsAsync(() => secrets.saveAsync("clock.token", "s3cret"), SecretNotOwnedException);
    await Assert.throwsAsync(() => secrets.readAsync("clock.token"), SecretNotOwnedException);
    await Assert.throwsAsync(() => secrets.isSetAsync("clock.token"), SecretNotOwnedException);
    await Assert.throwsAsync(() => secrets.removeAsync("clock.token"), SecretNotOwnedException);

    Assert.areEqual("The module vault may only use its own secrets, not clock.token.", saved.message);
    Assert.areEqual(0, backend.calls.length);
  }

  @TestMethod
  public async refusesAnEmptyValueBeforeReachingTheBackend(): Promise<void> {
    const backend = new SecretBackendFixture();
    const secrets = new ModuleSecrets("vault", backend);

    await Assert.throwsAsync(() => secrets.saveAsync("vault.token", String.empty), ArgumentException);

    Assert.areEqual(0, backend.calls.length);
  }
}

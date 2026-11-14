/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SecretValue } from "@noldova/desktop.protocol";
import { RequestContext } from "@noldova/desktop.runtime";

import { SaveSecretMethod } from "../../../src/services/secrets/save-secret-method.js";
import { SecretBackendFixture } from "../../fixtures/secret-backend.fixture.js";

@TestClass
export class SaveSecretMethodTests {
  @TestMethod
  public async savesTheNamedValueAndAnswersNull(): Promise<void> {
    const backend = new SecretBackendFixture();
    const method = new SaveSecretMethod(backend);

    const answer = await method.handleAsync(new RequestContext("cli", new SecretValue(QualifiedName.parse("vault.token"), "s3cret").toJson(), new AbortController().signal, 1));

    Assert.isNull(answer);
    Assert.areEqual("s3cret", await backend.readAsync(QualifiedName.parse("vault.token")));
    Assert.areEqual("save vault.token,read vault.token", backend.calls.join(","));
  }

  @TestMethod
  public async refusesAnEmptyValueOrAMissingNameWithoutReachingTheBackend(): Promise<void> {
    const backend = new SecretBackendFixture();
    const method = new SaveSecretMethod(backend);

    await Assert.throwsAsync(() => method.handleAsync(new RequestContext("cli", { name: "vault.token", value: "" }, new AbortController().signal, 1)), Error);
    await Assert.throwsAsync(() => method.handleAsync(new RequestContext("cli", { value: "s3cret" }, new AbortController().signal, 1)), Error);

    Assert.areEqual(0, backend.calls.length);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SecretReference } from "@noldova/desktop.protocol";
import { RequestContext } from "@noldova/desktop.runtime";

import { RemoveSecretMethod } from "../../../src/services/secrets/remove-secret-method.js";
import { SecretBackendFixture } from "../../fixtures/secret-backend.fixture.js";

@TestClass
export class RemoveSecretMethodTests {
  @TestMethod
  public async removesTheNamedSecretAndAnswersNull(): Promise<void> {
    const backend = new SecretBackendFixture();
    await backend.saveAsync(QualifiedName.parse("vault.token"), "s3cret");
    const method = new RemoveSecretMethod(backend);

    const answer = await method.handleAsync(new RequestContext("cli", new SecretReference(QualifiedName.parse("vault.token")).toJson(), new AbortController().signal, 1));

    Assert.isNull(answer);
    Assert.isFalse(await backend.isSetAsync(QualifiedName.parse("vault.token")));
    Assert.areEqual("save vault.token,remove vault.token,isSet vault.token", backend.calls.join(","));
  }

  @TestMethod
  public async refusesAPayloadThatNamesNoSecretWithoutReachingTheBackend(): Promise<void> {
    const backend = new SecretBackendFixture();
    const method = new RemoveSecretMethod(backend);

    await Assert.throwsAsync(() => method.handleAsync(new RequestContext("cli", { name: "vault.token", extra: true }, new AbortController().signal, 1)), Error);
    await Assert.throwsAsync(() => method.handleAsync(new RequestContext("cli", "vault.token", new AbortController().signal, 1)), Error);

    Assert.areEqual(0, backend.calls.length);
  }
}

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

import { SecretStatusMethod } from "../../../src/services/secrets/secret-status-method.js";
import { SecretBackendFixture } from "../../fixtures/secret-backend.fixture.js";

@TestClass
export class SecretStatusMethodTests {
  @TestMethod
  public async answersWhetherTheNamedSecretIsSet(): Promise<void> {
    const backend = new SecretBackendFixture();
    const method = new SecretStatusMethod(backend);
    const payload = new SecretReference(QualifiedName.parse("vault.token")).toJson();

    const before = await method.handleAsync(new RequestContext("cli", payload, new AbortController().signal, 1));
    await backend.saveAsync(QualifiedName.parse("vault.token"), "s3cret");
    const after = await method.handleAsync(new RequestContext("cli", payload, new AbortController().signal, 1));

    Assert.areEqual(false, before);
    Assert.areEqual(true, after);
    Assert.areEqual("isSet vault.token,save vault.token,isSet vault.token", backend.calls.join(","));
  }

  @TestMethod
  public async refusesAPayloadThatNamesNoSecretWithoutReachingTheBackend(): Promise<void> {
    const backend = new SecretBackendFixture();
    const method = new SecretStatusMethod(backend);

    await Assert.throwsAsync(() => method.handleAsync(new RequestContext("cli", null, new AbortController().signal, 1)), Error);

    Assert.areEqual(0, backend.calls.length);
  }
}

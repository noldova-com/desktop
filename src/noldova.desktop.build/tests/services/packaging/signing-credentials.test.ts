/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { SigningCredentials } from "../../../src/services/packaging/signing-credentials.js";

@TestClass
export class SigningCredentialsTests {
  @TestMethod
  public takesEverySigningCredentialOutOfTheEnvironmentAndLeavesTheRest(): void {
    const environment: NodeJS.ProcessEnv = {
      PATH: "/usr/bin", AZURE_TENANT_ID: "tenant", AZURE_CLIENT_SECRET: String.empty, WINDOWS_PUBLISHER: "CN=Sample", APPLE_API_KEY_P8: "key", MAC_CERTIFICATE: undefined
    };

    const credentials = SigningCredentials.take(environment);

    Assert.areEqual(JSON.stringify({ AZURE_TENANT_ID: "tenant", AZURE_CLIENT_SECRET: String.empty, WINDOWS_PUBLISHER: "CN=Sample", APPLE_API_KEY_P8: "key" }),
      JSON.stringify(credentials));
    Assert.areEqual(JSON.stringify(["PATH"]), JSON.stringify(Object.keys(environment)));
  }

  @TestMethod
  public takesNothingFromAnEnvironmentWithoutCredentials(): void {
    const environment: NodeJS.ProcessEnv = { PATH: "/usr/bin" };

    const credentials = SigningCredentials.take(environment);

    Assert.areEqual("{}", JSON.stringify(credentials));
    Assert.areEqual(JSON.stringify({ PATH: "/usr/bin" }), JSON.stringify(environment));
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class WindowsSigningAccount {

  public readonly endpoint: string;
  public readonly account: string;
  public readonly profile: string;

  public constructor(endpoint: string, account: string, profile: string) {
    this.endpoint = endpoint;
    this.account = account;
    this.profile = profile;
  }

  public static fromSources(environment: NodeJS.ProcessEnv, signing: Readonly<Record<string, unknown>> | null): WindowsSigningAccount {
    const endpoint = environment[Resources.trustedSigningEndpointVariable] ?? String.empty;
    const account = environment[Resources.trustedSigningAccountVariable] ?? String.empty;
    const profile = environment[Resources.trustedSigningProfileVariable] ?? String.empty;
    if ([endpoint, account, profile].every(t => t.length === 0))
      return WindowsSigningAccount.fromProduct(signing);
    const missing = Resources.trustedSigningAccountVariables.filter(t => (environment[t] ?? String.empty).length === 0);
    if (missing.length > 0)
      throw new BuildException(Resources.formatWindowsSigningVariablesMissing(missing));
    return WindowsSigningAccount.validated([Resources.trustedSigningEndpointVariable, endpoint], [Resources.trustedSigningAccountVariable, account],
      [Resources.trustedSigningProfileVariable, profile], Resources.formatWindowsSigningVariableInvalid);
  }

  public static fromProduct(signing: Readonly<Record<string, unknown>> | null): WindowsSigningAccount {
    if (Object.isNull(signing))
      throw new BuildException(Resources.windowsSigningMissing);
    const field = (name: string): readonly [string, string] => [name, WindowsSigningAccount.read(signing, name)];
    return WindowsSigningAccount.validated(field(Resources.windowsSigningEndpointField), field(Resources.windowsSigningAccountField), field(Resources.windowsSigningProfileField),
      Resources.formatWindowsSigningInvalid);
  }

  private static validated(endpoint: readonly [string, string], account: readonly [string, string], profile: readonly [string, string],
    invalid: (name: string, expected: string) => string): WindowsSigningAccount {
    WindowsSigningAccount.require(Resources.windowsSigningEndpointPattern.test(endpoint[1]), invalid(endpoint[0], Resources.windowsSigningEndpointExpected));
    for (const [name, value] of [account, profile])
      WindowsSigningAccount.require(Resources.windowsSigningNamePattern.test(value), invalid(name, Resources.windowsSigningNameExpected));
    return new WindowsSigningAccount(endpoint[1], account[1], profile[1]);
  }

  private static read(signing: Readonly<Record<string, unknown>>, field: string): string {
    const value = signing[field];
    return Object.isString(value) ? value : String.empty;
  }

  private static require(isValid: boolean, message: string): void {
    if (!isValid)
      throw new BuildException(message);
  }
}

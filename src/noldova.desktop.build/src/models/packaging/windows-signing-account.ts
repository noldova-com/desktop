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

  public static fromProduct(signing: Readonly<Record<string, unknown>> | null): WindowsSigningAccount {
    if (Object.isNull(signing))
      throw new BuildException(Resources.windowsSigningMissing);
    const endpoint = WindowsSigningAccount.read(signing, Resources.windowsSigningEndpointField);
    const account = WindowsSigningAccount.read(signing, Resources.windowsSigningAccountField);
    const profile = WindowsSigningAccount.read(signing, Resources.windowsSigningProfileField);
    WindowsSigningAccount.require(Resources.windowsSigningEndpointPattern.test(endpoint), Resources.windowsSigningEndpointField, Resources.windowsSigningEndpointExpected);
    for (const [field, value] of [[Resources.windowsSigningAccountField, account], [Resources.windowsSigningProfileField, profile]] as const)
      WindowsSigningAccount.require(Resources.windowsSigningNamePattern.test(value), field, Resources.windowsSigningNameExpected);
    return new WindowsSigningAccount(endpoint, account, profile);
  }

  private static read(signing: Readonly<Record<string, unknown>>, field: string): string {
    const value = signing[field];
    return Object.isString(value) ? value : String.empty;
  }

  private static require(isValid: boolean, field: string, expected: string): void {
    if (!isValid)
      throw new BuildException(Resources.formatWindowsSigningInvalid(field, expected));
  }
}

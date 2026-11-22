/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { QualifiedName, SecretAction } from "@noldova/desktop.protocol";

export class SecretCall {
  private readonly wait: PromiseWithResolvers<string>;
  private timer: NodeJS.Timeout | undefined = undefined;

  public readonly connection: number;
  public readonly action: SecretAction;
  public readonly name: QualifiedName | null;

  public constructor(connection: number, action: SecretAction, name: QualifiedName | null, wait: PromiseWithResolvers<string>) {
    this.connection = connection;
    this.action = action;
    this.name = name;
    this.wait = wait;
  }

  public expireAfter(timer: NodeJS.Timeout): void {
    this.timer = timer;
  }

  public complete(value: string): void {
    clearTimeout(this.timer);
    this.wait.resolve(value);
  }

  public fail(error: Error): void {
    clearTimeout(this.timer);
    this.wait.reject(error);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentNullException } from "@noldova/context.exceptions";
import { JsonException, type JsonValue } from "@noldova/context.json";
import { SecretAction, SecretAnswered, SecretCommand, SecretFailureKind, ShellMethods } from "@noldova/desktop.protocol";

import type { ISecretStorageHost } from "../interfaces/i-secret-storage-host.js";
import { CaughtFailure } from "../models/caught-failure.js";
import { Resources } from "../resources.js";
import type { RuntimeCaller } from "./runtime-caller.js";

export class SecretAnswerer {
  private readonly storage: ISecretStorageHost;
  private readonly platform: string;
  private readonly readDeviceAsync: () => Promise<string | null>;
  private readonly runtime: RuntimeCaller;
  private readonly log: (text: string) => void;

  public constructor(storage: ISecretStorageHost, platform: string, readDeviceAsync: () => Promise<string | null>, runtime: RuntimeCaller, log: (text: string) => void) {
    this.storage = storage;
    this.platform = platform;
    this.readDeviceAsync = readDeviceAsync;
    this.runtime = runtime;
    this.log = log;
  }

  public async answerAsync(payload: JsonValue): Promise<void> {
    let command: SecretCommand;
    try {
      command = SecretCommand.fromJson(payload);
    }
    catch (error) {
      this.log(Resources.formatSecretCommandInvalid(CaughtFailure.expect(error, JsonException).message));
      return;
    }
    const answer = await this.answerOfAsync(command);
    await this.runtime.callAsync(ShellMethods.secretAnswered, answer.toJson());
  }

  private async answerOfAsync(command: SecretCommand): Promise<SecretAnswered> {
    if (command.action === SecretAction.Device) {
      const device = await this.readDeviceAsync();
      return Object.isNull(device) ? new SecretAnswered(command.call, null, SecretFailureKind.NoDevice) : new SecretAnswered(command.call, device);
    }
    if (!this.storage.isEncryptionAvailable() || (this.platform === Resources.linuxPlatform && Resources.unprotectedStorageBackends.includes(this.storage.getSelectedStorageBackend())))
      return new SecretAnswered(command.call, null, SecretFailureKind.Unprotected);
    const value = command.value;
    ArgumentNullException.throwIfNull(value, Resources.secretValueParameter);
    try {
      return command.action === SecretAction.Encrypt ? new SecretAnswered(command.call, this.storage.encryptString(value).toString(Resources.base64Encoding))
        : new SecretAnswered(command.call, this.storage.decryptString(Buffer.from(value, Resources.base64Encoding)));
    }
    catch {
      return new SecretAnswered(command.call, null, command.action === SecretAction.Encrypt ? SecretFailureKind.Unprotected : SecretFailureKind.Undecryptable);
    }
  }
}

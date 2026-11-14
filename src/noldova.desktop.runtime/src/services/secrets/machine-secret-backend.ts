/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Failure, FailureCode, type QualifiedName, SecretAction, type SecretAnswered, SecretCommand, SecretFailureKind, SecretFailureReason, SecretFailures } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { ISecretBackend } from "../../interfaces/i-secret-backend.js";
import type { EventChannel } from "../../models/event-channel.js";
import { ProductInfo } from "../../models/product-info.js";
import { Resources } from "../../resources.js";
import type { SecretTable } from "./secret-table.js";

export class MachineSecretBackend implements ISecretBackend {
  private readonly channel: EventChannel | null;
  private readonly calls: Map<number, { readonly connection: number; readonly action: SecretAction; readonly name: QualifiedName | null; readonly wait: PromiseWithResolvers<string> }> = new Map();
  private readonly writes: Map<string, Promise<void>> = new Map();
  private target: { readonly connection: number; readonly channel: EventChannel } | null = null;
  private table: SecretTable | null = null;
  private device: string | null = null;
  private nextCall: number = 1;

  public constructor(channel: EventChannel | null = null) {
    this.channel = channel;
  }

  public open(table: SecretTable): void {
    this.table = table;
  }

  public async saveAsync(name: QualifiedName, value: string): Promise<void> {
    await this.writeInOrderAsync(name, async () => {
      const [table, device] = await this.requireStoreAsync();
      table.save(device, name, await this.commandAsync(SecretAction.Encrypt, value, name));
    });
  }

  public async readAsync(name: QualifiedName): Promise<string | null> {
    const [table, device] = await this.requireStoreAsync();
    const ciphertext = table.read(device, name);
    return Object.isNull(ciphertext) ? null : await this.commandAsync(SecretAction.Decrypt, ciphertext, name);
  }

  public async removeAsync(name: QualifiedName): Promise<void> {
    await this.writeInOrderAsync(name, async () => {
      const [table, device] = await this.requireStoreAsync();
      table.remove(device, name);
    });
  }

  public async isSetAsync(name: QualifiedName): Promise<boolean> {
    const [table, device] = await this.requireStoreAsync();
    return !Object.isNull(table.read(device, name));
  }

  public answer(connection: number, answered: SecretAnswered): void {
    const call = this.calls.get(answered.call);
    if (Object.isUndefined(call) || call.connection !== connection)
      return;
    this.calls.delete(answered.call);
    if (!Object.isNull(answered.value))
      call.wait.resolve(answered.value);
    else if (!Object.isNull(answered.failure))
      call.wait.reject(MachineSecretBackend.failureOf(answered.failure, call.action, call.name));
  }

  public check(connection: number | null): void {
    const channel = this.channel;
    const target = Object.isNull(connection) || Object.isNull(channel) ? null : { connection, channel };
    if (target?.connection === this.target?.connection)
      return;
    const calls = [...this.calls.values()];
    this.calls.clear();
    for (const call of calls)
      call.wait.reject(MachineSecretBackend.needsApp());
    this.target = target;
  }

  private async writeInOrderAsync(name: QualifiedName, write: () => Promise<void>): Promise<void> {
    const key = name.text;
    const written = (this.writes.get(key) ?? Promise.resolve()).then(write);
    const settled = written.catch(() => undefined);
    this.writes.set(key, settled);
    try {
      await written;
    }
    finally {
      if (this.writes.get(key) === settled)
        this.writes.delete(key);
    }
  }

  private async requireStoreAsync(): Promise<[SecretTable, string]> {
    const table = this.table;
    if (Object.isNull(table))
      throw MachineSecretBackend.needsApp();
    return [table, await this.requireDeviceAsync()];
  }

  private async requireDeviceAsync(): Promise<string> {
    this.device ??= await this.commandAsync(SecretAction.Device, null, null);
    return this.device;
  }

  private commandAsync(action: SecretAction, value: string | null, name: QualifiedName | null): Promise<string> {
    const target = this.target;
    if (Object.isNull(target))
      return Promise.reject(MachineSecretBackend.needsApp());
    const command = new SecretCommand(this.nextCall, action, value);
    this.nextCall += 1;
    const wait = Promise.withResolvers<string>();
    this.calls.set(command.call, { connection: target.connection, action, name, wait });
    target.channel.publishTo(target.connection, null, command.toJson());
    return wait.promise;
  }

  private static needsApp(): MethodFailureException {
    return MachineSecretBackend.unavailable(SecretFailureReason.NotConnected, Resources.formatSecretsNeedApp(ProductInfo.current.name));
  }

  private static failureOf(kind: SecretFailureKind, action: SecretAction, name: QualifiedName | null): MethodFailureException {
    switch (kind) {
      case SecretFailureKind.NoDevice:
        return MachineSecretBackend.unavailable(SecretFailureReason.NoDevice, Resources.formatSecretsNoDevice(ProductInfo.current.name));
      case SecretFailureKind.Unprotected:
        return MachineSecretBackend.unavailable(SecretFailureReason.Unprotected, action === SecretAction.Decrypt
          ? Resources.formatSecretUnreadable(ProductInfo.current.name, String(name)) : Resources.formatSecretsUnprotected(ProductInfo.current.name));
      default:
        return MachineSecretBackend.unavailable(SecretFailureReason.Undecryptable, Resources.formatSecretUndecryptable(String(name)));
    }
  }

  private static unavailable(reason: SecretFailureReason, message: string): MethodFailureException {
    return new MethodFailureException(new Failure(FailureCode.Unavailable, message, SecretFailures.detailsOf(reason)));
  }
}

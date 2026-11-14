/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { SecretAction } from "../enums/secret-action.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class SecretCommand {
  private static readonly FIELDS: readonly string[] = [Resources.callField, Resources.actionField, Resources.valueField];
  private static readonly ACTIONS: readonly SecretAction[] = Object.values(SecretAction);

  public readonly call: number;
  public readonly action: SecretAction;
  public readonly value: string | null;

  public constructor(call: number, action: SecretAction, value: string | null = null) {
    if (!Number.isSafeInteger(call) || call <= 0)
      throw new ArgumentException(Resources.secretCallInvalid, Resources.callField);
    if (!SecretCommand.hasValue(action, value))
      throw new ArgumentException(Resources.secretCommandValueInvalid, Resources.valueField);

    this.call = call;
    this.action = action;
    this.value = value;
  }

  public static fromJson(value: unknown, path?: string): SecretCommand {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SecretCommand.FIELDS);
    return WireContract.create(reader, () => new SecretCommand(
      reader.readInteger(Resources.callField),
      reader.readOneOf(Resources.actionField, SecretCommand.ACTIONS),
      reader.hasField(Resources.valueField) ? reader.readString(Resources.valueField) : null));
  }

  public toJson(): JsonObject {
    return {
      [Resources.callField]: this.call,
      [Resources.actionField]: this.action,
      ...Object.isNull(this.value) ? {} : { [Resources.valueField]: this.value }
    };
  }

  private static hasValue(action: SecretAction, value: string | null): boolean {
    switch (action) {
      case SecretAction.Encrypt:
        return !Object.isNull(value) && value.length > 0 && value.length <= Resources.secretValueLimit;
      case SecretAction.Decrypt:
        return !Object.isNull(value) && value.length > 0 && value.length <= Resources.secretCipherLimit;
      default:
        return Object.isNull(value);
    }
  }
}

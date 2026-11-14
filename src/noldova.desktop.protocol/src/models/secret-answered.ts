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

import { SecretFailureKind } from "../enums/secret-failure-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class SecretAnswered {
  private static readonly FIELDS: readonly string[] = [Resources.callField, Resources.valueField, Resources.failureField];
  private static readonly KINDS: readonly SecretFailureKind[] = Object.values(SecretFailureKind);

  public readonly call: number;
  public readonly value: string | null;
  public readonly failure: SecretFailureKind | null;

  public constructor(call: number, value: string | null = null, failure: SecretFailureKind | null = null) {
    if (!Number.isSafeInteger(call) || call <= 0)
      throw new ArgumentException(Resources.secretCallInvalid, Resources.callField);
    if (Object.isNull(failure) === Object.isNull(value))
      throw new ArgumentException(Resources.responseOutcomeAmbiguous, Resources.valueField);

    this.call = call;
    this.value = value;
    this.failure = failure;
  }

  public static fromJson(value: unknown, path?: string): SecretAnswered {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SecretAnswered.FIELDS);
    return WireContract.create(reader, () => new SecretAnswered(
      reader.readInteger(Resources.callField),
      reader.hasField(Resources.valueField) ? reader.readString(Resources.valueField) : null,
      reader.hasField(Resources.failureField) ? reader.readOneOf(Resources.failureField, SecretAnswered.KINDS) : null));
  }

  public toJson(): JsonObject {
    return {
      [Resources.callField]: this.call,
      ...Object.isNull(this.value) ? {} : { [Resources.valueField]: this.value },
      ...Object.isNull(this.failure) ? {} : { [Resources.failureField]: this.failure }
    };
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { QualifiedName } from "./qualified-name.js";

export class SecretValue {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.valueField];

  public readonly name: QualifiedName;
  public readonly value: string;

  public constructor(name: QualifiedName, value: string) {
    if (name.isShell)
      throw new ArgumentException(Resources.secretNameInvalid, Resources.nameField);
    if (!SecretValue.isValue(value))
      throw new ArgumentException(Resources.secretValueInvalid, Resources.valueField);

    this.name = name;
    this.value = value;
  }

  public static fromJson(value: unknown, path?: string): SecretValue {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SecretValue.FIELDS);
    return WireContract.create(reader, () => new SecretValue(
      QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField), reader.readString(Resources.valueField)));
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name.text, [Resources.valueField]: this.value };
  }

  private static isValue(value: string): boolean {
    return value.length > 0 && value.length <= Resources.secretValueLimit && value.isWellFormed();
  }
}

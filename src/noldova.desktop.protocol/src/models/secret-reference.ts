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

export class SecretReference {
  private static readonly FIELDS: readonly string[] = [Resources.nameField];

  public readonly name: QualifiedName;

  public constructor(name: QualifiedName) {
    if (name.isShell)
      throw new ArgumentException(Resources.secretNameInvalid, Resources.nameField);

    this.name = name;
  }

  public static fromJson(value: unknown, path?: string): SecretReference {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SecretReference.FIELDS);
    return WireContract.create(reader, () => new SecretReference(QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField)));
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name.text };
  }
}

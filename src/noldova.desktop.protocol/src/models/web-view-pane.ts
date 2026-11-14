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

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { QualifiedName } from "./qualified-name.js";

export class WebViewPane {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.instanceField];

  public readonly name: QualifiedName;
  public readonly instance: string | null;

  public constructor(name: QualifiedName, instance: string | null = null) {
    if (!Object.isNull(instance) && String.isNullOrWhitespace(instance))
      throw new ArgumentException(Resources.webViewInstanceInvalid, Resources.instanceField);

    this.name = name;
    this.instance = instance;
  }

  public static fromJson(value: unknown, path?: string): WebViewPane {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewPane.FIELDS);
    return WireContract.create(reader, () => new WebViewPane(
      QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField),
      reader.hasField(Resources.instanceField) ? reader.readString(Resources.instanceField) : null));
  }

  public equals(other: WebViewPane): boolean {
    return this.name.text === other.name.text && this.instance === other.instance;
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name.text, ...Object.isNull(this.instance) ? {} : { [Resources.instanceField]: this.instance } };
  }
}

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

export class SettingOption {
  private static readonly FIELDS: readonly string[] = [Resources.valueField, Resources.titleField];

  public readonly value: string;
  public readonly title: string;

  public constructor(value: string, title: string) {
    const isValueBlank = value.length > 0 && String.isNullOrWhitespace(value);
    if (isValueBlank || String.isNullOrWhitespace(title))
      throw new ArgumentException(Resources.settingOptionsInvalid, isValueBlank ? Resources.valueField : Resources.titleField);

    this.value = value;
    this.title = title;
  }

  public static fromJson(value: unknown, path?: string): SettingOption {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, SettingOption.FIELDS);
    return WireContract.create(reader, () => new SettingOption(reader.readString(Resources.valueField), reader.readString(Resources.titleField)));
  }

  public toJson(): JsonObject {
    return { [Resources.valueField]: this.value, [Resources.titleField]: this.title };
  }
}

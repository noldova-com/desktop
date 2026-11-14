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
import { KeyChord } from "./key-chord.js";

export class AppShortcut {
  private static readonly FIELDS: readonly string[] = [Resources.keyField, Resources.commandField, Resources.isGlobalField];

  public readonly key: KeyChord;
  public readonly command: string | null;
  public readonly isGlobal: boolean;

  public constructor(key: KeyChord, command: string | null, isGlobal: boolean) {
    if (!Object.isNull(command))
      ArgumentException.throwIfNullOrWhitespace(command, Resources.commandField);

    this.key = key;
    this.command = command;
    this.isGlobal = isGlobal;
  }

  public static fromJson(value: unknown, path?: string): AppShortcut {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, AppShortcut.FIELDS);
    return WireContract.create(reader, () => new AppShortcut(
      KeyChord.parse(reader.readString(Resources.keyField), Resources.keyField),
      reader.readNullableString(Resources.commandField),
      reader.readBoolean(Resources.isGlobalField)));
  }

  public toJson(): JsonObject {
    return { [Resources.keyField]: this.key.text, [Resources.commandField]: this.command, [Resources.isGlobalField]: this.isGlobal };
  }
}

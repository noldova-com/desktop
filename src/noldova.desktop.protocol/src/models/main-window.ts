/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class MainWindow {
  private static readonly FIELDS: readonly string[] = [Resources.titleField, Resources.isVisibleField, Resources.isPaintedField];

  public readonly title: string;
  public readonly isVisible: boolean;
  public readonly isPainted: boolean;

  public constructor(title: string, isVisible: boolean, isPainted: boolean) {
    this.title = title;
    this.isVisible = isVisible;
    this.isPainted = isPainted;
  }

  public static fromJson(value: unknown, path?: string): MainWindow {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, MainWindow.FIELDS);
    return new MainWindow(reader.readString(Resources.titleField), reader.readBoolean(Resources.isVisibleField), reader.readBoolean(Resources.isPaintedField));
  }

  public toJson(): JsonObject {
    return { [Resources.titleField]: this.title, [Resources.isVisibleField]: this.isVisible, [Resources.isPaintedField]: this.isPainted };
  }
}

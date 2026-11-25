/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class ProductTrayItem {
  public readonly item: string | null;
  public readonly isSeparator: boolean;
  public readonly text: string | null;
  public readonly toggledText: string | null;
  public readonly command: string | null;
  public readonly icon: string | null;
  public readonly iconDark: string | null;
  public readonly isTemplate: boolean;

  private constructor(reader: JsonReader) {
    this.item = reader.readOptionalString(Resources.trayItemField) ?? null;
    this.isSeparator = reader.hasField(Resources.traySeparatorField) && reader.readBoolean(Resources.traySeparatorField);
    this.text = reader.readOptionalString(Resources.trayTextField) ?? null;
    this.toggledText = reader.readOptionalString(Resources.trayToggledTextField) ?? null;
    this.command = reader.readOptionalString(Resources.trayCommandField) ?? null;
    this.icon = reader.readOptionalString(Resources.trayIconField) ?? null;
    this.iconDark = reader.readOptionalString(Resources.trayIconDarkField) ?? null;
    this.isTemplate = reader.hasField(Resources.trayIsTemplateField) && reader.readBoolean(Resources.trayIsTemplateField);
  }

  public static fromJson(value: unknown, path?: string): ProductTrayItem {
    return new ProductTrayItem(JsonReader.fromValue(value, path));
  }
}

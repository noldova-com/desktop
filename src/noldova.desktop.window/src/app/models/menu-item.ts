/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";
import { QualifiedName } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.js";

export class MenuItem {
  public readonly command: string | null;
  public readonly commandArguments: JsonObject;
  public readonly submenu: string | null;
  public readonly label: string | null;
  public readonly choice: string | null;
  public readonly icon: string | null;

  private constructor(command: string | null, commandArguments: JsonObject, submenu: string | null, label: string | null, choice: string | null, icon: string | null) {
    this.command = command;
    this.commandArguments = commandArguments;
    this.submenu = submenu;
    this.label = label;
    this.choice = choice;
    this.icon = icon;
  }

  public static ofCommand(command: string, commandArguments: JsonObject = {}, label: string | null = null, icon: string | null = null): MenuItem {
    if (!Object.isNull(label))
      ArgumentException.throwIfNullOrWhitespace(label, Resources.labelParameter);
    if (!Object.isNull(icon))
      ArgumentException.throwIfNullOrWhitespace(icon, Resources.iconParameter);
    return new MenuItem(QualifiedName.parse(command, Resources.commandParameter).text, { ...commandArguments }, null, label, null, icon);
  }

  public static ofSubmenu(place: string): MenuItem {
    return new MenuItem(null, {}, QualifiedName.parse(place, Resources.submenuParameter).text, null, null, null);
  }

  public static ofChoice(place: string): MenuItem {
    return new MenuItem(null, {}, null, null, QualifiedName.parse(place, Resources.choiceParameter).text, null);
  }
}

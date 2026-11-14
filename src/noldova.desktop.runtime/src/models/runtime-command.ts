/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { CommandInfo, KeyChord, QualifiedName } from "@noldova/desktop.protocol";

import type { IMethodHandler } from "../interfaces/i-method-handler.js";
import { Resources } from "../resources.js";
import { Registration } from "./registration.js";

export class RuntimeCommand {
  private readonly listeners: Set<() => void> = new Set();
  private infoValue: CommandInfo;

  public readonly handler: IMethodHandler;
  public readonly onlyFor: string | null;

  public constructor(name: string, title: string, icon: string | null, defaultKey: string | null, handler: IMethodHandler, isChecked: boolean | null = null,
    onlyFor: string | null = null) {
    this.infoValue = new CommandInfo(
      QualifiedName.parse(name, Resources.nameParameterName),
      title,
      icon,
      Object.isNull(defaultKey) ? null : KeyChord.parseDefault(defaultKey, Resources.defaultKeyParameterName),
      true,
      isChecked);
    this.handler = handler;
    this.onlyFor = onlyFor;
  }

  public get info(): CommandInfo {
    return this.infoValue;
  }

  public setEnabled(isEnabled: boolean): void {
    const info = this.infoValue;
    if (isEnabled === info.isEnabled)
      return;
    this.infoValue = new CommandInfo(info.name, info.title, info.icon, info.defaultKey, isEnabled, info.isChecked);
    for (const listener of [...this.listeners])
      listener();
  }

  public onChanged(listener: () => void): Registration {
    const entry = (): void => listener();
    this.listeners.add(entry);
    return new Registration(() => this.listeners.delete(entry));
  }
}

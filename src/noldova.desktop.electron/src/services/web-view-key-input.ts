/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import type { KeyboardInputEvent } from "electron";

import type { IWebViewInput } from "../interfaces/i-web-view-input.js";
import type { IWebViewKeyEvent } from "../interfaces/i-web-view-key-event.js";
import { Resources } from "../resources.js";

export class WebViewKeyInput {
  public static read(params: JsonObject): readonly IWebViewKeyEvent[] {
    const key = WebViewKeyInput.readText(params[Resources.keyField]);
    const text = WebViewKeyInput.readText(params[Resources.textField]);
    const flags = Number.isSafeInteger(params[Resources.modifiersField]) ? Number(params[Resources.modifiersField]) : 0;
    const modifiers = [
      ...Resources.keyModifierNames.filter(([flag]) => (flags & flag) !== 0).map(([, name]) => name),
      ...params[Resources.autoRepeatField] === true ? [Resources.autoRepeatModifier] : []
    ];
    const keyCode = Resources.webViewKeyNames.get(key) ?? key;
    const press = (type: "keyDown" | "keyUp"): IWebViewKeyEvent[] => keyCode.length === 0 ? [] : [{ type, keyCode, modifiers }];
    const type = params[Resources.typeField];
    if (type === Resources.rawKeyDownType)
      return press("keyDown");
    if (type === Resources.keyDownType)
      return keyCode.length === 0 ? [] : [...press("keyDown"), ...WebViewKeyInput.type(text, modifiers)];
    if (type === Resources.charType)
      return WebViewKeyInput.type(text.length > 0 ? text : key, modifiers);
    return type === Resources.keyUpType ? press("keyUp") : [];
  }

  public static fromInput(input: IWebViewInput, platform: string): readonly IWebViewKeyEvent[] {
    const flags = (input.alt ? Resources.altModifier : 0) | (input.control ? Resources.ctrlModifier : 0) | (input.meta ? Resources.metaModifier : 0) | (input.shift ? Resources.shiftModifier : 0);
    const modifiers = [
      ...Resources.keyModifierNames.filter(([flag]) => (flags & flag) !== 0).map(([, name]) => name),
      ...input.isAutoRepeat ? [Resources.autoRepeatModifier] : []
    ];
    const keyCode = Resources.webViewKeyNames.get(input.key) ?? input.key;
    if (!Resources.keyDownInputs.includes(input.type))
      return [{ type: "keyUp", keyCode, modifiers }];
    const text = Resources.webViewKeyTexts.get(input.key) ?? input.key;
    const typesText = [...text].length === 1 && !input.meta && (input.alt ? input.control || platform === Resources.macPlatform : !input.control);
    return [{ type: "keyDown", keyCode, modifiers }, ...typesText ? WebViewKeyInput.type(text, modifiers) : []];
  }

  private static type(text: string, modifiers: readonly NonNullable<KeyboardInputEvent["modifiers"]>[number][]): IWebViewKeyEvent[] {
    return [...text].map(t => ({ type: "char", keyCode: t, modifiers }));
  }

  private static readText(value: unknown): string {
    return Object.isString(value) ? value : String.empty;
  }
}

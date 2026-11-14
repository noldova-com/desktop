/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class WebViewKeys {
  public static formOn(text: string, isMac: boolean): string | null {
    const tokens = text.split(Resources.keyChordSeparator);
    const key = String(tokens.pop());
    const has = (modifier: string): boolean => tokens.includes(modifier);
    if (!Resources.webViewKeyNames.includes(key) || new Set(tokens).size !== tokens.length || tokens.some(t => !Resources.webViewKeyModifiers.includes(t))
      || (has(Resources.modKey) && has(Resources.ctrlKey)))
      return null;
    const control = isMac
      ? [has(Resources.ctrlKey) ? Resources.ctrlKey : String.empty, has(Resources.modKey) ? Resources.modKey : String.empty]
      : [has(Resources.modKey) || has(Resources.ctrlKey) ? Resources.ctrlKey : String.empty];
    return [...control, has(Resources.altKey) ? Resources.altKey : String.empty, has(Resources.shiftKey) ? Resources.shiftKey : String.empty, key].filter(t => t !== String.empty).join(Resources.keyChordSeparator);
  }

  public static isTyping(form: string): boolean {
    const tokens = form.split(Resources.keyChordSeparator);
    return !tokens.some(t => t === Resources.modKey || t === Resources.ctrlKey || t === Resources.altKey) && !Resources.functionKeyPattern.test(String(tokens.at(-1)));
  }

  public static refusedOn(isMac: boolean): readonly string[] {
    return [
      ...Resources.webViewEditingKeys,
      ...isMac ? Resources.webViewMacSystemKeys : Resources.webViewStandardSystemKeys,
      ...Resources.webViewShellKeys.flatMap(t => (isMac ? t[2] : t[1])),
      Resources.webViewStopAgentControlKey
    ].map(t => String(WebViewKeys.formOn(t, isMac)));
  }
}

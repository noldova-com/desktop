/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly allowMethod: string = "pages.allow";
  public static readonly navigateMethod: string = "pages.navigate";
  public static readonly listMethod: string = "pages.list";
  public static readonly captureMethod: string = "pages.capture";
  public static readonly eventsMethod: string = "pages.events";
  public static readonly pressMethod: string = "pages.press";
  public static readonly typeMethod: string = "pages.type";
  public static readonly dispatchKeyEventMethod: string = "Input.dispatchKeyEvent";
  public static readonly insertTextMethod: string = "Input.insertText";
  public static readonly keyTypes: readonly string[] = ["rawKeyDown", "keyUp"];
  public static readonly captureScreenshotMethod: string = "Page.captureScreenshot";
  public static readonly imageFormat: string = "png";
  public static readonly captureTimeout: number = 5_000;
  public static readonly viewField: string = "view";
  public static readonly urlField: string = "url";
  public static readonly keyField: string = "key";
  public static readonly codeField: string = "code";
  public static readonly textField: string = "text";
  public static readonly nativeKeyCodeField: string = "nativeKeyCode";
  public static readonly dataField: string = "data";
  public static readonly noViewMessage: string = "The pages fixture has no web view at that place in its list.";
}

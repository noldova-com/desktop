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
  public static readonly refusalsMethod: string = "pages.refusals";
  public static readonly navigationRefusedKind: string = "NavigationRefused";
  public static readonly addressField: string = "address";
  public static readonly fromPressField: string = "fromPress";
  public static readonly windowsMethod: string = "pages.windows";
  public static readonly newWindowRequestedKind: string = "NewWindowRequested";
  public static readonly fromLinkField: string = "fromLink";
  public static readonly pressMethod: string = "pages.press";
  public static readonly typeMethod: string = "pages.type";
  public static readonly clickMethod: string = "pages.click";
  public static readonly moveMethod: string = "pages.move";
  public static readonly focusMethod: string = "pages.focus";
  public static readonly controlMethod: string = "pages.control";
  public static readonly dispatchMouseEventMethod: string = "Input.dispatchMouseEvent";
  public static readonly mouseTypes: readonly string[] = ["mousePressed", "mouseReleased"];
  public static readonly moveType: string = "mouseMoved";
  public static readonly evaluateMethod: string = "Runtime.evaluate";
  public static readonly focusNodeMethod: string = "DOM.focus";
  public static readonly dispatchKeyEventMethod: string = "Input.dispatchKeyEvent";
  public static readonly insertTextMethod: string = "Input.insertText";
  public static readonly keyTypes: readonly string[] = ["rawKeyDown", "keyUp"];
  public static readonly captureScreenshotMethod: string = "Page.captureScreenshot";
  public static readonly imageFormat: string = "png";
  public static readonly captureTimeout: number = 5_000;
  public static readonly viewField: string = "view";
  public static readonly urlField: string = "url";
  public static readonly isControlledField: string = "isControlled";
  public static readonly keyField: string = "key";
  public static readonly codeField: string = "code";
  public static readonly textField: string = "text";
  public static readonly xField: string = "x";
  public static readonly yField: string = "y";
  public static readonly idField: string = "id";
  public static readonly resultField: string = "result";
  public static readonly objectIdField: string = "objectId";
  public static readonly leftButton: string = "left";
  public static readonly noButton: string = "none";
  public static readonly noElementMessage: string = "The page has no element with that id.";
  public static readonly nativeKeyCodeField: string = "nativeKeyCode";
  public static readonly dataField: string = "data";
  public static readonly noViewMessage: string = "The pages fixture has no web view at that place in its list.";
}

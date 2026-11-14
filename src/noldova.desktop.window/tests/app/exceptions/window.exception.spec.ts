/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { UnconfirmedAction } from "../../../src/app/enums/unconfirmed-action";
import { ViewDialogRefusal } from "../../../src/app/enums/view-dialog-refusal";
import { ActionNotConfirmedException } from "../../../src/app/exceptions/action-not-confirmed.exception";
import { CommandNotFoundException } from "../../../src/app/exceptions/command-not-found.exception";
import { FileNotOpenedException } from "../../../src/app/exceptions/file-not-opened.exception";
import { FileNotShownException } from "../../../src/app/exceptions/file-not-shown.exception";
import { ForeignNameException } from "../../../src/app/exceptions/foreign-name.exception";
import { InAppBrowserTakenException } from "../../../src/app/exceptions/in-app-browser-taken.exception";
import { LinkNotOpenedException } from "../../../src/app/exceptions/link-not-opened.exception";
import { PreloadBridgeException } from "../../../src/app/exceptions/preload-bridge.exception";
import { ProductNameException } from "../../../src/app/exceptions/product-name.exception";
import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";
import { ViewDialogException } from "../../../src/app/exceptions/view-dialog.exception";
import { WebViewClosedException } from "../../../src/app/exceptions/web-view-closed.exception";
import { WebViewNotOpenedException } from "../../../src/app/exceptions/web-view-not-opened.exception";
import { WindowPartLoadFailedException } from "../../../src/app/exceptions/window-part-load-failed.exception";
import { WindowException } from "../../../src/app/exceptions/window.exception";

describe("WindowException", () => {
  it("is the boundary of every failure the window owns, each named after its own class", () => {
    const failures: Error[] = [
      new ActionNotConfirmedException(UnconfirmedAction.Command, "notes.save", new Error("Gone.")),
      new CommandNotFoundException("notes.missing"),
      new FileNotOpenedException("Sample App", "The file is gone."),
      new FileNotShownException("Sample App", "The file is gone."),
      new InAppBrowserTakenException(),
      new LinkNotOpenedException("Sample App"),
      new PreloadBridgeException(),
      new ProductNameException(),
      new RuntimeDisconnectedException("Not connected."),
      new RuntimeRequestException("Unavailable", "The runtime did not answer."),
      new ViewDialogException(ViewDialogRefusal.AlreadyOpen),
      new WebViewClosedException(),
      new WebViewNotOpenedException(),
      new ForeignNameException("notes", "clock.time"),
      new WindowPartLoadFailedException("notes", new Error("Load failed."))
    ];

    expect(failures.map(t => [t instanceof WindowException, t instanceof Exception, t.name])).toEqual([
      [true, true, "ActionNotConfirmedException"],
      [true, true, "CommandNotFoundException"],
      [true, true, "FileNotOpenedException"],
      [true, true, "FileNotShownException"],
      [true, true, "InAppBrowserTakenException"],
      [true, true, "LinkNotOpenedException"],
      [true, true, "PreloadBridgeException"],
      [true, true, "ProductNameException"],
      [true, true, "RuntimeDisconnectedException"],
      [true, true, "RuntimeRequestException"],
      [true, true, "ViewDialogException"],
      [true, true, "WebViewClosedException"],
      [true, true, "WebViewNotOpenedException"],
      [true, true, "ForeignNameException"],
      [true, true, "WindowPartLoadFailedException"]
    ]);
  });

  it("leaves a failure the window does not own outside its boundary", () => {
    expect([new Error("A defect."), new TypeError("Not a function.")].map(t => t instanceof WindowException)).toEqual([false, false]);
  });
});

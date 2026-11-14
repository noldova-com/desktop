/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeMainProcessWindow } from "./fake-main-process-window.fixture.js";

export class FailingLoadWindow extends FakeMainProcessWindow {
  public static readonly message: string = "ERR_FILE_NOT_FOUND (-6) loading the window's page";

  public override loadFile(filePath: string): Promise<void> {
    this.loadedFile = filePath;
    return Promise.reject(new Error(FailingLoadWindow.message));
  }
}

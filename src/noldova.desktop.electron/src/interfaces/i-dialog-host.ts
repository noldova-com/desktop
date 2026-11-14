/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageBoxOptions, MessageBoxReturnValue, OpenDialogOptions, OpenDialogReturnValue, SaveDialogOptions, SaveDialogReturnValue } from "electron";

export interface IDialogHost {
  showMessageBox(windowId: number | null, options: MessageBoxOptions): Promise<MessageBoxReturnValue>;
  showOpenDialog(windowId: number, options: OpenDialogOptions): Promise<OpenDialogReturnValue>;
  showSaveDialog(windowId: number, options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
}

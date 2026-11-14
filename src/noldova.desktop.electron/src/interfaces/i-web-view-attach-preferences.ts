/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IWebViewAttachPreferences {
  preload?: string;
  preloadURL?: string;
  nodeIntegration?: boolean;
  nodeIntegrationInSubFrames?: boolean;
  nodeIntegrationInWorker?: boolean;
  contextIsolation?: boolean;
  sandbox?: boolean;
  webviewTag?: boolean;
  navigateOnDragDrop?: boolean;
  safeDialogs?: boolean;
  zoomMode?: string;
}

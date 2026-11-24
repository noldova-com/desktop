/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What the app shows at the start of the title bar, each part optional. */
export interface IProductTitleBar {
  /** The app's name, or null to show none. */
  readonly name: string | null;
  /** The icon's address beside the window's files, such as `title-bar/icon.svg`, or a data: URL; null to show none. */
  readonly icon: string | null;
}

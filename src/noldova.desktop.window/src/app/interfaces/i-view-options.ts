/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IViewOptions {
  readonly hasInstances?: boolean;
  readonly tabRowPlace?: string;
  readonly isRenamable?: boolean;
  readonly defaultGroup?: number;
  readonly defaultOrder?: number;
  readonly preferredWidth?: number;
}

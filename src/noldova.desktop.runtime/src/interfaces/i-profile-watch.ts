/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IProfileWatch extends Disposable {
  followAsync(zshFolder: string | undefined): Promise<boolean>;
  readStampAsync(): Promise<string>;
}

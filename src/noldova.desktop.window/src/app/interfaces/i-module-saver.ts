/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IModuleSaver {
  saveModulesAsync(moduleIds: ReadonlySet<string>, formatFailed: (moduleName: string) => string): Promise<boolean>;
}

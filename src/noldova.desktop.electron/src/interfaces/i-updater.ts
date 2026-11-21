/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IUpdater {
  readonly downloadedFile: string | null;
  formatPackagePath(version: string): string;
  readSignature(file: string): string | null;
  checkAsync(): Promise<string | null>;
  downloadAsync(version: string, onProgress: (percent: number) => void): Promise<string>;
  cancel(): void;
}

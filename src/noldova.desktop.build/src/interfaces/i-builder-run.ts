/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IBuilderRun {
  readonly config: string;
  readonly publish: "never";
  readonly effectiveOptionComputed: (options: unknown) => Promise<boolean>;
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProductIdentity } from "../models/packages/product-identity.ts";

export interface IPackageSigning {
  readonly builderEnvironment: NodeJS.ProcessEnv;
  readonly windowsPublisher: string | null;
  readonly updateKeys: readonly string[];
  prepareAsync(): Promise<void>;
  finishAsync(packages: readonly string[]): Promise<string>;
  verifyAsync(packages: readonly string[], product: ProductIdentity): Promise<string>;
  disposeAsync(): Promise<void>;
}

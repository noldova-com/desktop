/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentRef } from "@angular/core";

export interface IWindowPalette<T> {
  readonly componentRef: ComponentRef<T>;
  readonly closed: Promise<void>;
  close(): void;
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { SettingChange, SettingScope } from "@noldova/desktop.protocol";

export interface IModuleSettings {
  readonly isDeviceKnown: boolean;

  read(name: string, scope?: SettingScope | null, device?: string | null): JsonValue;

  write(name: string, value: JsonValue, scope?: SettingScope | null, device?: string | null): void;

  reset(name: string, scope?: SettingScope | null, device?: string | null): void;

  onChanged(name: string, listener: (change: SettingChange) => void): void;

  onDeviceKnown(listener: () => void): void;

  setScopeParent(scope: SettingScope, parent: SettingScope | null): void;

  removeScope(scope: SettingScope): void;
}

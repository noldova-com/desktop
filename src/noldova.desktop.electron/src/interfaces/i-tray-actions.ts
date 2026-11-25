/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { QualifiedName } from "@noldova/desktop.protocol";

export interface ITrayActions {
  open(): void;
  openNotification(id: string): void;
  setDoNotDisturb(isOn: boolean): void;
  stopAgents(): void;
  resumeAgents(): void;
  restartToUpdate(): void;
  quit(): void;
  runCommand(command: QualifiedName): void;
}

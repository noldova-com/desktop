/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QualifiedName, ShellKeys } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.js";

export class ShellCommands {
  public static readonly stopAgentControl: QualifiedName = ShellCommands.named(Resources.stopAgentControlMember);
  public static readonly resumeAgentControl: QualifiedName = ShellCommands.named(Resources.resumeAgentControlMember);
  public static readonly stopAgentControlKey: string = ShellKeys.stopAgentControl.text;

  private static named(member: string): QualifiedName {
    return new QualifiedName(Resources.reservedModuleId, member);
  }
}

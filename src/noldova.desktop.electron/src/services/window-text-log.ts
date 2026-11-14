/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { LogText } from "@noldova/desktop.runtime";

import { WindowErrorAdmission } from "../enums/window-error-admission.js";
import { Resources } from "../resources.js";
import type { OpenWindow } from "./open-window.js";

export class WindowTextLog {
  private readonly log: (text: string) => void;

  public constructor(log: (text: string) => void) {
    this.log = log;
  }

  public writeModuleLog(open: OpenWindow | null, moduleId: unknown, message: unknown): void {
    if (!Object.isNull(open) && WindowTextLog.isModuleId(moduleId) && Object.isString(message))
      this.write(message, t => Resources.formatModuleLogLine(moduleId, t));
  }

  public writeWindowError(open: OpenWindow | null, moduleId: unknown, text: unknown): void {
    if (Object.isNull(open) || !(Object.isNull(moduleId) || WindowTextLog.isModuleId(moduleId)) || !Object.isString(text))
      return;
    const admission = open.errors.admit();
    if (admission === WindowErrorAdmission.Write)
      this.write(text, t => Resources.formatWindowErrorLine(moduleId, t));
    else if (admission === WindowErrorAdmission.Notice)
      this.log(Resources.windowErrorsLeftOut);
  }

  private write(text: string, format: (line: string) => string): void {
    this.log(LogText.lines(text.slice(0, Resources.windowLogLimit)).map(format).join(Resources.logLineSeparator));
  }

  private static isModuleId(value: unknown): value is string {
    return Object.isString(value) && Resources.moduleIdPattern.test(value);
  }
}

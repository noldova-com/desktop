/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionDecision } from "../enums/permission-decision.js";
import type { PermissionQuestion } from "../models/permission-question.js";

export interface IPermissionAnswerer {
  answerAsync(question: PermissionQuestion, signal: AbortSignal): Promise<PermissionDecision>;
}

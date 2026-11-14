/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { RegistrationException } from "./registration.exception.js";

export class NotificationKindChangedException extends RegistrationException {
  public readonly notificationId: string;
  public readonly kind: string;

  public constructor(notificationId: string, kind: string, options?: ExceptionOptions) {
    super(Resources.formatNotificationKindChanged(notificationId, kind), options);

    this.notificationId = notificationId;
    this.kind = kind;
  }
}

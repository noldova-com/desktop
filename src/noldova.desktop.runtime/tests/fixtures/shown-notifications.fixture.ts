/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import type { NotificationPost } from "@noldova/desktop.protocol";

import type { IRuntimePartContext } from "../../src/interfaces/i-runtime-part-context.js";
import type { ModuleDeclaration } from "../../src/models/module-declaration.js";
import { NotificationHandle } from "../../src/models/notification-handle.js";
import { NotificationCenter } from "../../src/services/notifications/notification-center.js";
import { NotificationPolicy } from "../../src/services/notifications/notification-policy.js";

export class ShownNotificationsFixture {
  private readonly declaration: ModuleDeclaration;
  private readonly policy: NotificationPolicy;
  private readonly center: NotificationCenter = new NotificationCenter(() => undefined, () => new Date(), randomUUID);

  public readonly postNotification: IRuntimePartContext["postNotification"] = post => {
    this.policy.requireDeclared(this.declaration, post);
    const id = this.center.post(post);
    return new NotificationHandle(id, t => this.update(id, t), () => this.center.dismiss(id));
  };

  public constructor(declaration: ModuleDeclaration) {
    this.declaration = declaration;
    this.policy = new NotificationPolicy([declaration], Boolean);
  }

  public get shown(): readonly NotificationPost[] {
    return this.center.list.notifications.map(t => t.post);
  }

  private update(id: string, post: NotificationPost): boolean {
    this.policy.requireDeclared(this.declaration, post);
    return this.center.update(id, post);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type CommandRun, type NotificationPost, type QualifiedName, ShellNotifications } from "@noldova/desktop.protocol";

import { NotContributedException } from "../../exceptions/not-contributed.exception.js";
import { NotificationCommandNotAllowedException } from "../../exceptions/notification-command-not-allowed.exception.js";
import type { RegistrationException } from "../../exceptions/registration.exception.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { Resources } from "../../resources.js";

export class NotificationPolicy {
  private static readonly COMMANDLESS_KINDS: readonly QualifiedName[] = [ShellNotifications.saveFailed, ShellNotifications.saveUnfinished];

  private readonly declarations: readonly ModuleDeclaration[];
  private readonly isActive: (moduleId: string) => boolean;

  public constructor(declarations: readonly ModuleDeclaration[], isActive: (moduleId: string) => boolean) {
    this.declarations = declarations;
    this.isActive = isActive;
  }

  public findRefusal(post: NotificationPost): string | null {
    if (post.kind.isShell)
      return NotificationPolicy.findShellRefusal(post);
    const declaration = this.declarations.find(t => t.id === post.kind.owner);
    if (Object.isUndefined(declaration) || !this.isActive(declaration.id))
      return Resources.formatNotificationModuleInactive(post.kind.owner, post.kind.text);
    const refusal = NotificationPolicy.findDeclaredRefusal(declaration, post);
    return Object.isNull(refusal) ? null : refusal.message;
  }

  public requireDeclared(declaration: ModuleDeclaration, post: NotificationPost): void {
    const refusal = NotificationPolicy.findDeclaredRefusal(declaration, post);
    if (!Object.isNull(refusal))
      throw refusal;
  }

  private static findShellRefusal(post: NotificationPost): string | null {
    if (!ShellNotifications.all.some(t => t.text === post.kind.text))
      return Resources.formatShellNotificationUnknown(post.kind.text);
    const commands = NotificationPolicy.commandsOf(post);
    if (NotificationPolicy.COMMANDLESS_KINDS.some(t => t.text === post.kind.text))
      return commands.length === 0 ? null : Resources.formatShellNotificationCommand(post.kind.text);
    const refused = commands.find(t => !t.name.isShell);
    return Object.isUndefined(refused) ? null : Resources.formatShellNotificationModuleCommand(post.kind.text, refused.name.text);
  }

  private static findDeclaredRefusal(declaration: ModuleDeclaration, post: NotificationPost): RegistrationException | null {
    if (!declaration.listContributions(Resources.notificationsKind).includes(post.kind.text))
      return new NotContributedException(declaration.id, Resources.notificationsKind, post.kind.text);
    const refused = NotificationPolicy.commandsOf(post).find(t => t.name.owner !== declaration.id && !declaration.dependencies.includes(t.name.owner));
    return Object.isUndefined(refused) ? null : new NotificationCommandNotAllowedException(declaration.id, refused.name.text);
  }

  private static commandsOf(post: NotificationPost): readonly CommandRun[] {
    return [...Object.isNull(post.open) ? [] : [post.open], ...post.actions.map(t => t.command)];
  }
}

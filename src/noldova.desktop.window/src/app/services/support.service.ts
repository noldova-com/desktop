/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, inject } from "@angular/core";

import "@noldova/context.core";
import { CommandRun, NotificationAction, NotificationPost, NotificationReference, NotificationSeverity, QualifiedName, ShellMethods, ShellNotifications } from "@noldova/desktop.protocol";

import { ProductName } from "../models/product-name.js";
import { Resources } from "../../resources.js";
import { DetailsService } from "./details.service.js";
import { ModuleStatusService } from "./module-status.service.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";

@Injectable({ providedIn: "root" })
export class SupportService {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly details: DetailsService = inject(DetailsService);
  private readonly moduleStatus: ModuleStatusService = inject(ModuleStatusService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly failures: Map<string, string> = new Map();
  private readonly runs: Map<string, Promise<unknown>> = new Map();
  private readonly waiting: Map<string, Promise<boolean>> = new Map();

  public openLogFolderAsync(): Promise<boolean> {
    return this.runAsync(Resources.openLogFolderCommand, async () => {
      const isDone = await this.bridge.openLogFolderAsync();
      await this.reportAsync(Resources.openLogFolderCommand, isDone, isDone ? null : new NotificationPost(ShellNotifications.support, Resources.openLogFolderCommand,
        Resources.logFolderNotOpenedTitle, Resources.formatLogFolderNotOpenedText(ProductName.current), NotificationSeverity.Warning, null,
        [SupportService.action(Resources.tryAgain, Resources.openLogFolderCommand), SupportService.action(Resources.copyDetailsLabel, Resources.copyDetailsCommand)], null));
      return isDone;
    });
  }

  public copyDetailsAsync(): Promise<boolean> {
    return this.runAsync(Resources.copyDetailsCommand, async () => {
      const isDone = await this.details.copyAsync(this.moduleStatus.modules());
      await this.reportAsync(Resources.copyDetailsCommand, isDone, isDone
        ? new NotificationPost(ShellNotifications.support, Resources.copyDetailsCommand, Resources.detailsCopiedTitle, null, NotificationSeverity.Success, null, [], null)
        : new NotificationPost(ShellNotifications.support, Resources.copyDetailsCommand, Resources.detailsNotCopiedTitle, Resources.detailsNotCopiedText,
          NotificationSeverity.Warning, null,
          [SupportService.action(Resources.tryAgain, Resources.copyDetailsCommand), SupportService.action(Resources.openLogFolderLabel, Resources.openLogFolderCommand)], null));
      return isDone;
    });
  }

  private runAsync(command: string, run: () => Promise<boolean>): Promise<boolean> {
    const waiting = this.waiting.get(command);
    if (!Object.isUndefined(waiting))
      return waiting;
    const running = (this.runs.get(command) ?? Promise.resolve()).then(() => {
      this.waiting.delete(command);
      return run();
    });
    this.waiting.set(command, running);
    this.runs.set(command, running.catch(() => undefined));
    return running;
  }

  private async reportAsync(command: string, isDone: boolean, post: NotificationPost | null): Promise<void> {
    try {
      const failure = this.failures.get(command);
      this.failures.delete(command);
      if (isDone && !Object.isUndefined(failure))
        await this.bridge.requestAsync(ShellMethods.dismissNotification.text, new NotificationReference(failure).toJson());
      if (Object.isNull(post))
        return;
      const id = NotificationReference.fromJson(await this.bridge.requestAsync(ShellMethods.postNotification.text, post.toJson())).id;
      if (!isDone)
        this.failures.set(command, id);
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private static action(title: string, command: string): NotificationAction {
    return new NotificationAction(title, new CommandRun(QualifiedName.parse(command), null));
  }
}

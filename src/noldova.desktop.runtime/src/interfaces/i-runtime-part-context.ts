/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NotificationPost } from "@noldova/desktop.protocol";

import type { ClientClosure } from "../models/client-closure.js";
import type { EventChannel } from "../models/event-channel.js";
import type { NotificationHandle } from "../models/notification-handle.js";
import type { OwnedProcess } from "../models/owned-process.js";
import type { ProcessRequest } from "../models/process-request.js";
import type { PseudoTerminal } from "../models/pseudo-terminal.js";
import type { PseudoTerminalRequest } from "../models/pseudo-terminal-request.js";
import type { RuntimeCommand } from "../models/runtime-command.js";
import type { WorkItem } from "../models/work-item.js";
import type { IAppShortcuts } from "./i-app-shortcuts.js";
import type { IAppWindows } from "./i-app-windows.js";
import type { IMethodHandler } from "./i-method-handler.js";
import type { IModuleDatabase } from "./i-module-database.js";
import type { IModuleLog } from "./i-module-log.js";
import type { IModuleSecrets } from "./i-module-secrets.js";
import type { IModuleSettings } from "./i-module-settings.js";
import type { IPermissionsContext } from "./i-permissions-context.js";
import type { IRuntimeFiles } from "./i-runtime-files.js";
import type { IRuntimeWebViews } from "./i-runtime-web-views.js";
import type { IToolsContext } from "./i-tools-context.js";

export interface IRuntimePartContext {
  readonly moduleId: string;
  readonly moduleFolder: string;
  readonly database: IModuleDatabase;

  readonly settings: IModuleSettings;

  readonly log: IModuleLog;

  readonly tools: IToolsContext;

  readonly permissions: IPermissionsContext;

  readonly webViews: IRuntimeWebViews;

  readonly files: IRuntimeFiles;

  readonly secrets: IModuleSecrets;

  readonly appWindows: IAppWindows;

  readonly shortcuts: IAppShortcuts;

  getWorkFolderAsync(): Promise<string>;

  beginWork(description: string): WorkItem;

  readEnvironmentAsync(): Promise<Readonly<Record<string, string>>>;

  startProcessAsync(request: ProcessRequest): Promise<OwnedProcess>;

  startPseudoTerminalAsync(request: PseudoTerminalRequest): Promise<PseudoTerminal>;

  registerMethod(name: string, handler: IMethodHandler): void;

  declareEvent(name: string): EventChannel;

  registerCommand(command: RuntimeCommand): void;

  onClientClosed(listener: (closure: ClientClosure) => void | Promise<void>): void;

  postNotification(post: NotificationPost): NotificationHandle;

  publishService(name: string, service: object): void;

  getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T;

  findService<T extends object>(name: string, guard: (service: object) => service is T): T | null;

  onDependencyChanged(listener: (moduleId: string, isActive: boolean) => void): () => void;
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { inspect } from "node:util";

import "@noldova/context.core";

import { PermissionDecision } from "../../enums/permission-decision.js";
import { AnswererRegisteredException } from "../../exceptions/answerer-registered.exception.js";
import { PermissionsClosedException } from "../../exceptions/permissions-closed.exception.js";
import { PermissionsModuleOnlyException } from "../../exceptions/permissions-module-only.exception.js";
import type { IModuleLog } from "../../interfaces/i-module-log.js";
import type { IPermissionAnswerer } from "../../interfaces/i-permission-answerer.js";
import type { IPermissionRequest } from "../../interfaces/i-permission-request.js";
import { PermissionOutcome } from "../../models/permission-outcome.js";
import { PermissionQuestion } from "../../models/permission-question.js";
import { PermissionRevocation } from "../../models/permission-revocation.js";
import { Registration } from "../../models/registration.js";
import type { RememberedPermission } from "../../models/remembered-permission.js";
import type { ToolDescriptor } from "../../models/tool-descriptor.js";
import type { ToolSession } from "../../models/tool-session.js";
import { Resources } from "../../resources.js";
import { PermissionRequestChecker } from "./permission-request-checker.js";
import type { RememberedPermissionStore } from "./remembered-permission-store.js";

export class PermissionCenter {
  private readonly permissionsModule: string | null;
  private readonly waitMilliseconds: number;
  private readonly waiting: Map<(decision: PermissionDecision) => void, { readonly owner: object; readonly log: IModuleLog; readonly action: string }> = new Map();
  private readonly revokedListeners: Map<string, Set<(revocation: PermissionRevocation) => void>> = new Map();
  private store: RememberedPermissionStore | null = null;
  private answerer: { readonly answerer: IPermissionAnswerer; readonly log: IModuleLog } | null = null;

  public constructor(permissionsModule: string | null = null, waitMilliseconds: number = Resources.permissionWaitMilliseconds) {
    this.permissionsModule = permissionsModule;
    this.waitMilliseconds = waitMilliseconds;
  }

  public open(store: RememberedPermissionStore): void {
    this.store = store;
  }

  public async requestAsync(
    moduleId: string,
    descriptor: ToolDescriptor,
    log: IModuleLog,
    session: ToolSession,
    input: unknown,
    signal: AbortSignal,
    id: string = randomUUID()): Promise<PermissionOutcome> {
    if (signal.aborted)
      return new PermissionOutcome(PermissionDecision.Withdrawn, false, id);
    let request: IPermissionRequest | string;
    try {
      request = PermissionRequestChecker.read(moduleId, descriptor, input);
    }
    catch (error) {
      return PermissionCenter.deny(log, descriptor.name, Resources.formatPermissionUnreadable(inspect(error)), id);
    }
    if (Object.isString(request))
      return PermissionCenter.deny(log, descriptor.name, request, id);

    const subject = request.subject ?? null;
    const remembered = this.findRemembered(moduleId, log, request.action, subject, session.scope);
    if (!Object.isNull(remembered) && !(remembered === PermissionDecision.AllowedAlways && PermissionRequestChecker.isNamedHighRisk(request)))
      return new PermissionOutcome(remembered, true, id);
    if (request.isRememberedOnly === true)
      return new PermissionOutcome(PermissionDecision.Denied, false, id);
    const answerer = this.answerer;
    if (Object.isNull(answerer))
      return PermissionCenter.deny(log, request.action, Resources.permissionNoAnswerer, id);

    const decision = await this.askAsync(answerer, log, new PermissionQuestion(moduleId, session.id, session.scope, request, id), signal);
    return new PermissionOutcome(this.keep(moduleId, log, request.action, subject, session.scope, decision), false, id);
  }

  public withdrawAll(): void {
    for (const finish of [...this.waiting.keys()])
      finish(PermissionDecision.Withdrawn);
  }

  public registerAnswerer(module: string, answerer: IPermissionAnswerer, log: IModuleLog): Registration {
    this.requirePermissionsModule(module);
    if (!Object.isNull(this.answerer))
      throw new AnswererRegisteredException(module);
    const registered = { answerer, log };
    this.answerer = registered;
    return new Registration(() => {
      if (this.answerer !== registered)
        return;
      this.answerer = null;
      for (const [finish, request] of [...this.waiting].filter(t => t[1].owner === registered)) {
        request.log.write(Resources.formatPermissionDenied(request.action, Resources.permissionAnswererWithdrawn));
        finish(PermissionDecision.Denied);
      }
    });
  }

  public requirePermissionsModule(module: string): void {
    if (module !== this.permissionsModule)
      throw new PermissionsModuleOnlyException(module);
  }

  public listRemembered(module: string): readonly RememberedPermission[] {
    this.requirePermissionsModule(module);
    return this.requireStore().list();
  }

  public revoke(module: string, id: string): boolean {
    this.requirePermissionsModule(module);
    const revoked = this.requireStore().forget(id);
    if (Object.isNull(revoked))
      return false;
    const revocation = new PermissionRevocation(revoked.action, revoked.subject, revoked.scope);
    for (const listener of [...this.revokedListeners.get(revoked.module) ?? []])
      listener(revocation);
    return true;
  }

  public onRevoked(module: string, listener: (revocation: PermissionRevocation) => void, log: IModuleLog): Registration {
    const handle = (revocation: PermissionRevocation): void => {
      try {
        listener(revocation);
      }
      catch (error) {
        log.write(Resources.formatPermissionRevokedListenerFailed(inspect(error)));
      }
    };
    const listeners = this.revokedListeners.get(module) ?? new Set();
    listeners.add(handle);
    this.revokedListeners.set(module, listeners);
    return new Registration(() => listeners.delete(handle));
  }

  private askAsync(
    registered: { readonly answerer: IPermissionAnswerer; readonly log: IModuleLog },
    requester: IModuleLog,
    question: PermissionQuestion,
    signal: AbortSignal): Promise<PermissionDecision> {
    const action = question.request.action;
    const log = registered.log;
    return new Promise(resolve => {
      const controller = new AbortController();
      const finish = (decision: PermissionDecision): void => {
        if (!this.waiting.delete(finish))
          return;
        clearTimeout(timer);
        signal.removeEventListener(Resources.abortEvent, withdraw);
        controller.abort();
        resolve(decision);
      };
      const withdraw = (): void => finish(PermissionDecision.Withdrawn);
      const timer = setTimeout(() => finish(PermissionDecision.Expired), this.waitMilliseconds);
      this.waiting.set(finish, { owner: registered, log: requester, action });
      signal.addEventListener(Resources.abortEvent, withdraw, { once: true });
      new Promise<PermissionDecision>(t => t(registered.answerer.answerAsync(question, controller.signal))).then(
        t => finish(PermissionCenter.checkAnswer(log, question.request, t)),
        (error: unknown) => {
          log.write(Resources.formatPermissionAnswererFailed(action, inspect(error)));
          finish(PermissionDecision.Denied);
        });
    });
  }

  private findRemembered(moduleId: string, log: IModuleLog, action: string, subject: string | null, scope: string): PermissionDecision | null {
    try {
      return this.requireStore().find(moduleId, action, subject, scope);
    }
    catch (error) {
      log.write(Resources.formatPermissionReadFailed(action, inspect(error)));
      return null;
    }
  }

  private keep(moduleId: string, log: IModuleLog, action: string, subject: string | null, scope: string, decision: PermissionDecision): PermissionDecision {
    if (!Resources.rememberedDecisions.includes(decision))
      return decision;
    try {
      this.requireStore().remember(moduleId, action, subject, scope, decision);
      return decision;
    }
    catch (error) {
      log.write(Resources.formatPermissionKeepFailed(action, inspect(error)));
      return decision === PermissionDecision.AllowedAlways ? PermissionDecision.AllowedOnce : PermissionDecision.Denied;
    }
  }

  private requireStore(): RememberedPermissionStore {
    if (Object.isNull(this.store))
      throw new PermissionsClosedException();
    return this.store;
  }

  private static checkAnswer(log: IModuleLog, request: IPermissionRequest, decision: PermissionDecision): PermissionDecision {
    const option = Resources.offeredDecisions.get(decision);
    if (Resources.answerableDecisions.includes(decision) && (Object.isUndefined(option) || request.options.includes(option)))
      return decision;
    log.write(Resources.formatPermissionAnswerInvalid(request.action, String(decision)));
    return PermissionDecision.Denied;
  }

  private static deny(log: IModuleLog, action: string, reason: string, id: string): PermissionOutcome {
    log.write(Resources.formatPermissionDenied(action, reason));
    return new PermissionOutcome(PermissionDecision.Denied, false, id);
  }
}

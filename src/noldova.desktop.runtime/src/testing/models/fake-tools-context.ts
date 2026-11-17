/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect } from "node:util";

import "@noldova/context.core";
import { Fake } from "@noldova/desktop.protocol/testing";

import type { TurnOutcome } from "../../enums/turn-outcome.js";
import type { IModuleLog } from "../../interfaces/i-module-log.js";
import type { IToolsContext } from "../../interfaces/i-tools-context.js";
import { Registration } from "../../models/registration.js";
import { Resources } from "../../resources.js";
import { FakeModuleLog } from "./fake-module-log.js";

export class FakeToolsContext extends Fake<IToolsContext> implements IToolsContext {
  private readonly log: IModuleLog;
  private readonly sessionEnded: Set<(session: string) => void> = new Set<(session: string) => void>();
  private readonly sessionStopped: Set<(session: string, reason: string) => void> = new Set<(session: string, reason: string) => void>();
  private readonly turnEnded: Set<(session: string, outcome: TurnOutcome) => void> = new Set<(session: string, outcome: TurnOutcome) => void>();
  private readonly stopped: Set<(reason: string) => void> = new Set<(reason: string) => void>();
  private readonly resumed: Set<() => void> = new Set<() => void>();

  public readonly register: IToolsContext["register"] = (...args) => this.registerTo("register", args, this.answers.register);
  public readonly openSession: IToolsContext["openSession"] = (...args) => this.ask("openSession", args, this.answers.openSession);
  public readonly onSessionEnded: IToolsContext["onSessionEnded"] = listener => this.listenTo("onSessionEnded", listener, this.sessionEnded, this.answers.onSessionEnded);
  public readonly openEndpointAsync: IToolsContext["openEndpointAsync"] = (...args) => this.respondAsync("openEndpointAsync", args, this.answers.openEndpointAsync);
  public readonly stopAll: IToolsContext["stopAll"] = (...args) => this.tell("stopAll", args, this.answers.stopAll);
  public readonly stopSession: IToolsContext["stopSession"] = (...args) => this.tell("stopSession", args, this.answers.stopSession);
  public readonly onSessionStopped: IToolsContext["onSessionStopped"] = listener => this.listenTo("onSessionStopped", listener, this.sessionStopped, this.answers.onSessionStopped);
  public readonly onTurnEnded: IToolsContext["onTurnEnded"] = listener => this.listenTo("onTurnEnded", listener, this.turnEnded, this.answers.onTurnEnded);
  public readonly resumeAll: IToolsContext["resumeAll"] = (...args) => this.tell("resumeAll", args, this.answers.resumeAll);
  public readonly onStopped: IToolsContext["onStopped"] = listener => this.listenTo("onStopped", listener, this.stopped, this.answers.onStopped);
  public readonly onResumed: IToolsContext["onResumed"] = listener => this.listenTo("onResumed", listener, this.resumed, this.answers.onResumed);

  public constructor(log: IModuleLog = new FakeModuleLog()) {
    super();
    this.log = log;
  }

  public get isStopped(): boolean {
    return this.propertyOf("isStopped", this.answers.isStopped);
  }

  public raiseSessionEnded(session: string): void {
    this.raiseLive(this.sessionEnded, t => t(session), t => this.log.write(Resources.formatToolSessionListenerFailed(inspect(t))));
  }

  public raiseSessionStopped(session: string, reason: string): void {
    this.raiseLive(this.sessionStopped, t => t(session, reason), t => this.reportControl(t));
  }

  public raiseTurnEnded(session: string, outcome: TurnOutcome): void {
    this.raiseLive(this.turnEnded, t => t(session, outcome), t => this.reportControl(t));
  }

  public raiseStopped(reason: string): void {
    this.raiseLive(this.stopped, t => t(reason), t => this.reportControl(t));
  }

  public raiseResumed(): void {
    this.raiseLive(this.resumed, t => t(), t => this.reportControl(t));
  }

  private registerTo<A extends unknown[]>(member: keyof IToolsContext & string, args: A, answer: ((...args: A) => Registration) | undefined): Registration {
    const release = this.track(member, args);
    if (Object.isUndefined(answer))
      return new Registration(release);
    try {
      const answered = answer(...args);
      return new Registration(() => {
        release();
        answered[Symbol.dispose]();
      });
    } catch (error) {
      release();
      throw error;
    }
  }

  private listenTo<L>(member: keyof IToolsContext & string, listener: L, listeners: Set<L>, answer: ((listener: L) => Registration) | undefined): Registration {
    return Object.isUndefined(answer) ? new Registration(this.listen(member, [listener], listeners, listener)) : this.registerTo(member, [listener], answer);
  }

  private reportControl(error: unknown): void {
    this.log.write(Resources.formatAgentControlListenerFailed(inspect(error)));
  }
}

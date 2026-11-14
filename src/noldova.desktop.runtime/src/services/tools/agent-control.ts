/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { AgentControlState, Failure, FailureCode, ShellClients, ShellEvents } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { EventChannel } from "../../models/event-channel.js";
import type { RequestContext } from "../../models/request-context.js";
import { RuntimeCommand } from "../../models/runtime-command.js";
import { Resources } from "../../resources.js";
import { ShellCommands } from "../commands/shell-commands.js";
import type { CommandRegistry } from "../registry/command-registry.js";
import type { EventRegistry } from "../registry/event-registry.js";
import type { ToolRegistry } from "./tool-registry.js";

export class AgentControl implements IMethodHandler {
  private readonly tools: ToolRegistry;
  private readonly changed: EventChannel;
  private readonly stop: RuntimeCommand;
  private readonly resume: RuntimeCommand;

  public constructor(tools: ToolRegistry, commands: CommandRegistry, events: EventRegistry) {
    this.tools = tools;
    this.changed = events.declare(ShellEvents.agentControlChanged);
    this.stop = new RuntimeCommand(ShellCommands.stopAgentControl.text, Resources.stopAgentControlTitle, Resources.stopAgentControlIcon, ShellCommands.stopAgentControlKey,
      { handleAsync: () => AgentControl.run(() => tools.stopAll(Resources.personStoppedAgents)) });
    this.resume = new RuntimeCommand(ShellCommands.resumeAgentControl.text, Resources.resumeAgentControlTitle, Resources.resumeAgentControlIcon, null,
      { handleAsync: t => AgentControl.resumeAsync(tools, t) }, null, ShellClients.mainProcess);
    this.resume.setEnabled(false);
    commands.register(this.stop);
    commands.register(this.resume);
    tools.onControlChanged(() => this.report());
  }

  public handleAsync(_context: RequestContext): Promise<JsonValue> {
    return Promise.resolve(this.read().toJson());
  }

  private read(): AgentControlState {
    return new AgentControlState(this.tools.isStopped, this.tools.isActing);
  }

  private report(): void {
    this.stop.setEnabled(!this.tools.isStopped);
    this.resume.setEnabled(this.tools.isStopped);
    this.changed.publish(this.read().toJson());
  }

  private static resumeAsync(tools: ToolRegistry, context: RequestContext): Promise<JsonValue> {
    if (context.client !== ShellClients.mainProcess)
      return Promise.reject(new MethodFailureException(new Failure(FailureCode.Unauthorized, Resources.formatResumeNotFromApp(context.client))));
    return AgentControl.run(() => tools.resumeAll(null));
  }

  private static run(action: () => void): Promise<JsonValue> {
    action();
    return Promise.resolve(null);
  }
}

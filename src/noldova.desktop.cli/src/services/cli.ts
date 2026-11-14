/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { text } from "node:stream/consumers";

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import {
  CommandList,
  CommandRun,
  Failure,
  FailureCode,
  MainWindow,
  ModuleState,
  type ModuleStatus,
  ModuleStatusList,
  QualifiedName,
  QuitReport,
  ShellEvents,
  ShellMethods,
  WorkReport
} from "@noldova/desktop.protocol";
import {
  AttachOptions,
  ConnectionException,
  ConnectionRefusedException,
  type DataDirectory,
  type IRuntimeClientListener,
  MethodFailureException,
  type RuntimeClient,
  UpdateBarrierStatus,
  UpdateInProgressException
} from "@noldova/desktop.runtime";

import { ArgumentsSource } from "../enums/arguments-source.js";
import { CliCommand } from "../enums/cli-command.js";
import { ExitCode } from "../enums/exit-code.js";
import { ArgumentsFileUnreadableException } from "../exceptions/arguments-file-unreadable.exception.js";
import { ArgumentsInvalidException } from "../exceptions/arguments-invalid.exception.js";
import { CliCommandException } from "../exceptions/cli-command.exception.js";
import { CommandNameInvalidException } from "../exceptions/command-name-invalid.exception.js";
import { MainProcessNotStartedException } from "../exceptions/main-process-not-started.exception.js";
import { ModuleCommandRequiredException } from "../exceptions/module-command-required.exception.js";
import { ModuleNotActiveException } from "../exceptions/module-not-active.exception.js";
import { UnexpectedArgumentException } from "../exceptions/unexpected-argument.exception.js";
import { UnknownCommandException } from "../exceptions/unknown-command.exception.js";
import { UnknownModuleCommandException } from "../exceptions/unknown-module-command.exception.js";
import { UsageException } from "../exceptions/usage.exception.js";
import type { CliCommandResult } from "../models/cli-command-result.js";
import type { CliContext } from "../models/cli-context.js";
import { CliFailure } from "../models/cli-failure.js";
import type { CliModule } from "../models/cli-module.js";
import { CommandLine } from "../models/command-line.js";
import { ModuleCall } from "../models/module-call.js";
import { StatusReport } from "../models/status-report.js";
import { Resources } from "../resources.js";
import { CliCommandConsole } from "./cli-command-console.js";
import { CliHelp } from "./cli-help.js";
import { CliModuleReader } from "./cli-module.reader.js";
import { CliOutput } from "./cli-output.js";
import { CliPartHost } from "./cli-part-host.js";
import { RuntimeAttacher } from "./runtime-attacher.js";

export class Cli {
  private readonly context: CliContext;
  private readonly attacher: RuntimeAttacher;

  public constructor(context: CliContext) {
    this.context = context;
    this.attacher = new RuntimeAttacher(context);
  }

  public async runAsync(commandLineArguments: readonly string[]): Promise<number> {
    let commandLine: CommandLine;
    try {
      commandLine = CommandLine.parse(commandLineArguments);
    }
    catch (error) {
      return this.fail(new CliOutput(this.context.output, this.context.error, commandLineArguments.includes(Resources.jsonFlag)), error, Resources.usage);
    }

    const output = new CliOutput(this.context.output, this.context.error, commandLine.isJson);
    try {
      switch (commandLine.command) {
        case CliCommand.Help:
          return await this.helpAsync(commandLine, output);
        case CliCommand.Status:
          output.writeStatus(await this.readStatusAsync(commandLine));
          return ExitCode.Success;
        case CliCommand.Commands:
          output.writeCommands(await this.readCommandsAsync(commandLine));
          return ExitCode.Success;
        case CliCommand.Run:
          output.writeResult(await this.runCommandAsync(commandLine));
          return ExitCode.Success;
        case CliCommand.Open:
          output.writeOpened(await this.openAsync(commandLine));
          return ExitCode.Success;
        case CliCommand.Quit:
          output.writeQuit(await this.quitAsync(commandLine));
          return ExitCode.Success;
        case CliCommand.Module:
          return await this.runModuleAsync(commandLine, output);
      }
    }
    catch (error) {
      return this.failCommand(output, error);
    }
  }

  private failCommand(output: CliOutput, error: unknown): number {
    return this.fail(output, this.attacher.isUpdating ? new UpdateInProgressException(UpdateBarrierStatus.Held) : error, null);
  }

  private fail(output: CliOutput, error: unknown, usage: string | null): number {
    const failure = error instanceof MethodFailureException ? CliFailure.fromFailure(error.failure) : CliFailure.fromError(error);
    output.writeFailure(failure, usage);
    return failure.exitCode;
  }

  private async helpAsync(commandLine: CommandLine, output: CliOutput): Promise<number> {
    const modules = await CliModuleReader.readAsync(this.context.runtimeEntryPath);
    const [moduleId, word, unexpected] = commandLine.moduleArguments;
    const module = modules.find(t => t.id === moduleId);
    if (Object.isUndefined(module)) {
      if (!Object.isUndefined(moduleId) && !Resources.ownCommands.has(moduleId))
        return this.fail(output, new UnknownCommandException(moduleId), Resources.usage);
      if (!Object.isUndefined(word))
        return this.fail(output, new UnexpectedArgumentException(word), Resources.usage);
      return Cli.help(output, CliHelp.formatAll(modules));
    }
    if (!Object.isUndefined(unexpected))
      return this.fail(output, new UnexpectedArgumentException(unexpected), CliHelp.formatModule(module));
    if (Object.isUndefined(word))
      return Cli.help(output, CliHelp.formatModule(module));
    const command = module.commands.find(t => t.word === word);
    if (Object.isUndefined(command))
      return this.fail(output, new UnknownModuleCommandException(word, module.id), CliHelp.formatModule(module));
    return Cli.help(output, CliHelp.formatCommand(module, command));
  }

  private async runModuleAsync(commandLine: CommandLine, output: CliOutput): Promise<number> {
    const modules = await CliModuleReader.readAsync(this.context.runtimeEntryPath);
    const module = modules.find(t => t.id === commandLine.commandName);
    if (Object.isUndefined(module))
      return this.fail(output, new UnknownCommandException(commandLine.commandName), Resources.usage);
    const [word, ...rest] = commandLine.moduleArguments;
    const command = module.commands.find(t => t.word === word);
    if (Object.isUndefined(command)) {
      if (commandLine.isHelp)
        return Cli.help(output, CliHelp.formatModule(module));
      const problem = Object.isUndefined(word)
        ? new ModuleCommandRequiredException(module.id)
        : new UnknownModuleCommandException(word, module.id);
      return this.fail(output, problem, CliHelp.formatModule(module));
    }
    const usage = CliHelp.formatCommand(module, command);
    if (commandLine.isHelp)
      return Cli.help(output, usage);
    let call: ModuleCall;
    try {
      call = ModuleCall.parse(command, rest);
    }
    catch (error) {
      return this.fail(output, error, usage);
    }
    return await this.runModuleCommandAsync(commandLine, output, usage, modules, module, call);
  }

  private async runModuleCommandAsync(
    commandLine: CommandLine, output: CliOutput, usage: string, modules: readonly CliModule[], module: CliModule, call: ModuleCall): Promise<number> {
    const lost = Promise.withResolvers<never>();
    void lost.promise.catch(() => undefined);
    const commandConsole = this.createConsole(commandLine);
    const watchers = new Set<(modules: ModuleStatusList) => void>();
    const listener: IRuntimeClientListener = {
      onEvent: event => {
        if (event.name.equals(ShellEvents.modulesChanged))
          for (const watcher of [...watchers])
            watcher(ModuleStatusList.fromJson(event.payload));
        try {
          commandConsole.receive(event);
        }
        catch (error) {
          lost.reject(Cli.toCommandError(error));
        }
      },
      onDisconnected: () => lost.reject(new ConnectionRefusedException(new Failure(FailureCode.Disconnected, Resources.runtimeGone)))
    };
    const client = await this.attachAsync(commandLine, this.locate(commandLine), new AttachOptions(commandLine.start, commandLine.takeOver), listener);
    try {
      const host = new CliPartHost(modules, (method, payload, signal) => Cli.callAsync(client, method, payload, undefined, signal),
        reason => Cli.writeStopFailure(output, [reason]));
      const follow = (stop: (error: Error) => void): () => void => {
        const watcher = (list: ModuleStatusList): void => {
          const status = list.modules.find(t => t.id === module.id && t.state !== ModuleState.Active);
          if (!Object.isUndefined(status))
            stop(Cli.describeInactive(status));
        };
        watchers.add(watcher);
        return () => watchers.delete(watcher);
      };
      const outcome = await this.untilStoppedAsync(t => {
        t.addEventListener(Resources.abortEvent, () => commandConsole.abort(), { once: true });
        return Cli.runPartsAsync(client, host, module, call, t, commandConsole);
      }, commandLine.timeoutMilliseconds, lost.promise, follow)
        .then(t => ({ result: t }), (error: unknown) => ({ error }));
      const failures = await host.stopAsync();
      let code: number;
      if ("error" in outcome)
        code = outcome.error instanceof UsageException ? this.fail(output, outcome.error, usage) : this.failCommand(output, outcome.error);
      else {
        output.writeCommandResult(outcome.result);
        code = ExitCode.Success;
      }
      if (failures.length === 0)
        return code;
      Cli.writeStopFailure(output, failures);
      return code === ExitCode.Success ? ExitCode.PartNotStopped : code;
    }
    finally {
      client.close();
      commandConsole[Symbol.dispose]();
    }
  }

  private static writeStopFailure(output: CliOutput, reasons: readonly string[]): void {
    output.writeFailure(new CliFailure(ExitCode.PartNotStopped, Resources.partNotStoppedCode, Resources.formatCliPartStopFailed(reasons.join(Resources.reasonSeparator))), null);
  }

  private createConsole(commandLine: CommandLine): CliCommandConsole {
    const context = this.context;
    return commandLine.isJson
      ? new CliCommandConsole(context.error, null, context.input)
      : new CliCommandConsole(context.output, context.output, context.input);
  }

  private async untilStoppedAsync<T>(
    work: (signal: AbortSignal) => Promise<T>, timeout: number | null, lost: Promise<never>, follow: (stop: (error: Error) => void) => () => void): Promise<T> {
    const controller = new AbortController();
    void lost.catch(() => controller.abort());
    const stopped = Promise.withResolvers<never>();
    let reason: Error | null = null;
    let timer: NodeJS.Timeout | undefined;
    let grace: NodeJS.Timeout | undefined;
    const end = (error: Error): void => stopped.reject(error);
    const stop = (error: Error): void => {
      reason = error;
      controller.abort();
      clearTimeout(timer);
      grace = setTimeout(() => end(error), this.context.cleanupGraceMilliseconds);
    };
    const interrupt = (): void => Object.isNull(reason)
      ? stop(new MethodFailureException(new Failure(FailureCode.Cancelled, Resources.cancelled)))
      : end(reason);
    this.listen(interrupt);
    timer = Object.isNull(timeout) ? undefined
      : setTimeout(() => stop(new MethodFailureException(new Failure(FailureCode.DeadlineExceeded, Resources.timedOut))), timeout);
    const unfollow = follow(t => {
      controller.abort();
      end(t);
    });
    const settled = work(controller.signal).then(
      t => Object.isNull(reason) ? t : Promise.reject(reason),
      (error: unknown) => Promise.reject(reason ?? error));
    try {
      return await Promise.race([settled, stopped.promise, lost]);
    }
    finally {
      clearTimeout(timer);
      clearTimeout(grace);
      this.unlisten(interrupt);
      unfollow();
    }
  }

  private static async runPartsAsync(
    client: RuntimeClient, host: CliPartHost, module: CliModule, call: ModuleCall, signal: AbortSignal, commandConsole: CliCommandConsole): Promise<CliCommandResult> {
    const status = await Cli.findModuleAsync(client, module.id, signal);
    if (Object.isUndefined(status))
      throw new ModuleNotActiveException(module.id, Resources.moduleNotInRuntime);
    Cli.requireActive(status);
    const handler = await host.startAsync(module, call.command, signal);
    try {
      return await handler.handleAsync(call.values, signal, commandConsole);
    }
    catch (error) {
      throw Cli.toCommandError(error);
    }
  }

  private static toCommandError(error: unknown): unknown {
    return error instanceof UsageException || error instanceof CliCommandException || error instanceof MethodFailureException || error instanceof ConnectionException
      ? error
      : new CliCommandException(Resources.failedCode, Resources.formatCommandFailed(Resources.formatReason(error)));
  }

  private async readStatusAsync(commandLine: CommandLine): Promise<StatusReport> {
    const directory = this.locate(commandLine);
    const client = await this.attachAsync(commandLine, directory, new AttachOptions(false, false));
    try {
      const modules = ModuleStatusList.fromJson(await Cli.callAsync(client, ShellMethods.modules, null, undefined));
      const work = WorkReport.fromJson(await Cli.callAsync(client, ShellMethods.work, null, undefined));
      const window = await Cli.callAsync(client, ShellMethods.mainWindow, null, undefined);
      return new StatusReport(this.context.identity, directory.root, modules, work, Object.isNull(window) ? null : MainWindow.fromJson(window));
    }
    finally {
      client.close();
    }
  }

  private async readCommandsAsync(commandLine: CommandLine): Promise<CommandList> {
    const client = await this.attachAsync(commandLine, this.locate(commandLine), new AttachOptions(commandLine.start, commandLine.takeOver));
    try {
      return CommandList.fromJson(await Cli.callAsync(client, ShellMethods.commands, null, undefined));
    }
    finally {
      client.close();
    }
  }

  private async runCommandAsync(commandLine: CommandLine): Promise<JsonValue> {
    const run = new CommandRun(Cli.parseName(commandLine.commandName), await this.readArgumentsAsync(commandLine));
    const client = await this.attachAsync(commandLine, this.locate(commandLine), new AttachOptions(commandLine.start, commandLine.takeOver));
    const controller = new AbortController();
    const interrupt = (): void => controller.abort();
    this.listen(interrupt);
    try {
      return await Cli.callAsync(client, ShellMethods.runCommand, run.toJson(), commandLine.timeoutMilliseconds ?? undefined, controller.signal);
    }
    catch (error) {
      if (error instanceof MethodFailureException && error.failure.code === FailureCode.NotFound) {
        const status = await Cli.findModuleAsync(client, run.name.owner);
        if (!Object.isUndefined(status))
          Cli.requireActive(status);
      }
      throw error;
    }
    finally {
      this.unlisten(interrupt);
      client.close();
    }
  }

  private async quitAsync(commandLine: CommandLine): Promise<QuitReport> {
    const client = await this.attachAsync(commandLine, this.locate(commandLine), new AttachOptions(false, false));
    const controller = new AbortController();
    const interrupt = (): void => controller.abort();
    this.listen(interrupt);
    try {
      return QuitReport.fromJson(await Cli.callAsync(client, ShellMethods.quit, null, commandLine.timeoutMilliseconds ?? undefined, controller.signal));
    }
    finally {
      this.unlisten(interrupt);
      client.close();
    }
  }

  private listen(interrupt: () => void): void {
    for (const signal of Resources.interruptSignals)
      this.context.signals.on(signal, interrupt);
  }

  private unlisten(interrupt: () => void): void {
    for (const signal of Resources.interruptSignals)
      this.context.signals.off(signal, interrupt);
  }

  private async openAsync(commandLine: CommandLine): Promise<string> {
    const directory = this.locate(commandLine);
    const checkout = this.context.environment[Resources.checkoutVariable] ?? String.empty;
    const mainProcessArguments = [
      ...String.isNullOrWhitespace(checkout) ? [] : [path.join(checkout, ...Resources.mainProcessMainSegments)],
      `${Resources.dataDirectoryFlag}${Resources.valueSeparator}${directory.root}`
    ];
    const environment = { ...this.context.environment };
    delete environment[Resources.runAsNodeVariable];
    try {
      await this.context.mainProcessOpener.openAsync(this.context.executablePath, mainProcessArguments, environment);
    }
    catch (error) {
      throw new MainProcessNotStartedException(error);
    }
    return directory.root;
  }

  private locate(commandLine: CommandLine): DataDirectory {
    return this.attacher.locate(commandLine.dataDirectory);
  }

  private attachAsync(commandLine: CommandLine, directory: DataDirectory, options: AttachOptions, listener?: IRuntimeClientListener): Promise<RuntimeClient> {
    return this.attacher.attachAsync(Resources.clientName, commandLine.deviceDirectory, directory, options, listener);
  }

  private static help(output: CliOutput, help: string): number {
    output.writeHelp(help);
    return ExitCode.Success;
  }

  private static async findModuleAsync(client: RuntimeClient, moduleId: string, signal?: AbortSignal): Promise<ModuleStatus | undefined> {
    return ModuleStatusList.fromJson(await Cli.callAsync(client, ShellMethods.modules, null, undefined, signal)).modules.find(t => t.id === moduleId);
  }

  private static requireActive(status: ModuleStatus): void {
    if (status.state !== ModuleState.Active)
      throw Cli.describeInactive(status);
  }

  private static describeInactive(status: ModuleStatus): ModuleNotActiveException {
    return new ModuleNotActiveException(status.id, status.cause ?? Resources.formatModuleOff(String(status.switchSetting)), status.blockedBy);
  }

  private async readArgumentsAsync(commandLine: CommandLine): Promise<JsonValue> {
    let source: string;
    switch (commandLine.argumentsSource) {
      case ArgumentsSource.None:
        return null;
      case ArgumentsSource.Inline:
        source = commandLine.argumentsText;
        break;
      case ArgumentsSource.File:
        source = await Cli.readArgumentsFileAsync(commandLine.argumentsText);
        break;
      case ArgumentsSource.Input:
        source = await text(this.context.input);
        break;
    }
    try {
      return JsonReader.parseValue(source);
    }
    catch (error) {
      throw new ArgumentsInvalidException(error);
    }
  }

  private static async readArgumentsFileAsync(file: string): Promise<string> {
    try {
      return await readFile(file, Resources.utf8Encoding);
    }
    catch (error) {
      throw new ArgumentsFileUnreadableException(file, error);
    }
  }

  private static parseName(name: string): QualifiedName {
    try {
      return QualifiedName.parse(name);
    }
    catch (error) {
      throw new CommandNameInvalidException(name, error);
    }
  }

  private static async callAsync(client: RuntimeClient, method: QualifiedName, payload: JsonValue, timeout: number | undefined, signal?: AbortSignal): Promise<JsonValue> {
    const response = await client.callAsync(method, payload, timeout, signal);
    const failure = response.failure;
    if (!Object.isUndefined(failure))
      throw new MethodFailureException(failure);
    return response.payload ?? null;
  }
}

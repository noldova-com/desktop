/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";
import { StringBuilder } from "@noldova/context.text";

import { EnvironmentUnreadableException } from "../../exceptions/environment-unreadable.exception.js";
import type { IEnvironmentSource } from "../../interfaces/i-environment-source.js";
import type { ILineProcess } from "../../interfaces/i-line-process.js";
import type { ILineProcessStarter } from "../../interfaces/i-line-process-starter.js";
import { CaughtFailure } from "../../models/caught-failure.js";
import { Resources } from "../../resources.js";

export class WindowsEnvironment implements IEnvironmentSource {
  private readonly environment: Readonly<Record<string, string>>;
  private readonly starter: ILineProcessStarter;
  private readonly diagnostics: Writable;
  private readonly limitMilliseconds: number;
  private readonly powerShell: string | null;
  private process: ILineProcess | null = null;
  private reading: Promise<Readonly<Record<string, string>>> | null = null;
  private answer: ((environment: Readonly<Record<string, string>>) => void) | null = null;
  private timer: NodeJS.Timeout | undefined;
  private requestId: number = 0;
  private isEnded: boolean = false;

  public constructor(environment: Readonly<Record<string, string>>, starter: ILineProcessStarter, diagnostics: Writable,
    limitMilliseconds: number = Resources.windowsEnvironmentReadMilliseconds) {
    const systemRoot = environment[Resources.systemRootVariable];
    this.environment = environment;
    this.starter = starter;
    this.diagnostics = diagnostics;
    this.limitMilliseconds = limitMilliseconds;
    this.powerShell = Object.isUndefined(systemRoot) ? null : path.win32.join(systemRoot, ...Resources.windowsPowerShellPath);
  }

  public readAsync(): Promise<Readonly<Record<string, string>>> {
    if (this.isEnded)
      return Promise.resolve(this.environment);
    if (!Object.isNull(this.reading))
      return this.reading;
    const reading = new Promise<Readonly<Record<string, string>>>(resolve => {
      this.answer = resolve;
    });
    this.reading = reading;
    this.ask();
    return reading;
  }

  public end(): void {
    this.isEnded = true;
    this.process?.kill();
    this.process = null;
    this.finish(this.environment);
  }

  private ask(): void {
    const powerShell = this.powerShell;
    if (Object.isNull(powerShell)) {
      this.fail(Resources.windowsEnvironmentSystemRootMissing);
      return;
    }
    this.process ??= this.startProcess(powerShell);
    this.timer = setTimeout(() => this.restart(powerShell, Resources.formatWindowsEnvironmentTimedOut(this.limitMilliseconds)), this.limitMilliseconds);
    this.requestId++;
    this.process.write(String(this.requestId));
  }

  private startProcess(powerShell: string): ILineProcess {
    const child = this.starter.start(powerShell, [...Resources.windowsEnvironmentArguments, WindowsEnvironment.encode(Resources.windowsEnvironmentScript)], this.environment, {
      onLine: line => {
        if (this.process === child)
          this.receive(line);
      },
      onExit: reason => {
        if (this.process === child)
          this.lose(powerShell, reason);
      }
    });
    return child;
  }

  private receive(line: string): void {
    const answer = WindowsEnvironment.findAnswer(line, String(this.requestId));
    if (Object.isNull(answer)) {
      this.diagnostics.write(Resources.windowsEnvironmentLineDropped);
      return;
    }
    try {
      const machine = WindowsEnvironment.toScope(answer.readObject(Resources.machineVariablesKey));
      const user = WindowsEnvironment.toScope(answer.readObject(Resources.userVariablesKey));
      this.finish(WindowsEnvironment.build(this.environment, machine, user));
    }
    catch (error) {
      if (!(error instanceof EnvironmentUnreadableException))
        CaughtFailure.expect(error, JsonException);
      this.fail(Resources.windowsEnvironmentOutputInvalid);
    }
  }

  private lose(powerShell: string, reason: string): void {
    this.process = null;
    if (!Object.isNull(this.reading))
      this.restart(powerShell, reason);
  }

  private restart(powerShell: string, reason: string): void {
    this.process?.kill();
    this.process = null;
    this.fail(reason);
    this.process = this.startProcess(powerShell);
  }

  private fail(reason: string): void {
    this.diagnostics.write(Resources.formatEnvironmentUnread(reason));
    this.finish(this.environment);
  }

  private finish(environment: Readonly<Record<string, string>>): void {
    const answer = this.answer;
    clearTimeout(this.timer);
    this.reading = null;
    this.answer = null;
    answer?.(environment);
  }

  private static encode(script: string): string {
    return Buffer.from(script, Resources.utf16Encoding).toString(Resources.base64Encoding);
  }

  private static findAnswer(line: string, requestId: string): JsonReader | null {
    try {
      const answer = JsonReader.parse(Buffer.from(line.trim(), Resources.base64Encoding).toString(Resources.utf8Encoding));
      return answer.readValue(Resources.requestIdKey) === requestId ? answer : null;
    }
    catch (error) {
      CaughtFailure.expect(error, JsonException);
      return null;
    }
  }

  private static toScope(scope: JsonReader): Readonly<Record<string, readonly [string, boolean]>> {
    const variables: Record<string, readonly [string, boolean]> = {};
    for (const [name, variable] of Object.entries(scope.toJson())) {
      if (!Array.isArray(variable) || variable.length !== 2 || !Object.isString(variable[0]) || !Object.isBoolean(variable[1]))
        throw new EnvironmentUnreadableException();
      variables[name] = [variable[0], variable[1]];
    }
    return variables;
  }

  private static build(environment: Readonly<Record<string, string>>, machine: Readonly<Record<string, readonly [string, boolean]>>,
    user: Readonly<Record<string, readonly [string, boolean]>>): Readonly<Record<string, string>> {
    const variables = new Map<string, readonly [string, string]>();
    for (const [name, value] of Object.entries(environment))
      variables.set(name.toUpperCase(), [name, value]);
    const machinePath = WindowsEnvironment.apply(variables, machine);
    const userPath = WindowsEnvironment.apply(variables, user);
    if (!Object.isUndefined(machinePath) && !Object.isUndefined(userPath))
      variables.set(Resources.pathVariable, [machinePath[0], `${machinePath[1]}${path.win32.delimiter}${userPath[1]}`]);
    return Object.fromEntries(variables.values());
  }

  private static apply(variables: Map<string, readonly [string, string]>, scope: Readonly<Record<string, readonly [string, boolean]>>): readonly [string, string] | undefined {
    let scopePath: readonly [string, string] | undefined;
    for (const isExpandedPass of [false, true])
      for (const [name, [value, isExpandable]] of Object.entries(scope)) {
        if (isExpandable !== isExpandedPass)
          continue;
        const variable: readonly [string, string] = [name, isExpandable ? WindowsEnvironment.expand(value, variables) : value];
        variables.set(name.toUpperCase(), variable);
        if (name.toUpperCase() === Resources.pathVariable)
          scopePath = variable;
      }
    return scopePath;
  }

  private static expand(value: string, variables: ReadonlyMap<string, readonly [string, string]>): string {
    const text = new StringBuilder();
    let index = 0;
    for (;;) {
      const start = value.indexOf(Resources.windowsVariableMark, index);
      const end = start === -1 ? -1 : value.indexOf(Resources.windowsVariableMark, start + 1);
      if (end === -1)
        return text.append(value.slice(index)).toString();
      const variable = variables.get(value.slice(start + 1, end).toUpperCase());
      if (Object.isUndefined(variable)) {
        text.append(value.slice(index, end));
        index = end;
      }
      else {
        text.append(value.slice(index, start)).append(variable[1]);
        index = end + 1;
      }
    }
  }
}

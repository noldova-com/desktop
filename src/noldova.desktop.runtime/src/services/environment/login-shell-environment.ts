/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";

import type { IEnvironmentSource } from "../../interfaces/i-environment-source.js";
import type { ILineProcessStarter } from "../../interfaces/i-line-process-starter.js";
import type { IProfileWatch } from "../../interfaces/i-profile-watch.js";
import { CaughtFailure } from "../../models/caught-failure.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";

export class LoginShellEnvironment implements IEnvironmentSource {
  private readonly environment: Readonly<Record<string, string>>;
  private readonly starter: ILineProcessStarter;
  private readonly diagnostics: Writable;
  private readonly shell: string;
  private readonly node: string;
  private readonly watchProfiles: (zshFolder: string | undefined, onChange: () => void) => IProfileWatch;
  private readonly limitMilliseconds: number;
  private watch: IProfileWatch | null = null;
  private kept: Readonly<Record<string, string>> | null = null;
  private latest: Readonly<Record<string, string>> | null = null;
  private stamp: string | undefined;
  private reading: Promise<Readonly<Record<string, string>>> | null = null;
  private stopReading: (() => void) | null = null;
  private isRereadDue: boolean = false;
  private isEnded: boolean = false;

  public constructor(environment: Readonly<Record<string, string>>, starter: ILineProcessStarter, diagnostics: Writable, shell: string, node: string,
    watchProfiles: (zshFolder: string | undefined, onChange: () => void) => IProfileWatch, limitMilliseconds: number = Resources.loginShellReadMilliseconds) {
    this.environment = environment;
    this.starter = starter;
    this.diagnostics = diagnostics;
    this.shell = shell;
    this.node = node;
    this.watchProfiles = watchProfiles;
    this.limitMilliseconds = limitMilliseconds;
  }

  public static findShell(readUserShell: () => string | null, environment: Readonly<Record<string, string>>): string {
    let shell: string | null;
    try {
      shell = readUserShell();
    }
    catch (error) {
      if (!SystemErrorCode.is(error, Resources.systemErrorCode))
        throw error;
      shell = null;
    }
    if (!Object.isNull(shell) && !String.isNullOrWhitespace(shell))
      return shell;
    const variable = environment[Resources.shellVariable];
    return Object.isUndefined(variable) || String.isNullOrWhitespace(variable) ? Resources.defaultPosixShell : variable;
  }

  public readAsync(): Promise<Readonly<Record<string, string>>> {
    if (this.isEnded)
      return Promise.resolve(this.kept ?? this.environment);
    if (Object.isNull(this.watch))
      this.watch = this.watchProfiles(this.environment[Resources.zshFolderVariable], () => this.changed());
    if (!Object.isNull(this.reading))
      return this.reading;
    if (Object.isNull(this.latest))
      return this.begin();
    return this.reuseAsync(this.watch, this.latest);
  }

  public end(): void {
    this.isEnded = true;
    this.isRereadDue = false;
    this.watch?.[Symbol.dispose]();
    this.watch = null;
    this.stopReading?.();
  }

  private changed(): void {
    this.latest = null;
    if (Object.isNull(this.reading))
      void this.begin();
    else
      this.isRereadDue = true;
  }

  private async reuseAsync(watch: IProfileWatch, latest: Readonly<Record<string, string>>): Promise<Readonly<Record<string, string>>> {
    const stamp = await watch.readStampAsync();
    if (this.isEnded)
      return this.kept ?? this.environment;
    if (stamp === this.stamp && this.latest === latest)
      return latest;
    return await (this.reading ?? this.begin());
  }

  private begin(): Promise<Readonly<Record<string, string>>> {
    const stamping = Promise.resolve(this.watch?.readStampAsync());
    const reading = stamping.then(async stamp => [stamp, await this.readOnceAsync()] as const).then(([stamp, t]) => {
      this.reading = null;
      this.stamp = stamp;
      this.latest = t;
      if (this.isRereadDue) {
        this.isRereadDue = false;
        this.latest = null;
        void this.begin();
      }
      return t;
    }, (error: unknown) => {
      this.reading = null;
      throw error;
    });
    this.reading = reading;
    return reading;
  }

  private async followAsync(environment: Readonly<Record<string, string>>): Promise<Readonly<Record<string, string>>> {
    if (await this.watch?.followAsync(environment[Resources.zshFolderVariable]) === true)
      this.isRereadDue = true;
    return environment;
  }

  private readOnceAsync(): Promise<Readonly<Record<string, string>>> {
    if (this.isEnded)
      return Promise.resolve(this.kept ?? this.environment);
    return new Promise<Readonly<Record<string, string>>>(resolve => {
      const mark = randomUUID();
      const command = Resources.formatNodeEvaluateCommand(Resources.formatShellQuoted(this.node), Resources.formatShellQuoted(Resources.formatEnvironmentScript(mark)));
      let timer: NodeJS.Timeout | undefined;
      let isDone = false;
      const finish = (environment: Readonly<Record<string, string>> | null, reason: string | null): void => {
        if (isDone)
          return;
        isDone = true;
        clearTimeout(timer);
        this.stopReading = null;
        child.kill();
        if (!Object.isNull(reason))
          this.diagnostics.write(Resources.formatEnvironmentUnread(reason));
        if (Object.isNull(environment)) {
          resolve(this.kept ?? this.environment);
          return;
        }
        this.kept = environment;
        resolve(this.followAsync(environment));
      };
      const child = this.starter.startGroup(this.shell, [...Resources.loginShellArguments, command],
        { ...this.environment, [Resources.runAsNodeVariable]: Resources.runAsNodeValue }, {
          onLine: line => {
            const environment = LoginShellEnvironment.findEnvironment(line, mark);
            if (!Object.isUndefined(environment))
              finish(environment, Object.isNull(environment) ? Resources.formatLoginShellOutputInvalid(this.shell) : null);
          },
          onExit: reason => finish(null, Resources.formatLoginShellEnded(this.shell, reason))
        });
      this.stopReading = () => finish(null, null);
      timer = setTimeout(() => finish(null, Resources.formatLoginShellTimedOut(this.shell, this.limitMilliseconds)), this.limitMilliseconds);
    });
  }

  private static findEnvironment(line: string, mark: string): Readonly<Record<string, string>> | null | undefined {
    const start = line.indexOf(mark);
    const end = start === -1 ? -1 : line.indexOf(mark, start + mark.length);
    if (end === -1)
      return undefined;
    try {
      const environment = JsonReader.parse(line.slice(start + mark.length, end));
      return Object.fromEntries(Object.keys(environment.toJson()).map((t): [string, string] => [t, environment.readString(t)]));
    }
    catch (error) {
      CaughtFailure.expect(error, JsonException);
      return null;
    }
  }
}

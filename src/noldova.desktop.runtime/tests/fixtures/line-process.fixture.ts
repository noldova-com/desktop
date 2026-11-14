/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { ILineProcess } from "../../src/interfaces/i-line-process.js";
import type { ILineProcessListener } from "../../src/interfaces/i-line-process-listener.js";

export type ScopeFixture = Readonly<Record<string, readonly [string, boolean]>>;

export class LineProcessFixture implements ILineProcess {
  public readonly file: string;
  public readonly launchArguments: readonly string[];
  public readonly environment: Readonly<Record<string, string>>;
  public readonly isGroup: boolean;
  public readonly written: string[] = [];
  public kills: number = 0;

  private readonly listener: ILineProcessListener;

  public constructor(file: string, launchArguments: readonly string[], environment: Readonly<Record<string, string>>, listener: ILineProcessListener, isGroup: boolean) {
    this.file = file;
    this.launchArguments = launchArguments;
    this.environment = environment;
    this.listener = listener;
    this.isGroup = isGroup;
  }

  public static plain(variables: Readonly<Record<string, string>>): ScopeFixture {
    return Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, [value, false] as const]));
  }

  public static encode(answer: unknown): string {
    return Buffer.from(JSON.stringify(answer), "utf8").toString("base64");
  }

  public get mark(): string {
    return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u.exec(this.launchArguments.at(-1) ?? String.empty)?.[0] ?? String.empty;
  }

  public write(line: string): void {
    this.written.push(line);
  }

  public kill(): void {
    this.kills++;
  }

  public line(text: string): void {
    this.listener.onLine(text);
  }

  public exit(reason: string): void {
    this.listener.onExit(reason);
  }

  public reply(machine: ScopeFixture, user: ScopeFixture): void {
    this.line(LineProcessFixture.encode({ id: this.written.at(-1), machine, user }));
  }

  public answer(variables: unknown): void {
    this.line(`${this.mark}${JSON.stringify(variables)}${this.mark}`);
  }
}

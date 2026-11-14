/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { homedir, userInfo } from "node:os";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { IEnvironmentSource } from "../../interfaces/i-environment-source.js";
import { Resources } from "../../resources.js";
import { LineProcessStarter } from "./line-process-starter.js";
import { LoginShellEnvironment } from "./login-shell-environment.js";
import { ProfileWatch } from "./profile-watch.js";
import { WindowsEnvironment } from "./windows-environment.js";

export class CurrentEnvironment implements IEnvironmentSource {
  private readonly source: IEnvironmentSource;
  private readonly isWindows: boolean;

  public constructor(platform: string, source: IEnvironmentSource) {
    this.source = source;
    this.isWindows = platform === Resources.windowsPlatform;
  }

  public static create(platform: string, environment: NodeJS.ProcessEnv, diagnostics: Writable): CurrentEnvironment {
    const inherited = Object.fromEntries(Object.entries(environment).filter((t): t is [string, string] => !Object.isUndefined(t[1])));
    if (platform === Resources.windowsPlatform)
      return new CurrentEnvironment(platform, new WindowsEnvironment(inherited, new LineProcessStarter(diagnostics), diagnostics));
    const home = inherited[Resources.homeVariable] ?? homedir();
    const shell = LoginShellEnvironment.findShell(() => userInfo().shell, inherited);
    return new CurrentEnvironment(platform, new LoginShellEnvironment(inherited, new LineProcessStarter(diagnostics), diagnostics, shell, process.execPath,
      (t, u) => ProfileWatch.start(home, t, Resources.shellProfileFiles, u, diagnostics)));
  }

  public async readAsync(): Promise<Readonly<Record<string, string>>> {
    const environment = await this.source.readAsync();
    return Object.fromEntries(Object.entries(environment).filter(([t]) => Resources.environmentNamePattern.test(t) && !this.isOwn(t)));
  }

  public end(): void {
    this.source.end();
  }

  private isOwn(name: string): boolean {
    if (this.isWindows)
      return Resources.ownEnvironmentNames.some(t => t.toUpperCase() === name.toUpperCase());
    return Resources.ownEnvironmentNames.includes(name) || Resources.shellOwnNames.includes(name);
  }
}

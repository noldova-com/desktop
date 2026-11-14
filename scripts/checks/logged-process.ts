/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { BuildException } from "../../src/noldova.desktop.build/src/exceptions/build.exception.ts";
import { Resources } from "../resources.ts";

export class LoggedProcess {
  public static runAsync(command: string, commandArguments: readonly string[], directory: string, log: string, output: Writable, errorOutput: Writable, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    return new Promise<number | null>((resolve, reject) => {
      const file = createWriteStream(log);
      const child = spawn(command, [...commandArguments], { cwd: directory, env: environment, shell: false, stdio: Resources.loggedProcessStdio });
      let failure: BuildException | null = null;
      const forward = (target: Writable, chunk: Buffer): void => {
        target.write(chunk);
        file.write(chunk);
      };
      child.stdout.on("data", (t: Buffer) => forward(output, t));
      child.stderr.on("data", (t: Buffer) => forward(errorOutput, t));
      child.on("error", t => failure = new BuildException(Resources.formatLoggedProcessNotStarted(command), new ExceptionOptions(t)));
      child.on("close", t => file.end(() => Object.isNull(failure) ? resolve(t) : reject(failure)));
    });
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { PathCommand, PathCommandOutcome } from "@noldova/desktop.electron";

import { PathCommandFilesFixture } from "./path-command-files.fixture.js";

export class FakePathCommand extends PathCommand {
  public readonly executablePaths: string[] = [];
  public outcome: PathCommandOutcome = PathCommandOutcome.Missing;
  public failure: Error | null = null;

  public constructor() {
    super("/Applications/Noldova Desktop Sample.app/Contents/Resources/bin/noldova-desktop", "/usr/local/bin/noldova-desktop", new PathCommandFilesFixture(), () => Promise.resolve());
  }

  public create(executablePath: string): PathCommand {
    this.executablePaths.push(executablePath);
    return this;
  }

  public override installAsync(): Promise<PathCommandOutcome> {
    return Object.isNull(this.failure) ? Promise.resolve(this.outcome) : Promise.reject(this.failure);
  }
}

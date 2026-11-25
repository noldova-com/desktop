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
import type { ILineProcessStarter } from "../../src/interfaces/i-line-process-starter.js";
import { NoLineProcessException } from "../exceptions/no-line-process.exception.js";
import { LineProcessFixture } from "./line-process.fixture.js";
import { LineProcessWaitFixture } from "./line-process-wait.fixture.js";

export class LineProcessStarterFixture implements ILineProcessStarter {
  public readonly started: LineProcessFixture[] = [];

  private readonly waits: LineProcessWaitFixture[] = [];

  public get last(): LineProcessFixture {
    const last = this.started.at(-1);
    if (Object.isUndefined(last))
      throw new NoLineProcessException();
    return last;
  }

  public startedAsync(count: number): Promise<LineProcessFixture> {
    const started = this.started.at(count - 1);
    if (count > 0 && !Object.isUndefined(started))
      return Promise.resolve(started);
    const wait = Promise.withResolvers<LineProcessFixture>();
    this.waits.push(new LineProcessWaitFixture(count, wait));
    return wait.promise;
  }

  public start(file: string, launchArguments: readonly string[], environment: Readonly<Record<string, string>>, listener: ILineProcessListener): ILineProcess {
    return this.add(new LineProcessFixture(file, launchArguments, environment, listener, false));
  }

  public startGroup(file: string, launchArguments: readonly string[], environment: Readonly<Record<string, string>>, listener: ILineProcessListener): ILineProcess {
    return this.add(new LineProcessFixture(file, launchArguments, environment, listener, true));
  }

  private add(started: LineProcessFixture): LineProcessFixture {
    this.started.push(started);
    for (const wait of this.waits)
      if (wait.count === this.started.length)
        wait.started.resolve(started);
    return started;
  }
}

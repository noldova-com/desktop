/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StopPolicy } from "@noldova/desktop.protocol";
import type { AttachOptions, IRuntimeClientListener } from "@noldova/desktop.runtime";
import type { IRuntimeConnection, IRuntimeLauncher } from "@noldova/desktop.electron";

import { FakeRuntimeConnection } from "./fake-runtime-connection.fixture.js";

export class FakeRuntimeLauncher implements IRuntimeLauncher {
  private readonly outcomes: (Error | FakeRuntimeConnection | Promise<FakeRuntimeConnection>)[];

  public readonly calls: string[] = [];
  public readonly connections: FakeRuntimeConnection[] = [];
  public readonly options: (AttachOptions | undefined)[] = [];
  public listener: IRuntimeClientListener | null = null;
  public readonly listeners: IRuntimeClientListener[] = [];
  public readonly logs: ((text: string) => void)[] = [];
  public onAttach: () => void = () => undefined;
  public onListening: (listener: IRuntimeClientListener) => void = () => undefined;

  public constructor(...outcomes: (Error | FakeRuntimeConnection | Promise<FakeRuntimeConnection>)[]) {
    this.outcomes = outcomes;
  }

  public attachAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy, options?: AttachOptions): Promise<IRuntimeConnection> {
    this.options.push(options);
    this.onAttach();
    return this.answerAsync(`attach ${clientName} ${policy}`, listener);
  }

  public moveAsideAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy): Promise<IRuntimeConnection> {
    return this.answerAsync(`moveAside ${clientName} ${policy}`, listener);
  }

  private answerAsync(call: string, listener: IRuntimeClientListener): Promise<IRuntimeConnection> {
    this.calls.push(call);
    this.listener = listener;
    this.listeners.push(listener);
    this.onListening(listener);
    const outcome = this.outcomes.shift() ?? new FakeRuntimeConnection();
    if (outcome instanceof Error)
      return Promise.reject(outcome);
    if (outcome instanceof Promise)
      return outcome.then(t => {
        this.connections.push(t);
        return t;
      });
    this.connections.push(outcome);
    return Promise.resolve(outcome);
  }
}

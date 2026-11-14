/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolHandler, type ToolCall, ToolResult } from "@noldova/desktop.runtime";

export class ToolHandlerFixture implements IToolHandler {
  private readonly answer: (call: ToolCall) => Promise<ToolResult>;
  private readonly arrivals: (() => void)[] = [];

  public readonly calls: ToolCall[] = [];

  public constructor(answer: (call: ToolCall) => Promise<ToolResult> = () => Promise.resolve(new ToolResult([]))) {
    this.answer = answer;
  }

  public static untilAborted(call: ToolCall): Promise<ToolResult> {
    return new Promise((_resolve, reject) => call.signal.addEventListener("abort", () => reject(new Error(String(call.signal.reason))), { once: true }));
  }

  public handleAsync(call: ToolCall): Promise<ToolResult> {
    this.calls.push(call);
    for (const arrived of this.arrivals.splice(0))
      arrived();
    return this.answer(call);
  }

  public waitForCallAsync(count: number): Promise<void> {
    return new Promise(resolve => {
      const check = (): void => {
        if (this.calls.length >= count)
          resolve();
        else
          this.arrivals.push(check);
      };
      check();
    });
  }
}

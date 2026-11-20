/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewFrame } from "@noldova/desktop.electron";

export class FakeWebViewFrame implements IWebViewFrame {
  public readonly frameTreeNodeId: number;
  public readonly scripts: string[] = [];
  public failure: Error | null = null;

  public constructor(frameTreeNodeId: number) {
    this.frameTreeNodeId = frameTreeNodeId;
  }

  public get pages(): string[] {
    return this.scripts.map(t => String(JSON.parse(t.slice("location.replace(".length, -1))));
  }

  public executeJavaScript(code: string): Promise<unknown> {
    this.scripts.push(code);
    if (Object.isNull(this.failure))
      return Promise.resolve(undefined);
    throw this.failure;
  }
}

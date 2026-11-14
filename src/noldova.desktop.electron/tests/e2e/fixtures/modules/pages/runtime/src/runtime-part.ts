/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IRuntimePart, IRuntimePartContext, IRuntimeWebViews } from "@noldova/desktop.runtime";

import { Resources } from "./resources.js";

export class RuntimePart implements IRuntimePart {
  private readonly events: string[] = [];
  private release: () => void = () => undefined;

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    const views = context.webViews;
    this.release = views.onViewEvent(t => this.events.push(`${t.view} ${t.kind}`));
    context.registerMethod(Resources.allowMethod, {
      handleAsync: async request => {
        const payload = request.payload;
        const origins = Array.isArray(payload) ? payload.filter(Object.isString) : [];
        await Promise.all(views.list().map(t => views.setAllowedOriginsAsync(t.id, origins)));
        return null;
      }
    });
    context.registerMethod(Resources.navigateMethod, {
      handleAsync: async request => {
        const view = Number(RuntimePart.field(request.payload, Resources.viewField));
        const url = String(RuntimePart.field(request.payload, Resources.urlField));
        const answer = await views.navigateAsync(RuntimePart.find(views, view), url);
        return { kind: answer.kind, origin: answer.origin };
      }
    });
    context.registerMethod(Resources.listMethod, {
      handleAsync: async () => views.list().map(t => ({ id: t.id, pane: t.pane.name.text, instance: t.pane.instance, profileKey: t.profileKey }))
    });
    context.registerMethod(Resources.captureMethod, {
      handleAsync: async request => {
        const reply = await views.relay.sendAsync(
          RuntimePart.find(views, Number(request.payload)), Resources.captureScreenshotMethod, { format: Resources.imageFormat }, Resources.captureTimeout);
        const image = RuntimePart.field(reply, Resources.dataField);
        return Object.isString(image) ? image.length : 0;
      }
    });
    context.registerMethod(Resources.eventsMethod, { handleAsync: async () => [...this.events] });
    context.registerMethod(Resources.pressMethod, {
      handleAsync: async request => {
        const view = Number(RuntimePart.field(request.payload, Resources.viewField));
        const key = String(RuntimePart.field(request.payload, Resources.keyField));
        const code = String(RuntimePart.field(request.payload, Resources.codeField));
        const nativeKeyCode = Number(RuntimePart.field(request.payload, Resources.nativeKeyCodeField));
        for (const type of Resources.keyTypes)
          await views.relay.sendAsync(RuntimePart.find(views, view), Resources.dispatchKeyEventMethod, { type, key, code, modifiers: 0, nativeVirtualKeyCode: nativeKeyCode }, Resources.captureTimeout);
        return null;
      }
    });
    context.registerMethod(Resources.typeMethod, {
      handleAsync: async request => {
        const view = Number(RuntimePart.field(request.payload, Resources.viewField));
        const text = String(RuntimePart.field(request.payload, Resources.textField));
        await views.relay.sendAsync(RuntimePart.find(views, view), Resources.insertTextMethod, { text }, Resources.captureTimeout);
        return null;
      }
    });
  }

  public async deactivateAsync(): Promise<void> {
    this.release();
  }

  private static field(value: unknown, name: string): unknown {
    return Object.isPlainObject(value) ? new Map<string, unknown>(Object.entries(value)).get(name) : undefined;
  }

  private static find(views: IRuntimeWebViews, view: number): string {
    const info = views.list()[view];
    if (Object.isUndefined(info))
      throw new Error(Resources.noViewMessage);
    return info.id;
  }
}

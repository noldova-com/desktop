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
  private readonly refusals: string[] = [];
  private release: () => void = () => undefined;

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    const views = context.webViews;
    this.release = views.onViewEvent(t => {
      this.events.push(`${t.view} ${t.kind}`);
      if (t.kind === Resources.navigationRefusedKind)
        this.refusals.push(`${t.view} ${String(t.details[Resources.addressField])} ${String(t.details[Resources.fromPressField])}`);
    });
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
    context.registerMethod(Resources.controlMethod, {
      handleAsync: async request => {
        const view = Number(RuntimePart.field(request.payload, Resources.viewField));
        await views.setControlledAsync(RuntimePart.find(views, view), RuntimePart.field(request.payload, Resources.isControlledField) === true);
        return null;
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
    context.registerMethod(Resources.refusalsMethod, { handleAsync: async () => [...this.refusals] });
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
    RuntimePart.registerFocusMethods(context);
  }

  public async deactivateAsync(): Promise<void> {
    this.release();
  }

  private static registerFocusMethods(context: IRuntimePartContext): void {
    const views = context.webViews;
    context.registerMethod(Resources.clickMethod, {
      handleAsync: async request => {
        const view = RuntimePart.find(views, Number(RuntimePart.field(request.payload, Resources.viewField)));
        const x = Number(RuntimePart.field(request.payload, Resources.xField));
        const y = Number(RuntimePart.field(request.payload, Resources.yField));
        for (const type of Resources.mouseTypes)
          await views.relay.sendAsync(view, Resources.dispatchMouseEventMethod, { type, x, y, button: Resources.leftButton, clickCount: 1 }, Resources.captureTimeout);
        return null;
      }
    });
    context.registerMethod(Resources.focusMethod, {
      handleAsync: async request => {
        const view = RuntimePart.find(views, Number(RuntimePart.field(request.payload, Resources.viewField)));
        const id = String(RuntimePart.field(request.payload, Resources.idField));
        const found = await views.relay.sendAsync(view, Resources.evaluateMethod, { expression: `document.getElementById(${JSON.stringify(id)})` }, Resources.captureTimeout);
        const objectId = RuntimePart.field(RuntimePart.field(found, Resources.resultField), Resources.objectIdField);
        if (!Object.isString(objectId))
          throw new Error(Resources.noElementMessage);
        await views.relay.sendAsync(view, Resources.focusNodeMethod, { objectId }, Resources.captureTimeout);
        return null;
      }
    });
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

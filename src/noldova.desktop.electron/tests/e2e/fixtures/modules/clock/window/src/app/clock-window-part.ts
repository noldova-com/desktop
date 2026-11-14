/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import {
  CommandContribution, DockSide, type IWindowPart, type IWindowPartContext, StatusBarItemContribution, StatusBarItemState, StatusBarSide, ViewBadge, ViewContribution
} from "@noldova/desktop.window";

export class ClockWindowPart implements IWindowPart {
  public static readonly failureKey: string = "noldova-desktop.fixture.clock.failWindowPart";

  public readonly moduleId: string = "clock";

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    if (!Object.isNull(localStorage.getItem(ClockWindowPart.failureKey)))
      throw new Error("The clock's window part was asked to fail.");
    context.registerView(new ViewContribution("clock.face", "Clock", "schedule", DockSide.Right, true,
      () => import("./components/clock-face/clock-face.component").then(t => t.ClockFaceComponent)));
    context.registerCommand(new CommandContribution("clock.showFace", "Show the clock face", null, null, async () => {
      context.showView("clock.face");
      return null;
    }));
    context.registerCommand(new CommandContribution("clock.hideFace", "Hide the clock face's dock", null, null, async () => {
      context.hideViewDock("clock.face");
      return null;
    }));
    const describe = (text: string): StatusBarItemState => new StatusBarItemState(text, { icon: "timer", tooltip: "Tick the clock", command: "clock.tick" });
    const ticks = context.registerStatusBarItem(new StatusBarItemContribution("clock.ticks", StatusBarSide.Right, describe("No ticks")));
    context.onEvent("clock.ticked", t => {
      const count = JsonReader.fromValue(t).readInteger("ticks");
      ticks.update(describe(`Ticks: ${count}`));
      context.setViewBadge("clock.face", new ViewBadge(count, `${count} ticks`));
    });
  }

  public async reconnectAsync(): Promise<boolean> {
    return false;
  }

  public async deactivateAsync(): Promise<void> {
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandContribution, DockSide, type IWindowPart, type IWindowPartContext, ViewContribution } from "@noldova/desktop.window";

export class BeaconWindowPart implements IWindowPart {
  public readonly moduleId: string = "beacon";

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerView(new ViewContribution("beacon.signal", "Beacon", "wifi_tethering", DockSide.Right, false,
      () => import("./components/beacon-signal/beacon-signal.component.js").then(t => t.BeaconSignalComponent)));
    context.registerCommand(new CommandContribution("beacon.showSignal", "Show the beacon's signal", "wifi_tethering", null, async () => {
      await context.showInDialogAsync("beacon.signal");
      return null;
    }));
  }

  public async reconnectAsync(): Promise<boolean> {
    return false;
  }

  public async deactivateAsync(): Promise<void> {
  }
}

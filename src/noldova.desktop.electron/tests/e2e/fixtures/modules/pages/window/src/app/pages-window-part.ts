/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandContribution, DockSide, DocumentContribution, type IWindowPart, type IWindowPartContext, ViewContribution } from "@noldova/desktop.window";

export class PagesWindowPart implements IWindowPart {
  private isMarkAllowed: boolean = false;

  public readonly moduleId: string = "pages";

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerDocument(new DocumentContribution("pages.page",
      () => import("./components/page/page.component").then(t => t.PageComponent)));
    context.registerView(new ViewContribution("pages.side", "Side page", "web", DockSide.Right, false,
      () => import("./components/side/side.component").then(t => t.SideComponent), undefined, { hasInstances: true }));
    context.registerCommand(new CommandContribution("pages.openPage", "Open the page", null, null, async () => {
      context.openDocument("pages.page", "1", "Page");
      return null;
    }));
    context.registerCommand(new CommandContribution("pages.showPageInDialog", "Show the page in a dialog", null, null, async () => {
      await context.showInDialogAsync("pages.page", { instance: "1", title: "Page" });
      return null;
    }));
    context.registerCommand(new CommandContribution("pages.openSide", "Open the side page", null, null, async () => {
      context.openView("pages.side", "1", "Side page");
      return null;
    }));
    context.registerCommand(new CommandContribution("pages.mark", "Mark the page", null, "Mod+Shift+L", async () => {
      context.updateDocument("pages.page", "1", { title: "Marked page" });
      return null;
    }, () => this.isMarkAllowed));
    context.registerCommand(new CommandContribution("pages.allowMark", "Allow the mark", null, null, async () => {
      this.isMarkAllowed = true;
      context.updateDocument("pages.page", "1", { title: "Mark allowed" });
      return null;
    }));
  }

  public async reconnectAsync(): Promise<boolean> {
    return true;
  }

  public async deactivateAsync(): Promise<void> {
  }
}

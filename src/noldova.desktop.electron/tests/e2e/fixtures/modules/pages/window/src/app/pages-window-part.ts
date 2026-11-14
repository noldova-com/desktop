/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandContribution, DocumentContribution, type IWindowPart, type IWindowPartContext } from "@noldova/desktop.window";

export class PagesWindowPart implements IWindowPart {
  public readonly moduleId: string = "pages";

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerDocument(new DocumentContribution("pages.page",
      () => import("./components/page/page.component").then(t => t.PageComponent)));
    context.registerCommand(new CommandContribution("pages.openPage", "Open the page", null, null, async () => {
      context.openDocument("pages.page", "1", "Page");
      return null;
    }));
  }

  public async reconnectAsync(): Promise<boolean> {
    return true;
  }

  public async deactivateAsync(): Promise<void> {
  }
}

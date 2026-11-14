/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { userEvent } from "vitest/browser";

import { ProductName } from "../../../../src/app/models/product-name";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { QuitFixture } from "../../../fixtures/quit.fixture";

describe("QuitDialogComponent", () => {
  let quit: QuitFixture;

  beforeEach(() => {
    quit = QuitFixture.start();
  });

  afterEach(async () => {
    await quit.endAsync();
  });

  function title(): string {
    return document.getElementById(QuitFixture.findDialog()?.getAttribute("aria-labelledby") ?? String.empty)?.textContent ?? String.empty;
  }

  function items(): string[] {
    return [...document.querySelectorAll(".nol-quit-list li")].map(t => t.textContent?.trim() ?? String.empty);
  }

  function buttons(): string[] {
    return [...document.querySelectorAll(".nol-dialog-actions button")].map(t => t.textContent?.trim() ?? String.empty);
  }

  function button(choice: string): HTMLButtonElement {
    return DomFixture.oneOf(document, `[data-nol-quit=${choice}]`, HTMLButtonElement);
  }

  it("asks what to do with the work in progress, with waiting as the focused choice, and passes on each answer", async () => {
    quit.bridge.askToQuit({ descriptions: ["Indexing the project", "Saving the notes"], isWaiting: false, isUpdate: false });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Wait")));

    const asked = [title(), items(), buttons(), document.querySelector(".nol-dialog-body")?.textContent?.includes("Wait for it to finish, or stop it now.")];
    await userEvent.keyboard("{Enter}");
    button("Stop").click();
    button("Cancel").click();
    await userEvent.keyboard("{Escape}");

    expect(asked).toEqual([
      "Work is still running",
      ["Indexing the project", "Saving the notes"],
      ["Wait, then quit", "Stop the work and quit", "Cancel"],
      true
    ]);
    expect(QuitFixture.findDialog()?.getAttribute("aria-modal")).toBe("true");
    expect(quit.bridge.quitAnswers).toEqual(["Wait", "Stop", "Cancel", "Cancel"]);
  });

  it("cancels from Close at the top right, while it asks and while it waits", async () => {
    quit.bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: false, isUpdate: false });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Wait")));
    const asking = document.querySelector<HTMLButtonElement>(".nol-dialog-header .nol-dialog-close");
    asking?.click();
    quit.bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: true, isUpdate: false });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Cancel")));
    const waiting = document.querySelector<HTMLButtonElement>(".nol-dialog-header .nol-dialog-close");
    waiting?.click();

    expect([asking?.getAttribute("aria-label"), waiting?.getAttribute("aria-label")]).toEqual(["Close", "Close"]);
    expect(quit.bridge.quitAnswers).toEqual(["Cancel", "Cancel"]);
  });

  it("waits with the list the main process keeps current, moves focus to Cancel and lists at most five pieces of work", async () => {
    quit.bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: false, isUpdate: false });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Wait")));

    quit.bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: true, isUpdate: false });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Cancel")));
    const waiting = [title(), buttons(), document.querySelector(".nol-quit-text")?.textContent?.trim()];
    quit.bridge.askToQuit({ descriptions: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"], isWaiting: true, isUpdate: false });
    await vi.waitFor(() => expect(items().length).toBe(6));

    expect(waiting).toEqual(["Waiting for the work to finish", ["Stop the work and quit", "Cancel"], "Noldova Desktop Sample quits when this work finishes:"]);
    expect(items()).toEqual(["One", "Two", "Three", "Four", "Five", "and 2 more"]);
    expect(document.activeElement).toBe(button("Cancel"));
    expect(document.querySelectorAll("[role=dialog]").length).toBe(1);
  });

  it("names the app by the name it started the window with, while it asks and while it waits", async () => {
    const started = ProductName.current;
    ProductName.use("Example Product");
    try {
      quit.bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: false, isUpdate: false });
      await vi.waitFor(() => expect(document.activeElement).toBe(button("Wait")));
      const asking = document.querySelector(".nol-quit-text")?.textContent?.trim();
      quit.bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: true, isUpdate: false });
      await vi.waitFor(() => expect(document.activeElement).toBe(button("Cancel")));

      expect([asking, document.querySelector(".nol-quit-text")?.textContent?.trim()])
        .toEqual(["Example Product is still working on:", "Example Product quits when this work finishes:"]);
    }
    finally {
      ProductName.use(started);
    }
  });

  it("asks the same question before an update, with choices that name the update", async () => {
    quit.bridge.askToQuit({ descriptions: ["Indexing the project (/work/data)"], isWaiting: false, isUpdate: true });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Wait")));
    const asked = [title(), items(), buttons()];

    quit.bridge.askToQuit({ descriptions: ["Indexing the project (/work/data)"], isWaiting: true, isUpdate: true });
    await vi.waitFor(() => expect(document.activeElement).toBe(button("Cancel")));

    expect(asked).toEqual(["Work is still running", ["Indexing the project (/work/data)"], ["Wait, then update", "Stop the work and update", "Cancel"]]);
    expect([title(), buttons(), document.querySelector(".nol-quit-text")?.textContent?.trim()]).toEqual([
      "Waiting for the work to finish", ["Stop the work and update", "Cancel"], "Noldova Desktop Sample updates when this work finishes:"
    ]);
  });
});

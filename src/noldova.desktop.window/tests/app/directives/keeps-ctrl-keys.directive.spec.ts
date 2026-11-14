/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { KeepsCtrlKeysDirective } from "../../../src/app/directives/keeps-ctrl-keys.directive";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { CommandService } from "../../../src/app/services/command.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { DomFixture } from "../../fixtures/dom.fixture";

@Component({
  imports: [KeepsCtrlKeysDirective],
  template: `<div class="terminal" nolKeepsCtrlKeys><textarea></textarea></div><textarea class="other"></textarea>`
})
class HostComponent {
}

describe("KeepsCtrlKeysDirective", () => {
  afterEach(() => PreloadBridgeFixture.remove());

  it("marks its element so a Ctrl+Shift+key inside runs the window's Ctrl+key command, and nowhere else", async () => {
    const runs: string[] = [];
    PreloadBridgeFixture.install("linux");
    TestBed.inject(CommandService).setCommands([new CommandContribution("notes.find", "Find", null, "Mod+U", async () => {
      runs.push("notes.find");
      return null;
    })]);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = DomFixture.host(fixture);
    const press = (selector: string): boolean => {
      const event = new KeyboardEvent("keydown", { key: "U", code: "KeyU", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
      root.querySelector(selector)?.dispatchEvent(event);
      return event.defaultPrevented;
    };

    const prevented = [press(".terminal textarea"), press(".other")];

    await vi.waitFor(() => expect(runs).toEqual(["notes.find"]));
    expect(prevented).toEqual([true, false]);
    expect(root.querySelector(".terminal")?.hasAttribute("data-nol-keeps-ctrl-keys")).toBe(true);
  });
});

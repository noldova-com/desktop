/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, type TemplateRef, viewChild } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { BuildTokens } from "../../../src/app/models/build-tokens";
import { Layout } from "../../../src/app/models/layout/layout";
import { WindowRowTabsService } from "../../../src/app/services/window-row-tabs.service";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

@Component({
  template: `<ng-template #first>first</ng-template><ng-template #second>second</ng-template>`
})
class TemplatesComponent {
  public readonly first: Signal<TemplateRef<unknown>> = viewChild.required<TemplateRef<unknown>>("first");
  public readonly second: Signal<TemplateRef<unknown>> = viewChild.required<TemplateRef<unknown>>("second");
}

describe("WindowRowTabsService", () => {
  const registry = LayoutFixture.createRegistry();

  beforeEach(() => {
    PreloadBridgeFixture.install();
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  function templates(): TemplatesComponent {
    const fixture = TestBed.createComponent(TemplatesComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it("names no group and keeps no bar when the app leaves the document tabs out", async () => {
    await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(LayoutFixture.plan));
    const service = TestBed.inject(WindowRowTabsService);

    expect([service.isEnabled, service.groupId(), service.bar()]).toEqual([false, null, null]);
  });

  it("names the first document group in reading order when the app asks for the document tabs", async () => {
    TestBed.configureTestingModule({ providers: [{ provide: BuildTokens.titleBar, useValue: { name: null, icon: null, documentTabs: true } }] });
    const layout = await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(LayoutFixture.plan));
    const service = TestBed.inject(WindowRowTabsService);

    expect([service.isEnabled, service.groupId()]).toEqual([true, layout.layout().documentGroups[0]?.id]);
  });

  it("keeps the bar shown last and withdraws only that bar", async () => {
    await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry));
    const service = TestBed.inject(WindowRowTabsService);
    const { first, second } = templates();

    service.show(first());
    service.show(second());
    service.withdraw(first());
    const kept = service.bar();
    service.withdraw(second());

    expect([kept, service.bar()]).toEqual([second(), null]);
  });
});

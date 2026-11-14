/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, Component, InjectionToken, Injector, type Type, inject } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { WebViewLayer } from "../../../src/app/models/web-view-layer";
import { DomFixture } from "../../fixtures/dom.fixture";

const LAYER_NAME = new InjectionToken<string>("layer name");

@Component({
  selector: "nol-test-mark",
  template: "<p class=\"nol-test-mark\">{{ name }}</p>"
})
class TestMarkComponent {
  public readonly name: string = inject(LAYER_NAME);
}

@Component({
  selector: "nol-test-broken-mark",
  template: "<p></p>"
})
class TestBrokenMarkComponent {
  public constructor() {
    throw new Error("The mark has no activity.");
  }
}

describe("WebViewLayer", () => {
  let frame: HTMLElement;
  let ends: number;

  beforeEach(() => {
    frame = document.createElement("div");
    Object.assign(frame.style, { position: "fixed", left: "2rem", top: "3rem", width: "20rem", height: "10rem" });
    document.body.append(frame);
    ends = 0;
  });

  afterEach(() => {
    frame.remove();
  });

  function injector(): Injector {
    return Injector.create({ providers: [{ provide: LAYER_NAME, useValue: "Ada clicks Save" }], parent: TestBed.inject(Injector) });
  }

  function open<T>(component: Type<T>): WebViewLayer<T> {
    return new WebViewLayer(frame, component, injector(), TestBed.inject(ApplicationRef), () => {
      ends += 1;
    });
  }

  function rem(value: number): number {
    return value / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  it("shows the component in its own host filling the view's element, taking no pointer, with the part's injector, attached to the application", () => {
    const application = TestBed.inject(ApplicationRef);
    const views = application.viewCount;

    const layer = open(TestMarkComponent);
    application.tick();

    const host = DomFixture.one(frame, "div.nol-web-view-layer");
    const box = host.getBoundingClientRect();
    expect(host.textContent.trim()).toBe("Ada clicks Save");
    expect([box.left, box.top, box.width, box.height].map(t => rem(t))).toEqual([2, 3, 20, 10]);
    expect([getComputedStyle(host).pointerEvents, getComputedStyle(host).overflow]).toEqual(["none", "hidden"]);
    expect([layer.componentRef.location.nativeElement, layer.componentRef.instance.name, application.viewCount]).toEqual([host, "Ada clicks Save", views + 1]);
    layer.close();
  });

  it("ends once when closed: the component destroyed, its host removed and the layer settled", async () => {
    const layer = open(TestMarkComponent);
    const application = TestBed.inject(ApplicationRef);
    const views = application.viewCount;

    layer.close();
    layer.close();
    await layer.closed;

    expect([layer.componentRef.hostView.destroyed, frame.querySelector("div.nol-web-view-layer"), ends, application.viewCount]).toEqual([true, null, 1, views - 1]);
  });

  it("removes its host when the component fails to start, and passes the failure on without ending", () => {
    expect(() => open(TestBrokenMarkComponent)).toThrowError("The mark has no activity.");
    expect([frame.querySelector("div.nol-web-view-layer"), ends]).toEqual([null, 0]);
  });
});

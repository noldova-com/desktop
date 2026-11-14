/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { DocumentInstancesService } from "../../../src/app/services/document-instances.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("DocumentInstancesService", () => {
  const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
  const page = (instance: string): DocumentTab => new DocumentTab("browser.page", instance);
  const settings = new DocumentTab("desktop.settings");
  let errors: unknown[];
  let closed: string[];
  let instances: DocumentInstancesService;
  let layout: LayoutService;

  beforeEach(() => {
    PreloadBridgeFixture.install();
    errors = [];
    closed = [];
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }]
    });
    instances = TestBed.inject(DocumentInstancesService);
    layout = TestBed.inject(LayoutService);
    layout.setRegistry(new ViewRegistry([], ["notes.note", "browser.page", "desktop.settings"]));
    instances.onClosed("notes.note", t => closed.push(`notes.note ${t}`));
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  it("tells a document's listeners of a tab the person closes, never of one it hushed, and lists the open instances in tab order, leaving out a tab without one", () => {
    [note("1"), page("1"), note("2"), new DocumentTab("notes.note"), note("3"), settings].forEach(t => layout.openDocument(t));
    TestBed.tick();
    const open = [instances.instancesOf("notes.note"), instances.instancesOf("browser.page")];
    layout.close(note("1"));
    layout.close(note("2"));
    instances.hush("notes.note", "2");
    layout.close(settings);
    TestBed.tick();
    layout.close(note("3"));
    TestBed.tick();

    expect(open).toEqual([["1", "2", "3"], ["1"]]);
    expect(closed).toEqual(["notes.note 1", "notes.note 3"]);
    expect(instances.instancesOf("notes.note")).toEqual([]);
    expect(errors).toEqual([]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";

import { ArgumentException } from "@noldova/context.exceptions";

import { ContentPadding } from "../../../src/app/enums/content-padding";
import { PlaceholderContribution } from "../../../src/app/models/placeholder-contribution";

@Component({ template: "" })
class StartComponent {
}

describe("PlaceholderContribution", () => {
  const load = (): Promise<Type<unknown>> => Promise.resolve(StartComponent);

  it("keeps its name and loader", async () => {
    const placeholder = new PlaceholderContribution("notes.start", load);

    expect(placeholder.name).toBe("notes.start");
    expect(await placeholder.loadComponent()).toBe(StartComponent);
  });

  it("leaves its padding to its module unless it declares one", () => {
    expect([new PlaceholderContribution("notes.start", load).padding, new PlaceholderContribution("notes.start", load, ContentPadding.None).padding]).toEqual([null, ContentPadding.None]);
  });

  it("refuses a name without its module id", () => {
    expect(() => new PlaceholderContribution("start", load)).toThrowError(ArgumentException);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";

import { ArgumentException } from "@noldova/context.exceptions";

import { SettingsPageContribution } from "../../../src/app/models/settings-page-contribution";

@Component({ template: "" })
class AccountComponent {
}

describe("SettingsPageContribution", () => {
  const load = (): Promise<Type<unknown>> => Promise.resolve(AccountComponent);

  it("keeps its name and loader", async () => {
    const page = new SettingsPageContribution("notes.account", load);

    expect([page.name, await page.loadComponent()]).toEqual(["notes.account", AccountComponent]);
  });

  it("refuses a name without its module id", () => {
    expect(() => new SettingsPageContribution("account", load)).toThrowError(ArgumentException);
  });
});

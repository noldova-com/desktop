/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DependencyNotFollowedException } from "../../../src/app/exceptions/dependency-not-followed.exception";
import { SettingOptionsFailedException } from "../../../src/app/exceptions/setting-options-failed.exception";
import { SettingOptionsRepeatedException } from "../../../src/app/exceptions/setting-options-repeated.exception";
import { SettingsPageNotLoadedException } from "../../../src/app/exceptions/settings-page-not-loaded.exception";
import { WindowPartActivationFailedException } from "../../../src/app/exceptions/window-part-activation-failed.exception";
import { WindowPartFailureException } from "../../../src/app/exceptions/window-part-failure.exception";
import { WindowPartLoadFailedException } from "../../../src/app/exceptions/window-part-load-failed.exception";
import { WindowPartReconnectionFailedException } from "../../../src/app/exceptions/window-part-reconnection-failed.exception";
import { WindowPartSaveFailedForUpdateException } from "../../../src/app/exceptions/window-part-save-failed-for-update.exception";
import { WindowPartSaveFailedLateException } from "../../../src/app/exceptions/window-part-save-failed-late.exception";
import { WindowPartSaveFailedException } from "../../../src/app/exceptions/window-part-save-failed.exception";

describe("WindowPartFailureException", () => {
  it("is the base of every window part failure, each naming the module, keeping its cause and saying what failed", () => {
    const cause = new Error("It failed.");
    const exceptions = [
      new WindowPartLoadFailedException("notes", cause),
      new WindowPartActivationFailedException("notes", cause),
      new WindowPartReconnectionFailedException("notes", cause),
      new DependencyNotFollowedException("notes", cause),
      new SettingsPageNotLoadedException("notes", cause),
      new SettingOptionsFailedException("notes", "notes.font", cause),
      new WindowPartSaveFailedException("notes", "Sample App", cause),
      new WindowPartSaveFailedForUpdateException("notes", "Sample App", cause),
      new WindowPartSaveFailedLateException("notes", "Sample App", cause)
    ];

    expect(exceptions.map(t => [t instanceof WindowPartFailureException, t.moduleId, t.cause, t.name, t.message])).toEqual([
      [true, "notes", cause, "WindowPartLoadFailedException", "Its window part could not be loaded."],
      [true, "notes", cause, "WindowPartActivationFailedException", "Its window part failed to activate."],
      [true, "notes", cause, "WindowPartReconnectionFailedException", "Its window part failed to continue after the runtime started again."],
      [true, "notes", cause, "DependencyNotFollowedException", "Its window part failed to follow a change of a module it optionally depends on."],
      [true, "notes", cause, "SettingsPageNotLoadedException", "Its settings page could not be loaded."],
      [true, "notes", cause, "SettingOptionsFailedException", "Supplying the options of the setting notes.font failed; Settings shows its value alone until they are supplied again."],
      [true, "notes", cause, "WindowPartSaveFailedException", "Its window part failed to save while Sample App was closing."],
      [true, "notes", cause, "WindowPartSaveFailedForUpdateException", "Its window part failed to save while Sample App was preparing to install an update."],
      [true, "notes", cause, "WindowPartSaveFailedLateException", "Its window part failed to save after Sample App stopped waiting for it."]
    ]);
  });

  it("names the setting whose options failed or repeat a value, and the product that was closing", () => {
    const repeated = new SettingOptionsRepeatedException("notes", "notes.font");

    expect([repeated instanceof WindowPartFailureException, repeated.moduleId, repeated.setting, repeated.cause, repeated.name, repeated.message]).toEqual([
      true, "notes", "notes.font", undefined, "SettingOptionsRepeatedException",
      "The options supplied for the setting notes.font share a value; Settings shows its value alone until they are supplied again."
    ]);
    expect([
      new SettingOptionsFailedException("notes", "notes.font", null).setting,
      new WindowPartSaveFailedException("notes", "Sample App", null).productName,
      new WindowPartSaveFailedForUpdateException("notes", "Sample App", null).productName,
      new WindowPartSaveFailedLateException("notes", "Sample App", null).productName
    ]).toEqual(["notes.font", "Sample App", "Sample App", "Sample App"]);
  });
});

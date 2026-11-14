/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PreloadSettings } from "../../src/models/preload-settings.js";

@TestClass
export class PreloadSettingsTests {
  @TestMethod
  public carriesTheBridgeThePasteLimitAndTheChannelsTheMainProcessListensOn(): void {
    const settings = new PreloadSettings(null);

    Assert.areEqual("desktop", settings.bridge);
    Assert.areEqual(64 * 1024 * 1024, settings.pastedByteLimit);
    Assert.areEqual("desktop:ready|desktop:closeAnswer", `${settings.channels.ready}|${settings.channels.closeAnswer}`);
    Assert.isNull(settings.appearance);
  }

  @TestMethod
  public writesItselfAsOneArgumentAfterThePreloadPrefix(): void {
    const settings = new PreloadSettings({ background: "#181818" });

    const argument = settings.toArgument();

    Assert.areEqual(`--desktop-preload=${JSON.stringify({ bridge: "desktop", pastedByteLimit: 64 * 1024 * 1024, appearance: { background: "#181818" }, channels: settings.channels })}`, argument);
  }

  @TestMethod
  public writesAMissingAppearanceAsNull(): void {
    Assert.isTrue(new PreloadSettings(null).toArgument().includes("\"appearance\":null"), "the appearance is written as null");
  }
}

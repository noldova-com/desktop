/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HelpMenuFixture } from "./fixtures/help-menu.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";

test.describe("Help on Windows and Linux", () => {
  test.skip(process.platform === "darwin", "macOS shows Help in its own menu bar.");

  test("with updates off, Help in the window row holds Open log folder, then Copy details, and no Check for updates", async ({ mainProcess }) => {
    const window = mainProcess.window;
    expect((await PageBridgeFixture.evaluateAsync(window, t => t.readUpdate())).kind).toBe("Off");

    const help = await HelpMenuFixture.openInWindowAsync(window);
    await HelpMenuFixture.expectRowsAsync(help, [/Open log folder$/, /Copy details$/]);
    await mainProcess.checkpointAsync("help-menu");
    await window.keyboard.press("Escape");
    await expect(help).toHaveCount(0);
  });
});

test.describe("Help on macOS", () => {
  test.skip(process.platform !== "darwin", "Windows and Linux show Help in the window row.");

  test("with updates off, the native Help menu holds Open log folder, then Copy details, and the application menu has no Check for updates", async ({ mainProcess }) => {
    expect((await PageBridgeFixture.evaluateAsync(mainProcess.window, t => t.readUpdate())).kind).toBe("Off");

    await expect.poll(() => HelpMenuFixture.readNativeHelpAsync(mainProcess.application)).toEqual(["Open log folder", "Copy details"]);
    expect(await HelpMenuFixture.readNativeApplicationAsync(mainProcess.application)).not.toContain("Check for updates");
  });
});

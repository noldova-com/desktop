/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide, DocumentContribution, KeepsCtrlKeysDirective, LinkGesture, LinkPlace, PlaceholderContribution, SettingsRow, ViewContribution, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { LinkGesture as KitLinkGesture } from "@noldova/ui.components.angular";

import * as api from "../../src/api/index";
import { KeepsCtrlKeysDirective as SourceKeepsCtrlKeysDirective } from "../../src/app/directives/keeps-ctrl-keys.directive";
import { DockSide as SourceDockSide } from "../../src/app/enums/dock-side";
import { LinkPlace as SourceLinkPlace } from "../../src/app/enums/link-place";
import { WindowException as SourceWindowException } from "../../src/app/exceptions/window.exception";
import { DocumentContribution as SourceDocumentContribution } from "../../src/app/models/document-contribution";
import { MenuDeclarations } from "../../src/app/models/menu-declarations";
import { PlaceholderContribution as SourcePlaceholderContribution } from "../../src/app/models/placeholder-contribution";
import { SettingsRow as SourceSettingsRow } from "../../src/app/models/settings/settings-row";
import { ViewContribution as SourceViewContribution } from "../../src/app/models/view-contribution";
import { WindowPartSource } from "../../src/app/models/window-part-source";
import { WindowPartTokens as SourceWindowPartTokens } from "../../src/app/models/window-part-tokens";

describe("the window's API", () => {
  it("publishes the window-part contract", () => {
    expect([DockSide, DocumentContribution, KeepsCtrlKeysDirective, LinkGesture, LinkPlace, PlaceholderContribution, SettingsRow, ViewContribution, WindowException, WindowPartTokens])
      .toEqual([SourceDockSide, SourceDocumentContribution, SourceKeepsCtrlKeysDirective, KitLinkGesture, SourceLinkPlace, SourcePlaceholderContribution, SourceSettingsRow, SourceViewContribution, SourceWindowException, SourceWindowPartTokens]);
  });

  it("leaves what only the build's generated source uses to the build entry", () => {
    expect(Object.values(api)).not.toContain(MenuDeclarations);
    expect(Object.values(api)).not.toContain(WindowPartSource);
  });
});

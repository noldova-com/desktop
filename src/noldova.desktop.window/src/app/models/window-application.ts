/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ApplicationRef, ErrorHandler, inject, provideBrowserGlobalErrorListeners } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { ClipboardWriter, provideTimeFormats } from "@noldova/ui.components.angular";

import { WindowComponent } from "../components/window/window.component.js";
import type { IWindowInputs } from "../interfaces/i-window-inputs.js";
import { BuildTokens } from "./build-tokens.js";
import { GalleryTokens } from "./gallery-tokens.js";
import { MenuDeclarations } from "./menu-declarations.js";
import { ModuleSwitchTokens } from "./module-switch-tokens.js";
import { ProductName } from "./product-name.js";
import { ProductNameException } from "../exceptions/product-name.exception.js";
import { ClosingService } from "../services/closing.service.js";
import { PreloadBridgeService } from "../services/preload-bridge.service.js";
import { TimeFormatsService } from "../services/time-formats.service.js";
import { WindowErrorHandler } from "../services/window-error-handler.js";

export class WindowApplication {
  public static startAsync(inputs: IWindowInputs): Promise<ApplicationRef> {
    if (String.isNullOrWhitespace(inputs.productName))
      return Promise.reject(new ProductNameException());
    ProductName.use(inputs.productName);
    document.title = ProductName.current;
    return bootstrapApplication(WindowComponent, {
      providers: [
        provideBrowserGlobalErrorListeners(),
        { provide: ErrorHandler, useClass: WindowErrorHandler },
        { provide: BuildTokens.sources, useValue: inputs.windowParts },
        { provide: BuildTokens.menus, useValue: Object.entries(inputs.menus).map(([id, menus]) => MenuDeclarations.fromJson(id, menus)) },
        { provide: BuildTokens.about, useValue: inputs.about ?? BuildTokens.noAbout },
        { provide: BuildTokens.titleBar, useValue: inputs.titleBar ?? BuildTokens.noTitleBar },
        { provide: GalleryTokens.component, useValue: inputs.gallery },
        { provide: ClipboardWriter, useExisting: PreloadBridgeService },
        { provide: ModuleSwitchTokens.saver, useExisting: ClosingService },
        provideTimeFormats(() => inject(TimeFormatsService).formats),
        ...inputs.providers ?? []
      ]
    });
  }
}

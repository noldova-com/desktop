/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import { ShellDocuments } from "../models/shell-documents.js";
import { LayoutService } from "./layout.service.js";

@Injectable({ providedIn: "root" })
export class SettingsPageService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly requestedValue: WritableSignal<string | null> = signal(null, { equal: () => false });
  private requestedSetting: string | null = null;

  public readonly requested: Signal<string | null> = this.requestedValue.asReadonly();

  public open(page: string, setting: string | null = null): void {
    this.requestedSetting = setting;
    this.requestedValue.set(page);
    this.layout.openDocument(ShellDocuments.settingsTab);
  }

  public take(): string | null {
    const setting = this.requestedSetting;
    this.requestedSetting = null;
    this.requestedValue.set(null);
    return setting;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/context.json";
import { ModuleState, ModuleStatus, QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/desktop.protocol";

import { ModuleSwitchTokens } from "../../../src/app/models/module-switch-tokens";
import { ModuleStatusService } from "../../../src/app/services/module-status.service";
import { ModuleSwitchService } from "../../../src/app/services/module-switch.service";
import { SettingsService } from "../../../src/app/services/settings.service";

describe("ModuleSwitchService", () => {
  let calls: string[];
  let isSaved: boolean;
  let saving: Promise<void>;

  const status = (id: string, dependencies: readonly string[], switchSetting: string | null = null): ModuleStatus =>
    new ModuleStatus(id, "0.0.1", id, `${id} for the specs.`, dependencies, new Map(), ModuleState.Active, null, null, [], switchSetting);
  const define = (name: string, defaultValue: boolean): SettingDefinition =>
    new SettingDefinition(QualifiedName.parse(name), "Clock", "Turns the clock on.", SettingType.boolean(), defaultValue, SettingLocality.Shared, [], "Clock", "Clock");

  beforeEach(() => {
    calls = [];
    isSaved = true;
    saving = Promise.resolve();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SettingsService, useValue: {
            setAsync: (name: string, value: JsonValue): Promise<void> => {
              calls.push(`set ${name} ${JSON.stringify(value)}`);
              return Promise.resolve();
            },
            resetAsync: (name: string): Promise<void> => {
              calls.push(`reset ${name}`);
              return Promise.resolve();
            }
          }
        },
        {
          provide: ModuleSwitchTokens.saver, useValue: {
            saveModulesAsync: async (moduleIds: ReadonlySet<string>, formatFailed: (moduleName: string) => string): Promise<boolean> => {
              calls.push(`save ${[...moduleIds].join(",")}: ${formatFailed("Clock")}`);
              await saving;
              return isSaved;
            }
          }
        }
      ]
    });
    TestBed.inject(ModuleStatusService).set([
      status("clock", [], "clock.enabled"),
      status("alarm", ["clock"]),
      status("snooze", ["alarm"], "snooze.enabled"),
      status("notes", [])
    ]);
  });

  it("saves a module and every module that needs it before it writes false to the module's switch, and writes nothing when a save fails", async () => {
    const switches = TestBed.inject(ModuleSwitchService);

    await switches.setAsync("clock.enabled", false);
    isSaved = false;
    await switches.setAsync("clock.enabled", false);

    expect(calls).toEqual([
      "save clock,alarm,snooze: Clock couldn't save, so nothing was turned off",
      "set clock.enabled false",
      "save clock,alarm,snooze: Clock couldn't save, so nothing was turned off"
    ]);
  });

  it("ends with a module on when it is switched off and on again before its saves finish, writing each change in turn", async () => {
    const switches = TestBed.inject(ModuleSwitchService);
    let release: () => void = () => undefined;
    saving = new Promise<void>(resolve => {
      release = resolve;
    });

    const off = switches.setAsync("clock.enabled", false);
    const on = switches.setAsync("clock.enabled", true);
    await Promise.resolve();
    const beforeSaved = [...calls];
    release();
    await Promise.all([off, on]);

    expect(beforeSaved).toEqual(["save clock,alarm,snooze: Clock couldn't save, so nothing was turned off"]);
    expect(calls).toEqual(["save clock,alarm,snooze: Clock couldn't save, so nothing was turned off", "set clock.enabled false", "set clock.enabled true"]);
  });

  it("writes a setting's next change after one that failed, and rejects only the failed one", async () => {
    const switches = TestBed.inject(ModuleSwitchService);
    saving = Promise.reject(new Error("The save broke."));

    const off = switches.setAsync("clock.enabled", false);
    const on = switches.setAsync("clock.enabled", true);

    await expect(off).rejects.toThrow("The save broke.");
    await on;
    expect(calls).toEqual(["save clock,alarm,snooze: Clock couldn't save, so nothing was turned off", "set clock.enabled true"]);
  });

  it("writes true, and any setting that is no module's switch, without saving", async () => {
    isSaved = false;
    const switches = TestBed.inject(ModuleSwitchService);

    await switches.setAsync("clock.enabled", true);
    await switches.setAsync("notes.enabled", false);

    expect(calls).toEqual(["set clock.enabled true", "set notes.enabled false"]);
  });

  it("saves before a reset turns a module off, and resets a switch whose default is on without saving", async () => {
    const switches = TestBed.inject(ModuleSwitchService);

    await switches.resetAsync(define("snooze.enabled", false));
    await switches.resetAsync(define("clock.enabled", true));
    isSaved = false;
    await switches.resetAsync(define("snooze.enabled", false));

    expect(calls).toEqual([
      "save snooze: Clock couldn't save, so nothing was turned off",
      "reset snooze.enabled",
      "reset clock.enabled",
      "save snooze: Clock couldn't save, so nothing was turned off"
    ]);
  });
});

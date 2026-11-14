/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ModuleState, ModuleStatus } from "@noldova/desktop.protocol";
import { DependencyStates, ModuleDeclaration } from "@noldova/desktop.runtime";

@TestClass
export class DependencyStatesTests {
  private static readonly NOTES: ModuleDeclaration = new ModuleDeclaration(
    "notes", "0.0.1", "Notes", "Keeps notes.", new Map([["tasks", "0.0.1"]]), null, new Map(), [], null, [], null, false,
    new Map([["clock", "0.0.1"], ["theme", "0.0.1"], ["calendar", "0.0.1"], ["weather", "0.0.1"]]));

  @TestMethod
  public isAvailableOnlyForAnActiveModuleAtTheVersionTheModuleNeeds(): void {
    const states = new DependencyStates(t => DependencyStatesTests.read(t));

    const available = ["clock", "theme", "calendar", "weather", "tasks"].map(t => `${t} ${states.isAvailable(DependencyStatesTests.NOTES, t)}`);

    Assert.areEqual("clock true,theme false,calendar false,weather false,tasks true", available.join(","));
  }

  @TestMethod
  public tellsOnlyTheListenersOfModulesThatOptionallyDependOnTheChangedModuleUntilTheyStop(): void {
    const statuses = new Map<string, ModuleStatus>();
    const states = new DependencyStates(t => statuses.get(t));
    const heard: string[] = [];
    const stop = states.listen(DependencyStatesTests.NOTES, (moduleId, isActive) => heard.push(`notes ${moduleId} ${isActive}`));
    states.listen(new ModuleDeclaration("tasks", "0.0.1", "Tasks", "Keeps tasks.", new Map(), null, new Map()), (moduleId, isActive) => heard.push(`tasks ${moduleId} ${isActive}`));

    statuses.set("clock", DependencyStatesTests.describe("clock", "0.0.1", ModuleState.Active));
    states.announce("clock");
    states.announce("tasks");
    statuses.delete("clock");
    states.announce("clock");
    stop();
    statuses.set("clock", DependencyStatesTests.describe("clock", "0.0.1", ModuleState.Active));
    states.announce("clock");

    Assert.areEqual("notes clock true,notes clock false", heard.join(","));
  }

  @TestMethod
  public tellsNoListenerThatAnEarlierOneStoppedDuringTheSameChange(): void {
    const states = new DependencyStates(t => DependencyStatesTests.read(t));
    const heard: string[] = [];
    const stops: (() => void)[] = [];
    states.listen(DependencyStatesTests.NOTES, moduleId => {
      heard.push(`first ${moduleId}`);
      stops.forEach(t => t());
    });
    stops.push(states.listen(DependencyStatesTests.NOTES, moduleId => heard.push(`last ${moduleId}`)));

    states.announce("clock");
    states.announce("clock");

    Assert.areEqual("first clock,first clock", heard.join(","));
  }

  private static read(moduleId: string): ModuleStatus | undefined {
    switch (moduleId) {
      case "clock":
      case "tasks":
        return DependencyStatesTests.describe(moduleId, "0.0.1", ModuleState.Active);
      case "theme":
        return DependencyStatesTests.describe(moduleId, "0.0.2", ModuleState.Active);
      case "calendar":
        return DependencyStatesTests.describe(moduleId, "0.0.1", ModuleState.Failed);
      default:
        return undefined;
    }
  }

  private static describe(id: string, version: string, state: ModuleState): ModuleStatus {
    return new ModuleStatus(id, version, id, id, [], new Map(), state, state === ModuleState.Active ? null : "It failed.");
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class ModuleNotActiveExceptionTests {
  @TestMethod
  public async isReportedWithItsExitCodeTheRuntimesCauseAndTheModuleThatBlocksIt(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const status = await fixture.runModuleAsync(build, ["status", "--json"]);
    const modules = JsonReader.parse(status.output).readObjectArray("modules");
    const cause = (id: string): string => String(modules.find(t => t.readString("id") === id)?.readOptionalString("cause"));

    const failing = await fixture.runModuleAsync(build, ["failing", "run"]);
    const blocked = await fixture.runModuleAsync(build, ["blocked", "run", "--json"]);

    Assert.areEqual(7, failing.code, failing.error);
    Assert.areEqual(`The module failing is not active: ${cause("failing")}\n`, failing.error);
    Assert.areEqual(7, blocked.code, blocked.error);
    Assert.areEqual(JSON.stringify({
      code: "ModuleNotActive",
      message: `The module blocked is not active: ${cause("blocked")}`,
      details: { module: "blocked", cause: cause("blocked"), blockedBy: "failing" }
    }), blocked.error.trimEnd());
    Assert.areEqual(String.empty, await build.readPartsLogAsync());
  }

  @TestMethod
  public async isReportedForARuntimeCommandOnlyWhenItsModuleIsNotActive(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const failing = await fixture.runModuleAsync(build, ["run", "failing.run", "--json"]);
    const unknownModule = await fixture.runModuleAsync(build, ["run", "nosuch.run", "--json"]);
    const unknownCommand = await fixture.runModuleAsync(build, ["run", "probe.nope", "--json"]);

    Assert.areEqual(7, failing.code, failing.error);
    Assert.areEqual("ModuleNotActive", JsonReader.parse(failing.error).readString("code"));
    Assert.areEqual(1, unknownModule.code, unknownModule.error);
    Assert.areEqual("NotFound", JsonReader.parse(unknownModule.error).readString("code"));
    Assert.areEqual(1, unknownCommand.code, unknownCommand.error);
    Assert.areEqual("NotFound", JsonReader.parse(unknownCommand.error).readString("code"));
  }

  @TestMethod
  public async isReportedForAModuleThatIsOffWithTheSettingThatTurnsItOnAndForTheModulesThatNeedIt(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await build.addSwitchedModulesAsync();
    await fixture.startHostAsync(build.declarationsFile);
    const off = "It is off; the setting dormant.enabled turns it on.";
    const blocked = "It depends on dormant, which is off.";

    const status = await fixture.runModuleAsync(build, ["status", "--json"]);
    const dormant = await fixture.runModuleAsync(build, ["dormant", "run", "--json"]);
    const drowsy = await fixture.runModuleAsync(build, ["drowsy", "run"]);
    const modules = JsonReader.parse(status.output).readObjectArray("modules").map(t => ({ id: t.readString("id"), state: t.readString("state"), cause: t.readOptionalString("cause") }));

    Assert.areEqual(`dormant|Off|,drowsy|Blocked|${blocked}`,
      modules.filter(t => ["dormant", "drowsy"].includes(t.id)).map(t => `${t.id}|${t.state}|${t.cause ?? String.empty}`).join(","));
    Assert.areEqual(7, dormant.code, dormant.error);
    Assert.areEqual(JSON.stringify({ code: "ModuleNotActive", message: `The module dormant is not active: ${off}`, details: { module: "dormant", cause: off } }),
      dormant.error.trimEnd());
    Assert.areEqual(7, drowsy.code, drowsy.error);
    Assert.areEqual(`The module drowsy is not active: ${blocked}\n`, drowsy.error);
    Assert.areEqual(String.empty, await build.readPartsLogAsync());
  }

  @TestMethod
  public async isReportedForAModuleTheRunningRuntimeDoesNotHave(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using plain = await ProbeBuildFixture.createAsync("1.0.0");
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(plain.declarationsFile);

    const result = await fixture.runModuleAsync(build, ["needy", "run"]);

    Assert.areEqual(7, result.code, result.error);
    Assert.areEqual("The module needy is not active: The runtime does not have it.\n", result.error);
    Assert.areEqual(String.empty, await build.readPartsLogAsync());
  }
}

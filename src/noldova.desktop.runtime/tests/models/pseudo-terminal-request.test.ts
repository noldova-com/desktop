/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PseudoTerminalRequest } from "@noldova/desktop.runtime";

import { PseudoTerminalLibraryFixture } from "../fixtures/pseudo-terminal-library.fixture.js";

@TestClass
export class PseudoTerminalRequestTests {
  private static readonly FOLDER: string = path.resolve("project");
  private static readonly COMMAND_LINE: string = "/d /s /c \"echo \"a b\"\"";

  @TestMethod
  public keepsCopiesOfWhatItIsGivenAndNeitherInheritsTheCursorNorHasACommandLineByDefault(): void {
    const library = new PseudoTerminalLibraryFixture();
    const launchArguments = ["-l"];
    const environment: Record<string, string> = { TERM_PROGRAM: "noldova" };
    const controller = new AbortController();

    const plain = new PseudoTerminalRequest(library, "bash", launchArguments, PseudoTerminalRequestTests.FOLDER, 80, 24, environment);
    const inheriting = new PseudoTerminalRequest(library, "bash", [], PseudoTerminalRequestTests.FOLDER, 1, 1, {}, { inheritCursor: true, signal: controller.signal });
    const verbatim = new PseudoTerminalRequest(library, "cmd.exe", [], PseudoTerminalRequestTests.FOLDER, 80, 24, {}, { commandLine: PseudoTerminalRequestTests.COMMAND_LINE });
    launchArguments.push("-i");
    environment["TERM_PROGRAM"] = "other";

    Assert.areEqual(library, plain.library);
    Assert.areEqual("bash -l", [plain.program, ...plain.arguments].join(" "));
    Assert.areEqual(PseudoTerminalRequestTests.FOLDER, plain.workingFolder);
    Assert.areEqual("80x24", `${plain.columns}x${plain.rows}`);
    Assert.areEqual("noldova", plain.environment["TERM_PROGRAM"]);
    Assert.isFalse(plain.inheritsCursor);
    Assert.isUndefined(plain.signal);
    Assert.isTrue(inheriting.inheritsCursor);
    Assert.areEqual(controller.signal, inheriting.signal);
    Assert.isUndefined(plain.commandLine);
    Assert.areEqual(PseudoTerminalRequestTests.COMMAND_LINE, verbatim.commandLine);
  }

  @TestMethod
  public refusesABlankProgramARelativeFolderAnInvalidVariableNameAndASizeBelowOneCell(): void {
    const library = new PseudoTerminalLibraryFixture();
    const folder = PseudoTerminalRequestTests.FOLDER;
    const refused = (create: () => PseudoTerminalRequest): string => Assert.throws(create, ArgumentException).message;

    Assert.isTrue(refused(() => new PseudoTerminalRequest(library, " ", [], folder, 80, 24, {})).endsWith("(Parameter 'program')"));
    Assert.isTrue(refused(() => new PseudoTerminalRequest(library, "bash", [], "project", 80, 24, {})).endsWith("(Parameter 'workingFolder')"));
    Assert.areEqual("\"A=B\" is not an environment variable's name. (Parameter 'environment')", refused(() => new PseudoTerminalRequest(library, "bash", [], folder, 80, 24, { "A=B": "c" })));
    Assert.areEqual("\"\" is not an environment variable's name. (Parameter 'environment')", refused(() => new PseudoTerminalRequest(library, "bash", [], folder, 80, 24, { "": "c" })));
    for (const columns of [0, 1.5, Number.NaN])
      Assert.areEqual("A pseudo-terminal's columns must be a whole number of at least 1. (Parameter 'columns')", refused(() => new PseudoTerminalRequest(library, "bash", [], folder, columns, 24, {})));
    for (const rows of [-1, 2.5, Number.POSITIVE_INFINITY])
      Assert.areEqual("A pseudo-terminal's rows must be a whole number of at least 1. (Parameter 'rows')", refused(() => new PseudoTerminalRequest(library, "bash", [], folder, 80, rows, {})));
  }
}

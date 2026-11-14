/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { ModuleCliCommands } from "../../../src/services/modules/module-cli-commands.js";

@TestClass
export class ModuleCliCommandsTests {
  private static readonly FOLDER: string = "notes";
  private static readonly FILE: string = "notes/cli.json";

  @TestMethod
  public async readsTheCommandsWithTheirDefaultsAsync(): Promise<void> {
    const commands = await ModuleCliCommandsTests.readAsync({
      commands: [
        {
          name: "export",
          summary: "Exports the notes.",
          description: "Writes every note into a folder.",
          arguments: [{ name: "folder", description: "Where to write." }, { name: "names", description: "Which notes.", required: false, variadic: true }],
          options: [
            { name: "isQuiet", description: "Says nothing.", type: "Boolean" },
            { name: "format", description: "The format.", type: "Text", default: "markdown" },
            { name: "limit", description: "At most.", type: "Number", default: 10 },
            { name: "tag", description: "A tag.", type: "Text", required: true, repeated: false }
          ],
          examples: [{ arguments: "./out", description: "Exports into out." }]
        },
        { name: "list", summary: "Lists the notes.", arguments: [], options: [] }
      ]
    }, ["export", "list"]);

    Assert.areEqual(JSON.stringify([
      {
        name: "export",
        summary: "Exports the notes.",
        description: "Writes every note into a folder.",
        arguments: [{ name: "folder", description: "Where to write.", required: true, variadic: false }, { name: "names", description: "Which notes.", required: false, variadic: true }],
        options: [
          { name: "isQuiet", description: "Says nothing.", type: "Boolean", required: false, repeated: false, default: null },
          { name: "format", description: "The format.", type: "Text", required: false, repeated: false, default: "markdown" },
          { name: "limit", description: "At most.", type: "Number", required: false, repeated: false, default: 10 },
          { name: "tag", description: "A tag.", type: "Text", required: true, repeated: false, default: null }
        ],
        examples: [{ arguments: "./out", description: "Exports into out." }]
      },
      { name: "list", summary: "Lists the notes.", description: null, arguments: [], options: [], examples: [] }
    ]), JSON.stringify(commands));
  }

  @TestMethod
  public async readsNoCommandsWithoutAFileOrAnyDeclaredAsync(): Promise<void> {
    Assert.areEqual(0, (await ModuleCliCommandsTests.readAsync(undefined, [])).length);
  }

  @TestMethod
  public async refusesDeclaredCommandsWithoutAFileAsync(): Promise<void> {
    await ModuleCliCommandsTests.assertRefusedAsync(undefined, ["export"], Resources.formatCliCommandsMissing(ModuleCliCommandsTests.FOLDER, ModuleCliCommandsTests.FILE));
  }

  @TestMethod
  public async refusesAFileThatIsNotJsonAsync(): Promise<void> {
    await ModuleCliCommandsTests.assertRefusedAsync("{", [], Resources.formatJsonFileUnreadable(ModuleCliCommandsTests.FILE));
  }

  @TestMethod
  @TestData("{\"commands\":[],\"other\":1}")
  @TestData("{\"commands\":{}}")
  @TestData("{}")
  public async refusesAFileWithMoreThanAListOfCommandsAsync(text: string): Promise<void> {
    const parsed: unknown = JSON.parse(text);

    await ModuleCliCommandsTests.assertRefusedAsync(parsed, [], Resources.formatCliFileNotCommands(ModuleCliCommandsTests.FILE));
  }

  @TestMethod
  @TestData("[\"list\",\"list\"]", "[\"list\"]")
  @TestData("[\"list\"]", "[\"list\",\"export\"]")
  @TestData("[\"list\",\"export\"]", "[\"list\"]")
  public async refusesCommandsThatDoNotMatchTheDeclaredOnesAsync(names: string, declared: string): Promise<void> {
    const listed: unknown = JSON.parse(names);
    const commands = Array.isArray(listed) ? listed.map((t: unknown) => ({ name: t, summary: "Does it.", arguments: [], options: [] })) : [];
    const declaredNames: unknown = JSON.parse(declared);

    await ModuleCliCommandsTests.assertRefusedAsync({ commands }, Array.isArray(declaredNames) ? declaredNames.map(String) : [], Resources.formatCliCommandsMismatch(ModuleCliCommandsTests.FILE));
  }

  @TestMethod
  @TestData("\"export\"", `commands[0] ${Resources.formatCliFieldsExpected(Resources.cliCommandFields, Resources.cliOptionalCommandFields)}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[],\"other\":1}", `commands[0] ${Resources.formatCliFieldsExpected(Resources.cliCommandFields, Resources.cliOptionalCommandFields)}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[]}", `commands[0] ${Resources.formatCliFieldsExpected(Resources.cliCommandFields, Resources.cliOptionalCommandFields)}`)
  @TestData("{\"name\":\" \",\"summary\":\"s\",\"arguments\":[],\"options\":[]}", `commands[0] ${Resources.cliNameOrSummaryBlank}`)
  @TestData("{\"name\":\"export\",\"summary\":1,\"arguments\":[],\"options\":[]}", `commands[0] ${Resources.cliNameOrSummaryBlank}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"description\":\" \",\"arguments\":[],\"options\":[]}", `commands[0] ${Resources.cliDescriptionBlank}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":\"a\",\"options\":[]}", `commands[0] ${Resources.formatModuleListMissing("arguments")}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[],\"examples\":{}}", `commands[0] ${Resources.formatModuleListMissing("examples")}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[1],\"options\":[]}", `commands[0] arguments[0] ${Resources.formatCliFieldsExpected(Resources.cliArgumentFields, Resources.cliArgumentOptionalFields)}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[{\"name\":\"Folder\",\"description\":\"d\"}],\"options\":[]}", `commands[0] arguments[0] ${Resources.cliMemberInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[{\"name\":1,\"description\":\"d\"}],\"options\":[]}", `commands[0] arguments[0] ${Resources.cliMemberInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[{\"name\":\"folder\",\"description\":\" \"}],\"options\":[]}", `commands[0] arguments[0] ${Resources.cliMemberInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[{\"name\":\"folder\",\"description\":\"d\",\"required\":\"yes\"}],\"options\":[]}", `commands[0] arguments[0] ${Resources.cliArgumentFlagsNotBoolean}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[{\"name\":\"folder\",\"description\":\"d\",\"variadic\":1}],\"options\":[]}", `commands[0] arguments[0] ${Resources.cliArgumentFlagsNotBoolean}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[1]}", `commands[0] options[0] ${Resources.cliOptionTypeInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"at\",\"description\":\"d\",\"type\":\"Date\"}]}", `commands[0] options[0] ${Resources.cliOptionTypeInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"at\",\"description\":\"d\",\"type\":1}]}", `commands[0] options[0] ${Resources.cliOptionTypeInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"quiet\",\"description\":\"d\",\"type\":\"Boolean\",\"required\":true}]}", `commands[0] options[0] ${Resources.formatCliFieldsExpected(Resources.cliBooleanFields, [])}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"Quiet\",\"description\":\"d\",\"type\":\"Boolean\"}]}", `commands[0] options[0] ${Resources.cliMemberInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"tag\",\"type\":\"Text\"}]}", `commands[0] options[0] ${Resources.formatCliFieldsExpected(Resources.cliValueFields, Resources.cliValueOptionalFields)}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"tag\",\"description\":\" \",\"type\":\"Text\"}]}", `commands[0] options[0] ${Resources.cliMemberInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"tag\",\"description\":\"d\",\"type\":\"Text\",\"required\":1}]}", `commands[0] options[0] ${Resources.cliValueFlagsNotBoolean}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"tag\",\"description\":\"d\",\"type\":\"Text\",\"repeated\":\"no\"}]}", `commands[0] options[0] ${Resources.cliValueFlagsNotBoolean}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"tag\",\"description\":\"d\",\"type\":\"Text\",\"default\":1}]}", `commands[0] options[0] ${Resources.cliDefaultInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"limit\",\"description\":\"d\",\"type\":\"Number\",\"default\":\"1\"}]}", `commands[0] options[0] ${Resources.cliDefaultInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"tag\",\"description\":\"d\",\"type\":\"Text\",\"required\":true,\"default\":\"a\"}]}", `commands[0] options[0] ${Resources.cliDefaultInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"tag\",\"description\":\"d\",\"type\":\"Text\",\"repeated\":true,\"default\":\"a\"}]}", `commands[0] options[0] ${Resources.cliDefaultInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[],\"examples\":[{\"arguments\":1,\"description\":\"d\"}]}", `commands[0] examples[0] ${Resources.cliExampleInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[],\"examples\":[{\"arguments\":\"a\",\"description\":\" \"}]}", `commands[0] examples[0] ${Resources.cliExampleInvalid}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[],\"examples\":[{\"arguments\":\"a\"}]}", `commands[0] examples[0] ${Resources.formatCliFieldsExpected(Resources.cliExampleFields, [])}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[{\"name\":\"tag\",\"description\":\"d\"}],\"options\":[{\"name\":\"tag\",\"description\":\"d\",\"type\":\"Boolean\"}]}", `commands[0] ${Resources.cliNamesRepeated}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[{\"name\":\"first\",\"description\":\"d\",\"required\":false},{\"name\":\"second\",\"description\":\"d\"}],\"options\":[]}", `commands[0] ${Resources.cliRequiredAfterOptional}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[{\"name\":\"first\",\"description\":\"d\",\"variadic\":true},{\"name\":\"second\",\"description\":\"d\"}],\"options\":[]}", `commands[0] ${Resources.cliVariadicNotLast}`)
  @TestData("{\"name\":\"export\",\"summary\":\"s\",\"arguments\":[],\"options\":[{\"name\":\"dataDir\",\"description\":\"d\",\"type\":\"Text\"},{\"name\":\"json\",\"description\":\"d\",\"type\":\"Boolean\"}]}", `commands[0] ${Resources.formatCliGlobalOptions(["data-dir", "json"])}`)
  public async refusesACommandThatBreaksTheContractAsync(command: string, problem: string): Promise<void> {
    const parsed: unknown = JSON.parse(command);

    await ModuleCliCommandsTests.assertRefusedAsync({ commands: [parsed] }, ["export"], Resources.formatModuleFileProblem(ModuleCliCommandsTests.FILE, problem));
  }

  private static async assertRefusedAsync(content: unknown, declared: readonly string[], message: string): Promise<void> {
    const error = await Assert.throwsAsync(() => ModuleCliCommandsTests.readAsync(content, declared), BuildException);

    Assert.areEqual(message, error.message);
  }

  private static async readAsync(content: unknown, declared: readonly string[]): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const root = await mkdtemp(path.join(tmpdir(), "module-cli-commands-"));
    try {
      await mkdir(path.join(root, ModuleCliCommandsTests.FOLDER));
      if (Object.isString(content))
        await writeFile(path.join(root, ModuleCliCommandsTests.FILE), content);
      else if (!Object.isUndefined(content))
        await writeFile(path.join(root, ModuleCliCommandsTests.FILE), JSON.stringify(content));
      return await ModuleCliCommands.readAsync(root, ModuleCliCommandsTests.FOLDER, new Map([["cliCommands", declared]]));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class ModuleCliCommands {
  public static async readAsync(root: string, folder: string, contributions: ReadonlyMap<string, readonly string[]>): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const file = Resources.formatFolderFile(folder, Resources.cliFileName);
    const declared = contributions.get(Resources.cliCommandsKind) ?? [];
    if (!existsSync(path.join(root, file))) {
      if (declared.length > 0)
        throw new BuildException(Resources.formatCliCommandsMissing(folder, file));
      return [];
    }
    let value: JsonObject;
    try {
      value = JsonReader.parse(await readFile(path.join(root, file), Resources.textEncoding)).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatJsonFileUnreadable(file), new ExceptionOptions(error));
    }
    const top = new Map(Object.entries(value));
    const commands = top.get(Resources.commandsKind);
    if (top.size !== 1 || !Array.isArray(commands))
      throw new BuildException(Resources.formatCliFileNotCommands(file));
    const definitions = commands.map((t, index) =>
      ModuleCliCommands.readCommand(t, (problem: string) => new BuildException(Resources.formatModuleFileProblem(file, Resources.formatIndexedProblem(Resources.commandsKind, index, problem)))));
    const names = definitions.map(t => String(t[Resources.nameField]));
    if (new Set(names).size !== names.length || declared.some(t => !names.includes(t)) || names.some(t => !declared.includes(t)))
      throw new BuildException(Resources.formatCliCommandsMismatch(file));
    return definitions;
  }

  private static readCommand(value: unknown, fail: (problem: string) => BuildException): Readonly<Record<string, unknown>> {
    const record = ModuleCliCommands.readFields(value, Resources.cliCommandFields, Resources.cliOptionalCommandFields, fail);
    if (!ModuleCliCommands.isText(record.get(Resources.nameField)) || !ModuleCliCommands.isText(record.get(Resources.summaryField)))
      throw fail(Resources.cliNameOrSummaryBlank);
    const description = record.get(Resources.descriptionField) ?? null;
    if (!Object.isNull(description) && !ModuleCliCommands.isText(description))
      throw fail(Resources.cliDescriptionBlank);
    const commandArguments = ModuleCliCommands.readEach(record.get(Resources.argumentsField), fail, Resources.argumentsField, ModuleCliCommands.readArgument);
    const options = ModuleCliCommands.readEach(record.get(Resources.optionsField), fail, Resources.optionsField, ModuleCliCommands.readOption);
    const examples = ModuleCliCommands.readEach(record.get(Resources.examplesField) ?? [], fail, Resources.examplesField, ModuleCliCommands.readExample);
    const names = [...commandArguments, ...options].map(t => t[Resources.nameField]);
    if (new Set(names).size !== names.length)
      throw fail(Resources.cliNamesRepeated);
    const required = commandArguments.map(t => t[Resources.requiredField] === true);
    if (required.some((t, index) => t && required.slice(0, index).includes(false)))
      throw fail(Resources.cliRequiredAfterOptional);
    if (commandArguments.slice(0, -1).some(t => t[Resources.variadicField] === true))
      throw fail(Resources.cliVariadicNotLast);
    const global = options.map(t => ModuleCliCommands.toKebabCase(String(t[Resources.nameField]))).filter(t => Resources.reservedOptions.includes(t));
    if (global.length > 0)
      throw fail(Resources.formatCliGlobalOptions(global));
    return { name: record.get(Resources.nameField), summary: record.get(Resources.summaryField), description, arguments: commandArguments, options, examples };
  }

  private static readArgument(value: unknown, fail: (problem: string) => BuildException): Readonly<Record<string, unknown>> {
    const record = ModuleCliCommands.readFields(value, Resources.cliArgumentFields, Resources.cliArgumentOptionalFields, fail);
    ModuleCliCommands.readMember(record, fail);
    const required = record.get(Resources.requiredField) ?? true;
    const variadic = record.get(Resources.variadicField) ?? false;
    if (!Object.isBoolean(required) || !Object.isBoolean(variadic))
      throw fail(Resources.cliArgumentFlagsNotBoolean);
    return { name: record.get(Resources.nameField), description: record.get(Resources.descriptionField), required, variadic };
  }

  private static readOption(value: unknown, fail: (problem: string) => BuildException): Readonly<Record<string, unknown>> {
    const type = ModuleCliCommands.record(value)?.get(Resources.typeField);
    if (!Object.isString(type) || !Resources.cliOptionTypes.includes(type))
      throw fail(Resources.cliOptionTypeInvalid);
    if (type === Resources.booleanType) {
      const record = ModuleCliCommands.readFields(value, Resources.cliBooleanFields, [], fail);
      ModuleCliCommands.readMember(record, fail);
      return { name: record.get(Resources.nameField), description: record.get(Resources.descriptionField), type, required: false, repeated: false, default: null };
    }
    const record = ModuleCliCommands.readFields(value, Resources.cliValueFields, Resources.cliValueOptionalFields, fail);
    ModuleCliCommands.readMember(record, fail);
    const required = record.get(Resources.requiredField) ?? false;
    const repeated = record.get(Resources.repeatedField) ?? false;
    if (!Object.isBoolean(required) || !Object.isBoolean(repeated))
      throw fail(Resources.cliValueFlagsNotBoolean);
    const fallback = record.get(Resources.defaultField) ?? null;
    const isAccepted = type === Resources.textType ? Object.isString(fallback) : Object.isNumber(fallback);
    if (!Object.isNull(fallback) && (!isAccepted || required || repeated))
      throw fail(Resources.cliDefaultInvalid);
    return { name: record.get(Resources.nameField), description: record.get(Resources.descriptionField), type, required, repeated, default: fallback };
  }

  private static readExample(value: unknown, fail: (problem: string) => BuildException): Readonly<Record<string, unknown>> {
    const record = ModuleCliCommands.readFields(value, Resources.cliExampleFields, [], fail);
    if (!Object.isString(record.get(Resources.argumentsField)) || !ModuleCliCommands.isText(record.get(Resources.descriptionField)))
      throw fail(Resources.cliExampleInvalid);
    return Object.fromEntries(record);
  }

  private static readMember(record: ReadonlyMap<string, unknown>, fail: (problem: string) => BuildException): void {
    const name = record.get(Resources.nameField);
    if (!Object.isString(name) || !Resources.camelCaseNamePattern.test(name) || !ModuleCliCommands.isText(record.get(Resources.descriptionField)))
      throw fail(Resources.cliMemberInvalid);
  }

  private static readFields(value: unknown, fields: readonly string[], optional: readonly string[], fail: (problem: string) => BuildException): ReadonlyMap<string, unknown> {
    const record = ModuleCliCommands.record(value);
    if (Object.isNull(record) || [...record.keys()].some(t => !fields.includes(t)) || fields.some(t => !optional.includes(t) && !record.has(t)))
      throw fail(Resources.formatCliFieldsExpected(fields, optional));
    return record;
  }

  private static readEach(
    value: unknown,
    fail: (problem: string) => BuildException,
    field: string,
    read: (item: unknown, fail: (problem: string) => BuildException) => Readonly<Record<string, unknown>>
  ): readonly Readonly<Record<string, unknown>>[] {
    if (!Array.isArray(value))
      throw fail(Resources.formatModuleListMissing(field));
    return value.map((t: unknown, index) => read(t, (problem: string) => fail(Resources.formatIndexedProblem(field, index, problem))));
  }

  private static toKebabCase(name: string): string {
    return name.replace(Resources.upperCaseLetterPattern, t => Resources.formatKebabSegment(t));

  }

  private static record(value: unknown): Map<string, unknown> | null {
    return Object.isPlainObject(value) ? new Map<string, unknown>(Object.entries(value)) : null;
  }

  private static isText(value: unknown): boolean {
    return Object.isString(value) && !String.isNullOrWhitespace(value);
  }
}

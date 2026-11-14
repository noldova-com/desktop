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
import type { IModuleSettingsFile } from "../../interfaces/i-module-settings-file.ts";
import type { ISettingsPageJson } from "../../interfaces/i-settings-page-json.ts";
import { Resources } from "../../resources.ts";

export class ModuleSettings {
  public static async readAsync(
    root: string,
    folder: string,
    dependencies: readonly string[],
    contributions: ReadonlyMap<string, readonly string[]>
  ): Promise<IModuleSettingsFile> {
    const file = Resources.formatFolderFile(folder, Resources.settingsFileName);
    const declared = contributions.get(Resources.settingsKind) ?? [];
    const declaredPages = contributions.get(Resources.settingsPagesKind) ?? [];
    if (!existsSync(path.join(root, file))) {
      if (declared.length > 0 || declaredPages.length > 0)
        throw new BuildException(Resources.formatSettingsMissing(folder, file));
      return { settings: [], pages: [] };
    }
    let value: JsonObject;
    try {
      value = JsonReader.parse(await readFile(path.join(root, file), Resources.textEncoding)).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatJsonFileUnreadable(file), new ExceptionOptions(error));
    }
    const top = new Map(Object.entries(value));
    const settings = top.get(Resources.settingsKind);
    if (!Array.isArray(settings) || [...top.keys()].some(t => !Resources.settingsFileFields.includes(t)))
      throw new BuildException(Resources.formatSettingsFileInvalid(file));
    const scopes = contributions.get(Resources.settingScopesKind) ?? [];
    const commands = contributions.get(Resources.commandsKind) ?? [];
    const definitions = settings.map((t, index) =>
      ModuleSettings.readDefinition(
        t, (problem: string) => new BuildException(Resources.formatModuleFileProblem(file, Resources.formatIndexedProblem(Resources.settingsKind, index, problem))), dependencies, scopes, commands));
    const names = definitions.map(t => String(t[Resources.nameField]));
    const undefinedNames = declared.filter(t => !names.includes(t));
    if (new Set(names).size !== names.length || undefinedNames.length > 0 || names.some(t => !declared.includes(t)))
      throw new BuildException(Resources.formatSettingsMismatch(file));
    const pages = ModuleSettings.readPages(top.get(Resources.pagesField) ?? [], file, declaredPages);
    return { settings: definitions, pages };
  }

  private static readPages(value: unknown, file: string, declared: readonly string[]): readonly ISettingsPageJson[] {
    const records = Array.isArray(value) ? value.map(t => ModuleSettings.record(t)) : [null];
    const pages = records.map((t, index) => {
      if (Object.isNull(t) || t.size !== Resources.settingsPageFields.length || !Resources.settingsPageFields.every(u => t.has(u)) || !Object.isString(t.get(Resources.nameField))
        || !ModuleSettings.isText(t.get(Resources.titleField)))
        throw new BuildException(Resources.formatSettingsPageInvalid(file, index));
      return { name: String(t.get(Resources.nameField)), title: String(t.get(Resources.titleField)) };
    });
    const names = pages.map(t => t.name);
    if (new Set(names).size !== names.length || declared.some(t => !names.includes(t)) || names.some(t => !declared.includes(t)))
      throw new BuildException(Resources.formatSettingsPagesMismatch(file));
    return pages;
  }

  private static readDefinition(
    value: unknown,
    fail: (problem: string) => BuildException,
    dependencies: readonly string[],
    ownScopes: readonly string[],
    commands: readonly string[]
  ): Readonly<Record<string, unknown>> {
    const record = ModuleSettings.record(value);
    if (Object.isNull(record) || record.size !== Resources.settingFields.length || !Resources.settingFields.every(t => record.has(t)))
      throw fail(Resources.settingFieldsInvalid);
    if (!Resources.settingTextFields.every(t => ModuleSettings.isText(record.get(t))))
      throw fail(Resources.settingTextsBlank);
    const accepts = ModuleSettings.readType(record.get(Resources.typeField), fail, commands);
    if (!accepts(record.get(Resources.defaultField)))
      throw fail(Resources.settingDefaultInvalid);
    const locality = record.get(Resources.localityField);
    if (!Object.isString(locality) || !Resources.settingLocalities.includes(locality))
      throw fail(Resources.settingLocalityInvalid);
    const scopes = record.get(Resources.scopesField);
    const isScope = (scope: unknown): boolean => Object.isString(scope) &&
      (ownScopes.includes(scope) || dependencies.some(t => scope.startsWith(Resources.formatQualifiedPrefix(t))));
    if (!Array.isArray(scopes) || !scopes.every(isScope) || new Set(scopes).size !== scopes.length || (locality === Resources.deviceLocality && scopes.length > 0))
      throw fail(Resources.settingScopesInvalid);
    return Object.fromEntries(record);
  }

  private static readType(value: unknown, fail: (problem: string) => BuildException, commands: readonly string[]): (candidate: unknown) => boolean {
    const record = ModuleSettings.record(value);
    const kind = record?.get(Resources.kindField);
    const fields = kind === Resources.choiceType && record?.has(Resources.dynamicField) === true ? Resources.settingDynamicChoiceFields
      : kind === Resources.textType && record?.has(Resources.checkedField) === true ? Resources.settingCheckedTextFields
        : Object.isString(kind) ? Resources.settingKindFields.get(kind) : undefined;
    if (Object.isNull(record) || Object.isUndefined(fields) || record.size !== fields.length + 1 || !fields.every(t => record.has(t)))
      throw fail(Resources.settingTypeInvalid);
    switch (kind) {
      case Resources.choiceType:
        if (record.has(Resources.dynamicField)) {
          if (record.get(Resources.dynamicField) !== true)
            throw fail(Resources.settingDynamicChoiceInvalid);
          return t => Object.isString(t);
        }
        return ModuleSettings.readChoice(record.get(Resources.optionsField), fail);
      case Resources.numberType:
        return ModuleSettings.readNumber(record.get(Resources.minimumField), record.get(Resources.maximumField), record.get(Resources.stepField), fail);
      case Resources.textType: {
        const maxLength = record.get(Resources.maxLengthField);
        if (!Number.isInteger(maxLength) || Number(maxLength) <= 0)
          throw fail(Resources.settingTextMaxLengthInvalid);
        if (record.has(Resources.checkedField) && record.get(Resources.checkedField) !== true)
          throw fail(Resources.settingCheckedTextInvalid);
        return t => Object.isString(t) && t.length <= Number(maxLength);
      }
      case Resources.modulesType:
        return t => Array.isArray(t) && t.every(ModuleSettings.isText) && new Set(t).size === t.length;
      case Resources.actionType:
        if (!commands.includes(String(record.get(Resources.commandField))) || !ModuleSettings.isText(record.get(Resources.labelField)))
          throw fail(Resources.settingActionInvalid);
        return t => Object.isNull(t);
      default:
        return t => Object.isBoolean(t);
    }
  }

  private static readChoice(options: unknown, fail: (problem: string) => BuildException): (candidate: unknown) => boolean {
    const values = Array.isArray(options) ? options.map(t => {
      const option = ModuleSettings.record(t);
      const optionValue = option?.get(Resources.valueField);
      return option?.size === Resources.settingChoiceOptionFieldCount && (optionValue === String.empty || ModuleSettings.isText(optionValue)) && ModuleSettings.isText(option.get(Resources.titleField)) ? optionValue : null;
    }) : [];
    if (values.length === 0 || values.includes(null) || new Set(values).size !== values.length)
      throw fail(Resources.settingChoiceInvalid);
    return t => values.includes(t);
  }

  private static readNumber(minimum: unknown, maximum: unknown, step: unknown, fail: (problem: string) => BuildException): (candidate: unknown) => boolean {
    if (![minimum, maximum, step].every(t => Object.isNumber(t) && Number.isFinite(t)) || Number(minimum) > Number(maximum) || Number(step) <= 0)
      throw fail(Resources.settingNumberInvalid);
    return t => {
      const steps = (Number(t) - Number(minimum)) / Number(step);
      return Object.isNumber(t) && t >= Number(minimum) && t <= Number(maximum) && Math.abs(steps - Math.round(steps)) < Resources.settingStepTolerance;

    };
  }

  private static record(value: unknown): Map<string, unknown> | null {
    return Object.isPlainObject(value) ? new Map<string, unknown>(Object.entries(value)) : null;
  }

  private static isText(value: unknown): boolean {
    return Object.isString(value) && !String.isNullOrWhitespace(value);
  }
}

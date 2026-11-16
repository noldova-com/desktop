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
import type { IWebViewKeyJson } from "../../interfaces/i-web-view-key-json.ts";
import { Resources } from "../../resources.ts";
import { WebViewKeys } from "../../models/modules/web-view-keys.ts";

export class ModuleWebViews {
  public static async readAsync(root: string, folder: string): Promise<Readonly<Record<string, unknown>> | null> {
    const file = Resources.formatFolderFile(folder, Resources.webViewsFileName);
    if (!existsSync(path.join(root, file)))
      return null;
    let value: JsonObject;
    try {
      value = JsonReader.parse(await readFile(path.join(root, file), Resources.textEncoding)).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatJsonFileUnreadable(file), new ExceptionOptions(error));
    }
    const fail = (problem: string): BuildException => new BuildException(Resources.formatModuleFileProblem(file, problem));
    const top = ModuleWebViews.readRecord(value, Resources.webViewFields, fail, Resources.webViewFileInvalid);
    const methods = ModuleWebViews.readArray(top.get(Resources.methodsKind) ?? [], fail, Resources.methodsKind).map((t, index) => ModuleWebViews.readMethod(t, index, fail));
    const names = methods.map(t => String(t[Resources.nameField]));
    if (new Set(names).size !== names.length)
      throw fail(Resources.webViewMethodRepeated);
    const events = ModuleWebViews.readArray(top.get(Resources.eventsKind) ?? [], fail, Resources.eventsKind);
    if (!events.every(t => Object.isString(t) && Resources.webViewMethodPattern.test(t)) || new Set(events).size !== events.length)
      throw fail(Resources.webViewEventsInvalid);
    const newWindows = top.has(Resources.newWindowsField) ? top.get(Resources.newWindowsField) : false;
    if (!Object.isBoolean(newWindows))
      throw fail(Resources.webViewNewWindowsNotBoolean);
    const windows = newWindows ? { newWindows } : {};
    if (!top.has(Resources.keysField) && !top.has(Resources.loadingKeysField))
      return { methods, events, ...windows };
    const keys = ModuleWebViews.readKeys(top, Resources.keysField, fail);
    const loadingKeys = ModuleWebViews.readKeys(top, Resources.loadingKeysField, fail);
    const all = [...keys, ...loadingKeys];
    if (all.length > Resources.webViewKeysLimit || new Set(all.map(t => t.name)).size !== all.length)
      throw fail(Resources.webViewKeysInvalid);
    for (const [isMac, platform] of [[false, Resources.webViewStandardPlatforms], [true, Resources.webViewMacPlatform]] as const) {
      const forms = all.flatMap(t => (isMac ? t.macKeys : t.keys).map(u => WebViewKeys.formOn(u, isMac)));
      if (new Set(forms).size !== forms.length)
        throw fail(Resources.formatWebViewKeyRepeated(platform));
    }
    return { methods, events, keys, ...windows, ...loadingKeys.length > 0 ? { loadingKeys } : {} };
  }

  private static readKeys(top: ReadonlyMap<string, unknown>, field: string, fail: (problem: string) => BuildException): readonly IWebViewKeyJson[] {
    return top.has(field) ? ModuleWebViews.readArray(top.get(field), fail, field).map((t, index) => ModuleWebViews.readKey(t, field, index, fail)) : [];
  }

  private static readKey(value: unknown, field: string, index: number, fail: (problem: string) => BuildException): IWebViewKeyJson {
    const record = ModuleWebViews.readRecord(value, Resources.webViewKeyFields, fail, Resources.formatWebViewKeyInvalid(field, index));
    const name = record.get(Resources.nameField);
    if (!Object.isString(name) || !Resources.camelCaseNamePattern.test(name))
      throw fail(Resources.formatWebViewKeyNameInvalid(field, index));
    const isLoadingKey = field === Resources.loadingKeysField;
    const keys = ModuleWebViews.readChords(record.get(Resources.keysField), Resources.formatMemberPath(name, Resources.keysField), false, isLoadingKey, fail);
    const macKeys = ModuleWebViews.readChords(
      record.has(Resources.macKeysField) ? record.get(Resources.macKeysField) : keys,
      Resources.formatMemberPath(name, record.has(Resources.macKeysField) ? Resources.macKeysField : Resources.keysField),
      true,
      isLoadingKey,
      fail);
    return { name, keys, macKeys };
  }

  private static readChords(value: unknown, where: string, isMac: boolean, isLoadingKey: boolean, fail: (problem: string) => BuildException): readonly string[] {
    const chords: readonly string[] = Array.isArray(value) ? value.filter(t => Object.isString(t)) : [];
    if (!Array.isArray(value) || value.length === 0 || value.length > Resources.webViewChordsLimit || chords.length !== value.length)
      throw fail(Resources.formatWebViewChordsInvalid(where));
    const platform = isMac ? Resources.webViewMacPlatform : Resources.webViewStandardPlatforms;
    const refused = WebViewKeys.refusedOn(isMac);
    for (const text of chords) {
      const form = WebViewKeys.formOn(text, isMac);
      if (Object.isNull(form))
        throw fail(Resources.formatWebViewKeyUnknown(where, text));
      if ((WebViewKeys.isTyping(form) && !(isLoadingKey && WebViewKeys.isEscape(form))) || refused.includes(form))
        throw fail(Resources.formatWebViewKeyRefused(where, text, platform));
    }
    return chords;
  }

  private static readMethod(value: unknown, index: number, fail: (problem: string) => BuildException): Readonly<Record<string, unknown>> {
    const record = ModuleWebViews.readRecord(value, Resources.webViewMethodFields, fail, Resources.formatWebViewMethodInvalid(index));
    const name = record.get(Resources.nameField);
    if (!Object.isString(name) || !Resources.webViewMethodPattern.test(name))
      throw fail(Resources.formatWebViewMethodNameInvalid(index));
    if (Resources.webViewRefusedMethods.includes(name) || Resources.webViewRefusedDomains.includes(name.slice(0, name.indexOf(Resources.qualifiedNameSeparator))))
      throw fail(Resources.formatWebViewMethodRefused(name));
    if (!record.has(Resources.parametersField))
      return { name };
    return { name, parameters: ModuleWebViews.readRules(record.get(Resources.parametersField), name, fail) };
  }

  private static readRules(value: unknown, where: string, fail: (problem: string) => BuildException): Readonly<Record<string, unknown>> {
    if (!Object.isPlainObject(value))
      throw fail(Resources.formatWebViewParametersNotObject(where));
    return Object.fromEntries(Object.entries(value).map(([name, rule]) => {
      if (!Resources.camelCaseNamePattern.test(name))
        throw fail(Resources.formatWebViewParameterInvalid(where, name));
      return [name, ModuleWebViews.readRule(rule, Resources.formatMemberPath(where, name), fail)];
    }));
  }

  private static readRule(value: unknown, where: string, fail: (problem: string) => BuildException): Readonly<Record<string, unknown>> {
    const record = ModuleWebViews.readRecord(value, Resources.webViewRuleFields, fail, Resources.formatWebViewRuleInvalid(where));
    const kinds = [
      record.has(Resources.valuesField),
      record.has(Resources.minimumField) || record.has(Resources.maximumField),
      record.has(Resources.maxLengthField),
      record.has(Resources.fieldsField)
    ];
    if (kinds.filter(t => t).length > 1)
      throw fail(Resources.formatWebViewRuleKindsRepeated(where));
    if (record.has(Resources.requiredField) && !Object.isBoolean(record.get(Resources.requiredField)))
      throw fail(Resources.formatWebViewRuleRequiredInvalid(where));
    const values = record.get(Resources.valuesField);
    if (record.has(Resources.valuesField) && (!Array.isArray(values) || values.length === 0 || new Set(values).size !== values.length
      || !values.every(t => Object.isString(t) || Object.isBoolean(t) || (Object.isNumber(t) && Number.isFinite(t)))))
      throw fail(Resources.formatWebViewRuleValuesInvalid(where));
    const minimum = record.has(Resources.minimumField) ? record.get(Resources.minimumField) : -Infinity;
    const maximum = record.has(Resources.maximumField) ? record.get(Resources.maximumField) : Infinity;
    if (!Object.isNumber(minimum) || !Object.isNumber(maximum) || minimum > maximum)
      throw fail(Resources.formatWebViewRuleRangeInvalid(where));
    const maxLength = record.get(Resources.maxLengthField);
    if (record.has(Resources.maxLengthField) && (!Object.isNumber(maxLength) || !Number.isSafeInteger(maxLength) || maxLength <= 0))
      throw fail(Resources.formatWebViewRuleMaxLengthInvalid(where));
    if (!record.has(Resources.fieldsField))
      return Object.fromEntries(record);
    return { ...Object.fromEntries(record), fields: ModuleWebViews.readRules(record.get(Resources.fieldsField), where, fail) };
  }

  private static readRecord(value: unknown, fields: readonly string[], fail: (problem: string) => BuildException, problem: string): ReadonlyMap<string, unknown> {
    if (!Object.isPlainObject(value) || Object.keys(value).some(t => !fields.includes(t)))
      throw fail(problem);
    return new Map(Object.entries(value));
  }

  private static readArray(value: unknown, fail: (problem: string) => BuildException, field: string): readonly unknown[] {
    if (!Array.isArray(value))
      throw fail(Resources.formatWebViewListNotArray(field));

    return value;
  }
}

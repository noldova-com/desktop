/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject, JsonValue } from "@noldova/context.json";

import type { IToolSchemaValidator } from "../../interfaces/i-tool-schema.validator.js";
import { CaughtFailure } from "../../models/caught-failure.js";
import { Resources } from "../../resources.js";
import { ToolSchemaResources } from "./tool-schema.resources.js";

export class ToolSchemaValidator implements IToolSchemaValidator {
  private static readonly TYPES: ReadonlyMap<string, (value: JsonValue) => boolean> = new Map<string, (value: JsonValue) => boolean>([
    [ToolSchemaResources.nullType, t => Object.isNull(t)],
    [ToolSchemaResources.booleanType, t => Object.isBoolean(t)],
    [ToolSchemaResources.objectType, t => ToolSchemaValidator.isObject(t)],
    [ToolSchemaResources.arrayType, t => ToolSchemaValidator.isArray(t)],
    [ToolSchemaResources.numberType, t => Object.isNumber(t)],
    [ToolSchemaResources.integerType, t => Number.isInteger(t)],
    [ToolSchemaResources.stringType, t => Object.isString(t)]
  ]);

  private readonly patterns: Map<string, RegExp | null> = new Map();
  private readonly keywords: ReadonlyMap<string, (value: JsonValue, path: string) => string | null> = new Map<string, (value: JsonValue, path: string) => string | null>([
    [ToolSchemaResources.schemaKeyword, (value, path) => ToolSchemaValidator.check(value === ToolSchemaResources.dialect, path)],
    [ToolSchemaResources.commentKeyword, (value, path) => ToolSchemaValidator.check(Object.isString(value), path)],
    [ToolSchemaResources.titleKeyword, (value, path) => ToolSchemaValidator.check(Object.isString(value), path)],
    [ToolSchemaResources.descriptionKeyword, (value, path) => ToolSchemaValidator.check(Object.isString(value), path)],
    [ToolSchemaResources.defaultKeyword, () => null],
    [ToolSchemaResources.examplesKeyword, (value, path) => ToolSchemaValidator.check(ToolSchemaValidator.isArray(value), path)],
    [ToolSchemaResources.deprecatedKeyword, (value, path) => ToolSchemaValidator.check(Object.isBoolean(value), path)],
    [ToolSchemaResources.readOnlyKeyword, (value, path) => ToolSchemaValidator.check(Object.isBoolean(value), path)],
    [ToolSchemaResources.writeOnlyKeyword, (value, path) => ToolSchemaValidator.check(Object.isBoolean(value), path)],
    [ToolSchemaResources.typeKeyword, (value, path) => ToolSchemaValidator.check(ToolSchemaValidator.isTypes(value), path)],
    [ToolSchemaResources.enumKeyword, (value, path) => ToolSchemaValidator.check(ToolSchemaValidator.isArray(value) && value.length > 0, path)],
    [ToolSchemaResources.constKeyword, () => null],
    [ToolSchemaResources.minLengthKeyword, (value, path) => ToolSchemaValidator.check(ToolSchemaValidator.isCount(value), path)],
    [ToolSchemaResources.maxLengthKeyword, (value, path) => ToolSchemaValidator.check(ToolSchemaValidator.isCount(value), path)],
    [ToolSchemaResources.patternKeyword, (value, path) => ToolSchemaValidator.check(Object.isString(value) && !Object.isNull(this.compile(value)), path)],
    [ToolSchemaResources.minimumKeyword, (value, path) => ToolSchemaValidator.check(Object.isNumber(value), path)],
    [ToolSchemaResources.maximumKeyword, (value, path) => ToolSchemaValidator.check(Object.isNumber(value), path)],
    [ToolSchemaResources.exclusiveMinimumKeyword, (value, path) => ToolSchemaValidator.check(Object.isNumber(value), path)],
    [ToolSchemaResources.exclusiveMaximumKeyword, (value, path) => ToolSchemaValidator.check(Object.isNumber(value), path)],
    [ToolSchemaResources.minItemsKeyword, (value, path) => ToolSchemaValidator.check(ToolSchemaValidator.isCount(value), path)],
    [ToolSchemaResources.maxItemsKeyword, (value, path) => ToolSchemaValidator.check(ToolSchemaValidator.isCount(value), path)],
    [ToolSchemaResources.itemsKeyword, (value, path) => this.findSchemaProblem(value, path)],
    [ToolSchemaResources.propertiesKeyword, (value, path) => ToolSchemaValidator.isObject(value) ? this.findSchemasProblem(Object.entries(value), path) : Resources.formatToolSchemaKeywordInvalid(path)],
    [ToolSchemaResources.requiredKeyword, (value, path) => ToolSchemaValidator.check(ToolSchemaValidator.isNames(value), path)],
    [ToolSchemaResources.additionalPropertiesKeyword, (value, path) => Object.isBoolean(value) ? null : this.findSchemaProblem(value, path)],
    [ToolSchemaResources.anyOfKeyword, (value, path) => ToolSchemaValidator.isArray(value) && value.length > 0
      ? this.findSchemasProblem(value.map((t, index): readonly [string, JsonValue] => [String(index), t]), path)
      : Resources.formatToolSchemaKeywordInvalid(path)]
  ]);

  public checkSchema(schema: JsonObject, parameterName: string): void {
    if (schema[ToolSchemaResources.typeKeyword] !== ToolSchemaResources.objectType)
      throw new ArgumentException(Resources.toolSchemaInvalid, parameterName);
    const problem = this.findSchemaProblem(schema, String.empty);
    if (!Object.isNull(problem))
      throw new ArgumentException(problem, parameterName);
  }

  public findProblem(schema: JsonObject, value: JsonObject): string | null {
    return this.findValueProblem(schema, value, String.empty);
  }

  private findSchemaProblem(schema: JsonValue, path: string): string | null {
    if (!ToolSchemaValidator.isObject(schema))
      return Resources.formatToolSchemaNotObject(path);
    for (const [keyword, value] of Object.entries(schema)) {
      const location = ToolSchemaValidator.join(path, keyword);
      const check = this.keywords.get(keyword);
      const problem = Object.isUndefined(check) ? Resources.formatToolSchemaKeywordUnsupported(location) : check(value, location);
      if (!Object.isNull(problem))
        return problem;
    }
    return null;
  }

  private findSchemasProblem(schemas: readonly (readonly [string, JsonValue])[], path: string): string | null {
    for (const [name, schema] of schemas) {
      const problem = this.findSchemaProblem(schema, ToolSchemaValidator.join(path, name));
      if (!Object.isNull(problem))
        return problem;
    }
    return null;
  }

  private findValueProblem(schema: JsonObject, value: JsonValue, path: string): string | null {
    const keyword = this.findFailedKeyword(schema, value);
    if (!Object.isNull(keyword))
      return Resources.formatToolValueMismatch(path, keyword);
    if (ToolSchemaValidator.isArray(value))
      return this.findItemsProblem(schema, value, path);
    return ToolSchemaValidator.isObject(value) ? this.findPropertiesProblem(schema, value, path) : null;
  }

  private findFailedKeyword(schema: JsonObject, value: JsonValue): string | null {
    const type = schema[ToolSchemaResources.typeKeyword];
    const options = schema[ToolSchemaResources.enumKeyword];
    const constant = schema[ToolSchemaResources.constKeyword];
    const anyOf = schema[ToolSchemaResources.anyOfKeyword];
    if (!Object.isUndefined(type) && !ToolSchemaValidator.hasType(value, type))
      return ToolSchemaResources.typeKeyword;
    if (ToolSchemaValidator.isArray(options) && !options.some(t => ToolSchemaValidator.isEqual(t, value)))
      return ToolSchemaResources.enumKeyword;
    if (!Object.isUndefined(constant) && !ToolSchemaValidator.isEqual(constant, value))
      return ToolSchemaResources.constKeyword;
    if (ToolSchemaValidator.isArray(anyOf) && !anyOf.some(t => ToolSchemaValidator.isObject(t) && Object.isNull(this.findValueProblem(t, value, String.empty))))
      return ToolSchemaResources.anyOfKeyword;
    if (Object.isString(value))
      return this.findStringKeyword(schema, value);
    if (Object.isNumber(value))
      return ToolSchemaValidator.findNumberKeyword(schema, value);
    if (ToolSchemaValidator.isArray(value))
      return ToolSchemaValidator.findCountKeyword(schema, value.length, ToolSchemaResources.minItemsKeyword, ToolSchemaResources.maxItemsKeyword);
    return ToolSchemaValidator.isObject(value) ? ToolSchemaValidator.findObjectKeyword(schema, value) : null;
  }

  private findStringKeyword(schema: JsonObject, value: string): string | null {
    const pattern = schema[ToolSchemaResources.patternKeyword];
    const count = ToolSchemaValidator.findCountKeyword(schema, [...value].length, ToolSchemaResources.minLengthKeyword, ToolSchemaResources.maxLengthKeyword);
    if (!Object.isNull(count))
      return count;
    return Object.isString(pattern) && !(this.compile(pattern)?.test(value) ?? false) ? ToolSchemaResources.patternKeyword : null;
  }

  private findItemsProblem(schema: JsonObject, value: readonly JsonValue[], path: string): string | null {
    const items = schema[ToolSchemaResources.itemsKeyword];
    if (!ToolSchemaValidator.isObject(items))
      return null;
    for (const [index, item] of value.entries()) {
      const problem = this.findValueProblem(items, item, ToolSchemaValidator.join(path, String(index)));
      if (!Object.isNull(problem))
        return problem;
    }
    return null;
  }

  private findPropertiesProblem(schema: JsonObject, value: JsonObject, path: string): string | null {
    const properties = ToolSchemaValidator.toMap(schema[ToolSchemaResources.propertiesKeyword]);
    const additional = schema[ToolSchemaResources.additionalPropertiesKeyword];
    for (const [name, item] of Object.entries(value)) {
      const child = properties.get(name) ?? additional;
      const problem = ToolSchemaValidator.isObject(child) ? this.findValueProblem(child, item, ToolSchemaValidator.join(path, name)) : null;
      if (!Object.isNull(problem))
        return problem;
    }
    return null;
  }

  private compile(pattern: string): RegExp | null {
    const known = this.patterns.get(pattern);
    if (!Object.isUndefined(known))
      return known;
    const compiled = ToolSchemaValidator.tryCompile(pattern);
    this.patterns.set(pattern, compiled);
    return compiled;
  }

  private static tryCompile(pattern: string): RegExp | null {
    try {
      return new RegExp(pattern, ToolSchemaResources.patternFlags);
    }
    catch (error) {
      CaughtFailure.expect(error, SyntaxError);
      return null;
    }
  }

  private static findNumberKeyword(schema: JsonObject, value: number): string | null {
    const minimum = schema[ToolSchemaResources.minimumKeyword];
    const maximum = schema[ToolSchemaResources.maximumKeyword];
    const exclusiveMinimum = schema[ToolSchemaResources.exclusiveMinimumKeyword];
    const exclusiveMaximum = schema[ToolSchemaResources.exclusiveMaximumKeyword];
    if (Object.isNumber(minimum) && value < minimum)
      return ToolSchemaResources.minimumKeyword;
    if (Object.isNumber(maximum) && value > maximum)
      return ToolSchemaResources.maximumKeyword;
    if (Object.isNumber(exclusiveMinimum) && value <= exclusiveMinimum)
      return ToolSchemaResources.exclusiveMinimumKeyword;
    return Object.isNumber(exclusiveMaximum) && value >= exclusiveMaximum ? ToolSchemaResources.exclusiveMaximumKeyword : null;
  }

  private static findCountKeyword(schema: JsonObject, count: number, minimumKeyword: string, maximumKeyword: string): string | null {
    const minimum = schema[minimumKeyword];
    const maximum = schema[maximumKeyword];
    if (Object.isNumber(minimum) && count < minimum)
      return minimumKeyword;
    return Object.isNumber(maximum) && count > maximum ? maximumKeyword : null;
  }

  private static findObjectKeyword(schema: JsonObject, value: JsonObject): string | null {
    const required = schema[ToolSchemaResources.requiredKeyword];
    const properties = ToolSchemaValidator.toMap(schema[ToolSchemaResources.propertiesKeyword]);
    if (ToolSchemaValidator.isArray(required) && required.some(t => Object.isString(t) && !Object.hasOwn(value, t)))
      return ToolSchemaResources.requiredKeyword;
    return schema[ToolSchemaResources.additionalPropertiesKeyword] === false && Object.keys(value).some(t => !properties.has(t)) ? ToolSchemaResources.additionalPropertiesKeyword : null;
  }

  private static hasType(value: JsonValue, type: JsonValue): boolean {
    const types = ToolSchemaValidator.isArray(type) ? type : [type];
    return types.some(t => Object.isString(t) && (ToolSchemaValidator.TYPES.get(t)?.(value) ?? false));
  }

  private static isEqual(expected: JsonValue, actual: JsonValue | undefined): boolean {
    if (ToolSchemaValidator.isArray(expected))
      return ToolSchemaValidator.isArray(actual) && ToolSchemaValidator.isEqualList(expected, actual);
    if (ToolSchemaValidator.isObject(expected))
      return ToolSchemaValidator.isObject(actual) && ToolSchemaValidator.isEqualFields(expected, actual);
    return expected === actual;
  }

  private static isEqualList(expected: readonly JsonValue[], actual: readonly JsonValue[]): boolean {
    return expected.length === actual.length && expected.every((t, index) => ToolSchemaValidator.isEqual(t, actual[index]));
  }

  private static isEqualFields(expected: JsonObject, actual: JsonObject): boolean {
    const fields = ToolSchemaValidator.toMap(actual);
    const entries = Object.entries(expected);
    return fields.size === entries.length && entries.every(([name, t]) => ToolSchemaValidator.isEqual(t, fields.get(name)));
  }

  private static isTypes(value: JsonValue): boolean {
    const types = ToolSchemaValidator.isArray(value) ? value : [value];
    return types.length > 0 && types.every(t => Object.isString(t) && ToolSchemaValidator.TYPES.has(t)) && new Set(types).size === types.length;
  }

  private static isNames(value: JsonValue): boolean {
    return ToolSchemaValidator.isArray(value) && value.every(t => Object.isString(t)) && new Set(value).size === value.length;
  }

  private static isCount(value: JsonValue): boolean {
    return Object.isNumber(value) && Number.isInteger(value) && value >= 0;
  }

  private static isArray(value: JsonValue | undefined): value is readonly JsonValue[] {
    return Array.isArray(value);
  }

  private static isObject(value: JsonValue | undefined): value is JsonObject {
    return Object.isPlainObject(value);
  }

  private static toMap(value: JsonValue | undefined): ReadonlyMap<string, JsonValue> {
    return new Map(ToolSchemaValidator.isObject(value) ? Object.entries(value) : []);
  }

  private static check(isValid: boolean, path: string): string | null {
    return isValid ? null : Resources.formatToolSchemaKeywordInvalid(path);
  }

  private static join(path: string, name: string): string {
    const escaped = name.replaceAll(Resources.tilde, Resources.escapedTilde).replaceAll(Resources.pointerSeparator, Resources.escapedSlash);
    return `${path}${Resources.pointerSeparator}${escaped}`;
  }
}

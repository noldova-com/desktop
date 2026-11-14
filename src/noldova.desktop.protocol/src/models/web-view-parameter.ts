/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class WebViewParameter {
  private static readonly FIELDS: readonly string[] = [
    Resources.requiredField, Resources.valuesField, Resources.minimumField, Resources.maximumField, Resources.maxLengthField, Resources.fieldsField
  ];

  public readonly isRequired: boolean;
  public readonly values: readonly (string | number | boolean)[] | null;
  public readonly minimum: number | null;
  public readonly maximum: number | null;
  public readonly maxLength: number | null;
  public readonly fields: ReadonlyMap<string, WebViewParameter> | null;

  public constructor(
    isRequired: boolean = false,
    values: readonly (string | number | boolean)[] | null = null,
    minimum: number | null = null,
    maximum: number | null = null,
    maxLength: number | null = null,
    fields: ReadonlyMap<string, WebViewParameter> | null = null) {
    const isRange = !Object.isNull(minimum) || !Object.isNull(maximum);
    if ([!Object.isNull(values), isRange, !Object.isNull(maxLength), !Object.isNull(fields)].filter(t => t).length > 1)
      throw new ArgumentException(Resources.webViewRuleInvalid, Resources.valuesField);
    if (!Object.isNull(values) && (values.length === 0 || new Set(values).size !== values.length || values.some(t => !WebViewParameter.isValue(t))))
      throw new ArgumentException(Resources.webViewValuesInvalid, Resources.valuesField);
    if (isRange && (![minimum ?? 0, maximum ?? 0].every(t => Number.isFinite(t)) || (minimum ?? -Infinity) > (maximum ?? Infinity)))
      throw new ArgumentException(Resources.webViewRangeInvalid, Object.isNull(minimum) ? Resources.maximumField : Resources.minimumField);
    if (!Object.isNull(maxLength) && (!Number.isSafeInteger(maxLength) || maxLength <= 0))
      throw new ArgumentException(Resources.settingMaxLengthInvalid, Resources.maxLengthField);
    const badName = Object.isNull(fields) ? undefined : [...fields.keys()].find(t => !Resources.memberPattern.test(t));
    if (!Object.isUndefined(badName))
      throw new ArgumentException(Resources.webViewParameterNameInvalid, Resources.formatFieldPath(Resources.fieldsField, badName));

    this.isRequired = isRequired;
    this.values = Object.isNull(values) ? null : [...values];
    this.minimum = minimum;
    this.maximum = maximum;
    this.maxLength = maxLength;
    this.fields = Object.isNull(fields) ? null : new Map(fields);
  }

  public static fromJson(value: unknown, path?: string): WebViewParameter {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewParameter.FIELDS);
    return WireContract.create(reader, () => new WebViewParameter(
      reader.hasField(Resources.requiredField) ? reader.readBoolean(Resources.requiredField) : false,
      reader.hasField(Resources.valuesField) ? WebViewParameter.readValues(reader) : null,
      reader.hasField(Resources.minimumField) ? reader.readNumber(Resources.minimumField) : null,
      reader.hasField(Resources.maximumField) ? reader.readNumber(Resources.maximumField) : null,
      reader.hasField(Resources.maxLengthField) ? reader.readInteger(Resources.maxLengthField) : null,
      reader.hasField(Resources.fieldsField) ? WebViewParameter.readFields(reader.readObject(Resources.fieldsField)) : null));
  }

  public static readFields(reader: JsonReader): ReadonlyMap<string, WebViewParameter> {
    return new Map(Object.entries(reader.toJson()).map(([name, rule]) => {
      if (!Resources.memberPattern.test(name))
        throw new JsonException(Resources.webViewParameterNameInvalid, Resources.formatFieldPath(reader.path, name));
      return [name, WebViewParameter.fromJson(rule, Resources.formatFieldPath(reader.path, name))];
    }));
  }

  public static allowsFields(fields: ReadonlyMap<string, WebViewParameter>, value: unknown): boolean {
    if (!Object.isPlainObject(value))
      return false;
    return Object.entries(value).every(([name, field]) => fields.get(name)?.allows(field) ?? false)
      && [...fields].every(([name, rule]) => !rule.isRequired || Object.hasOwn(value, name));
  }

  public allows(value: unknown): boolean {
    if (!Object.isNull(this.values))
      return this.values.some(t => t === value);
    if (!Object.isNull(this.minimum) || !Object.isNull(this.maximum))
      return Object.isNumber(value) && Number.isFinite(value) && value >= (this.minimum ?? -Infinity) && value <= (this.maximum ?? Infinity);
    if (!Object.isNull(this.maxLength))
      return Object.isString(value) && value.length <= this.maxLength;
    if (!Object.isNull(this.fields))
      return WebViewParameter.allowsFields(this.fields, value);
    return true;
  }

  public toJson(): JsonObject {
    return {
      ...this.isRequired ? { [Resources.requiredField]: true } : {},
      ...Object.isNull(this.values) ? {} : { [Resources.valuesField]: [...this.values] },
      ...Object.isNull(this.minimum) ? {} : { [Resources.minimumField]: this.minimum },
      ...Object.isNull(this.maximum) ? {} : { [Resources.maximumField]: this.maximum },
      ...Object.isNull(this.maxLength) ? {} : { [Resources.maxLengthField]: this.maxLength },
      ...Object.isNull(this.fields) ? {} : { [Resources.fieldsField]: WebViewParameter.fieldsToJson(this.fields) }
    };
  }

  public static fieldsToJson(fields: ReadonlyMap<string, WebViewParameter>): JsonObject {
    return Object.fromEntries([...fields].map(([name, rule]) => [name, rule.toJson()]));
  }

  private static readValues(reader: JsonReader): readonly (string | number | boolean)[] {
    const values: JsonValue = reader.readValue(Resources.valuesField);
    const allowed = Array.isArray(values) ? values.filter(t => WebViewParameter.isValue(t)) : [];
    if (!Array.isArray(values) || allowed.length !== values.length)
      throw new JsonException(Resources.webViewValuesInvalid, Resources.formatFieldPath(reader.path, Resources.valuesField));
    return allowed;
  }

  private static isValue(value: unknown): value is string | number | boolean {
    return Object.isString(value) || Object.isBoolean(value) || (Object.isNumber(value) && Number.isFinite(value));
  }
}

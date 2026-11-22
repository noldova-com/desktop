/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";

import { PermissionOption } from "../../enums/permission-option.js";
import { ToolRisk } from "../../enums/tool-risk.js";
import type { IPermissionDetail } from "../../interfaces/i-permission-detail.js";
import type { IPermissionRequest } from "../../interfaces/i-permission-request.js";
import { CaughtFailure } from "../../models/caught-failure.js";
import type { ToolDescriptor } from "../../models/tool-descriptor.js";
import { Resources } from "../../resources.js";

export class PermissionRequestChecker {
  public static read(moduleId: string, descriptor: ToolDescriptor, input: unknown): IPermissionRequest | string {
    if (descriptor.hints.isReadOnly === true && descriptor.risk.maximum === ToolRisk.Low)
      return Resources.permissionNotRaised;
    const fields = JsonReader.fromValue(PermissionRequestChecker.toPlainRequest(input));
    const prefix = `${moduleId}${Resources.permissionActionSeparator}`;
    const action = PermissionRequestChecker.tryRead(() => fields.readString(Resources.permissionActionField));
    if (Object.isUndefined(action) || !action.startsWith(prefix) || !Resources.moduleCodeNamePattern.test(action.slice(prefix.length)))
      return Resources.formatPermissionActionInvalid(moduleId);
    const hasSubject = fields.hasField(Resources.permissionSubjectField);
    const subject = hasSubject ? PermissionRequestChecker.tryRead(() => fields.readString(Resources.permissionSubjectField)) : undefined;
    if (hasSubject && (Object.isUndefined(subject) || subject.length > Resources.maximumPermissionSubjectLength))
      return Resources.permissionSubjectInvalid;
    const title = PermissionRequestChecker.tryRead(() => fields.readString(Resources.permissionTitleField));
    if (Object.isUndefined(title) || String.isNullOrWhitespace(title) || title.length > Resources.maximumPermissionTitleLength || Resources.logLineBreakPattern.test(title))
      return Resources.permissionTitleInvalid;
    const details = PermissionRequestChecker.readDetails(fields);
    if (Object.isUndefined(details))
      return Resources.permissionDetailsInvalid;
    const risk = PermissionRequestChecker.tryRead(() => fields.readOneOf(Resources.permissionRiskField, Resources.toolRisks));
    if (Object.isUndefined(risk) || Resources.toolRisks.indexOf(risk) > Resources.toolRisks.indexOf(descriptor.risk.maximum))
      return Resources.formatPermissionRiskInvalid(descriptor.risk.maximum);
    const isAsking = PermissionRequestChecker.readFlag(fields, Resources.permissionIsAskingField);
    const isRememberedOnly = PermissionRequestChecker.readFlag(fields, Resources.permissionIsRememberedOnlyField);
    if (Object.isNull(isAsking) || Object.isNull(isRememberedOnly))
      return Resources.permissionFlagsInvalid;
    const options = PermissionRequestChecker.readOptions(fields);
    if (Object.isUndefined(options))
      return Resources.permissionOptionsInvalid;
    const labels = PermissionRequestChecker.readLabels(fields, options);
    if (Object.isNull(labels))
      return Resources.permissionLabelsInvalid;
    const request: IPermissionRequest = { action, subject, title, details, risk, isAsking, options, labels, isRememberedOnly };
    if (PermissionRequestChecker.isNamedHighRisk(request) && options.some(t => Resources.alwaysPermissionOptions.includes(t)))
      return Resources.permissionAlwaysAtHighRisk;
    if (options.includes(PermissionOption.TakeOver) && Object.isUndefined(labels?.[PermissionOption.TakeOver]))
      return Resources.permissionLabelsInvalid;
    return request;
  }

  public static isNamedHighRisk(request: IPermissionRequest): boolean {
    const hasLabels = !Object.isUndefined(request.labels) && Object.keys(request.labels).length > 0;
    return request.risk === ToolRisk.High && (hasLabels || request.options.includes(PermissionOption.TakeOver));
  }

  private static toPlainRequest(input: unknown): unknown {
    if (!Object.isObject(input) || Object.isFunction(input) || Array.isArray(input))
      return input;
    return {
      ...("action" in input ? { action: input.action } : {}),
      ...("subject" in input ? { subject: input.subject } : {}),
      ...("title" in input ? { title: input.title } : {}),
      ...("details" in input ? { details: Array.isArray(input.details) ? input.details.map((t: unknown) => PermissionRequestChecker.toPlainDetail(t)) : input.details } : {}),
      ...("risk" in input ? { risk: input.risk } : {}),
      ...("isAsking" in input ? { isAsking: input.isAsking } : {}),
      ...("isRememberedOnly" in input ? { isRememberedOnly: input.isRememberedOnly } : {}),
      ...("options" in input ? { options: input.options } : {}),
      ...("labels" in input ? { labels: input.labels } : {})
    };
  }

  private static toPlainDetail(detail: unknown): unknown {
    if (!Object.isObject(detail) || Object.isFunction(detail) || Array.isArray(detail))
      return detail;
    return {
      ...("label" in detail ? { label: detail.label } : {}),
      ...("kind" in detail ? { kind: detail.kind } : {}),
      ...("value" in detail ? { value: detail.value } : {}),
      ...("isBare" in detail ? { isBare: detail.isBare } : {})
    };
  }

  private static tryRead<T>(read: () => T): T | undefined {
    try {
      return read();
    }
    catch (error) {
      CaughtFailure.expect(error, JsonException);
      return undefined;
    }
  }

  private static readFlag(fields: JsonReader, name: string): boolean | undefined | null {
    if (!fields.hasField(name))
      return undefined;
    return PermissionRequestChecker.tryRead(() => fields.readBoolean(name)) ?? null;
  }

  private static readDetails(fields: JsonReader): readonly IPermissionDetail[] | undefined {
    const items = PermissionRequestChecker.tryRead(() => fields.readObjectArray(Resources.permissionDetailsField));
    if (Object.isUndefined(items) || items.length > Resources.maximumPermissionDetails)
      return undefined;
    const details: IPermissionDetail[] = [];
    for (const item of items) {
      const label = PermissionRequestChecker.tryRead(() => item.readString(Resources.permissionDetailLabelField));
      const kind = PermissionRequestChecker.tryRead(() => item.readOneOf(Resources.permissionDetailKindField, Resources.permissionDetailKinds));
      const value = PermissionRequestChecker.tryRead(() => item.readString(Resources.permissionDetailValueField));
      const isBare = PermissionRequestChecker.readFlag(item, Resources.permissionDetailIsBareField);
      if (Object.isUndefined(label) || String.isNullOrWhitespace(label) || Object.isUndefined(kind) || Object.isUndefined(value) || Object.isNull(isBare))
        return undefined;
      details.push(Object.isUndefined(isBare) ? { label, kind, value } : { label, kind, value, isBare });
    }
    return Buffer.byteLength(JSON.stringify(details), Resources.utf8Encoding) <= Resources.maximumPermissionDetailBytes ? details : undefined;
  }

  private static readOptions(fields: JsonReader): readonly PermissionOption[] | undefined {
    const names = PermissionRequestChecker.tryRead(() => fields.readStringArray(Resources.permissionOptionsField));
    if (Object.isUndefined(names) || names.length === 0 || new Set(names).size !== names.length)
      return undefined;
    const options: PermissionOption[] = [];
    for (const name of names) {
      const option = Resources.permissionOptions.find(t => t === name);
      if (Object.isUndefined(option))
        return undefined;
      options.push(option);
    }
    return options;
  }

  private static readLabels(fields: JsonReader, options: readonly PermissionOption[]): IPermissionRequest["labels"] | null {
    if (!fields.hasField(Resources.permissionLabelsField))
      return undefined;
    const labels = PermissionRequestChecker.tryRead(() => fields.readObject(Resources.permissionLabelsField));
    if (Object.isUndefined(labels) || !Object.keys(labels.toJson()).every(t => Resources.labelledPermissionOptions.some(u => u === t && options.includes(u))))
      return null;
    const allowAlways = PermissionRequestChecker.readLabel(labels, PermissionOption.AllowAlways);
    const takeOver = PermissionRequestChecker.readLabel(labels, PermissionOption.TakeOver);
    if (Object.isNull(allowAlways) || Object.isNull(takeOver))
      return null;
    if (Object.isUndefined(allowAlways))
      return Object.isUndefined(takeOver) ? {} : { [PermissionOption.TakeOver]: takeOver };
    return Object.isUndefined(takeOver) ? { [PermissionOption.AllowAlways]: allowAlways } : { [PermissionOption.AllowAlways]: allowAlways, [PermissionOption.TakeOver]: takeOver };
  }

  private static readLabel(labels: JsonReader, option: PermissionOption): string | undefined | null {
    if (!labels.hasField(option))
      return undefined;
    const label = PermissionRequestChecker.tryRead(() => labels.readString(option));
    if (Object.isUndefined(label) || String.isNullOrWhitespace(label) || label.length > Resources.maximumPermissionLabelLength || Resources.logLineBreakPattern.test(label))
      return null;
    return label;
  }
}

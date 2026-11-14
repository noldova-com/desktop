/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class DiagnosticRedactor {
  private readonly homeFolder: RegExp;
  private readonly userName: RegExp | null;
  private readonly ownNames: RegExp;

  public constructor(homeFolder: string, ownNames: readonly string[] = []) {
    const folders = homeFolder.split(Resources.pathSeparatorPattern);
    const name = folders.slice(-1).join(String.empty);
    const shortName = DiagnosticRedactor.shortNameOf(name);
    const names = Object.isNull(shortName) ? DiagnosticRedactor.encodable(name) : Resources.formatEitherSource(DiagnosticRedactor.encodable(name), shortName);
    this.homeFolder = new RegExp(
      [...folders.slice(0, -1).map(t => DiagnosticRedactor.encodable(t)), names].join(Resources.pathSeparatorSource) + Resources.nameEndSource, Resources.caseInsensitiveGlobalFlags);
    const words = [...new Set([name, name.replace(Resources.profileSuffixPattern, String.empty)])]
      .filter(t => t.length >= Resources.userNameMinimumLength && !Resources.genericUserNames.includes(t.toLowerCase()));
    this.userName = words.length === 0
      ? null
      : new RegExp(Resources.formatWordsSource(words.map(t => DiagnosticRedactor.encodable(t)).join(Resources.alternativeSeparator)), Resources.caseInsensitiveGlobalFlags);
    const kept = [...ownNames.filter(t => t.length > 0), ...Resources.packageScopes].sort((a, b) => b.length - a.length);
    this.ownNames = new RegExp(Resources.formatOwnNamesSource(kept.map(t => DiagnosticRedactor.escape(t))), Resources.unicodeFlag);
  }

  public redact(text: string): string {
    const withoutAccounts = text.replace(Resources.urlCredentialsPattern, Resources.urlCredentialsReplacement).replace(Resources.emailPattern, Resources.redactedValue);
    const withoutHome = withoutAccounts.replace(this.homeFolder, Resources.homeAbbreviation);
    const withoutUser = this.redactUserName(withoutHome);
    return withoutUser.replace(Resources.opaqueValuePattern, t => DiagnosticRedactor.redactOpaqueValue(t));
  }

  private redactUserName(text: string): string {
    const userName = this.userName;
    if (Object.isNull(userName))
      return text;
    return text.split(this.ownNames).map((t, i) => i % 2 === 1 ? t : t.replace(userName, Resources.redactedValue)).join(String.empty);
  }

  private static redactOpaqueValue(value: string): string {
    const parts = value.split(Resources.opaqueValueSeparator);
    const start = parts.findIndex((t, i) => Resources.tokenPartPattern.test(t) || (Resources.mixedPartPattern.test(t) && DiagnosticRedactor.isToken(parts.slice(i))));
    return start < 0
      ? parts.map(t => t.length < Resources.opaqueValueLength || Resources.identifierPattern.test(t) ? t : Resources.redactedValue).join(Resources.opaqueValueSeparator)
      : [...parts.slice(0, start), Resources.redactedValue].join(Resources.opaqueValueSeparator);
  }

  private static isToken(parts: readonly string[]): boolean {
    const text = parts.join(String.empty);
    return text.length >= Resources.opaqueValueLength && text.length >= parts.length * Resources.tokenPartAverageLength && Resources.tokenTextPattern.test(text);
  }

  private static shortNameOf(name: string): string | null {
    if (Resources.shortNamePattern.test(name))
      return null;
    const dot = name.lastIndexOf(Resources.extensionSeparator);
    const base = DiagnosticRedactor.shortPart(dot > 0 ? name.slice(0, dot) : name, Resources.shortNameBaseLength);
    const extension = dot > 0 ? DiagnosticRedactor.shortPart(name.slice(dot + 1), Resources.shortNameExtensionLength) : String.empty;
    const suffix = extension.length === 0 ? String.empty : DiagnosticRedactor.escape(Resources.extensionSeparator) + extension;
    return base + Resources.shortNameSuffixSource + suffix;
  }

  private static shortPart(text: string, length: number): string {
    return [...text.replace(Resources.shortNameRemovedPattern, String.empty)].slice(0, length)
      .map(t => Resources.shortNameCharacterPattern.test(t) ? DiagnosticRedactor.escape(t) : Resources.shortNameAnyCharacterSource)
      .join(String.empty);
  }

  private static encodable(text: string): string {
    return [...text].map(t => Resources.uriUnreservedPattern.test(t)
      ? DiagnosticRedactor.escape(t)
      : Resources.formatEitherSource(DiagnosticRedactor.escape(t), Buffer.from(t, Resources.utf8Encoding).toString(Resources.hexEncoding).replace(Resources.hexBytePattern, Resources.percentEncodedByte)))
      .join(String.empty);
  }

  private static escape(text: string): string {
    return text.replace(Resources.regularExpressionSyntaxPattern, Resources.escapedMatch);
  }
}

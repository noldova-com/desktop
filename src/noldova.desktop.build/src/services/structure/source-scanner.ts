/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { StringBuilder } from "@noldova/context.text";

import { ScannedSource } from "../../models/structure/scanned-source.ts";
import { SourceLiteral } from "../../models/structure/source-literal.ts";
import { Resources } from "../../resources.ts";

export class SourceScanner {
  private readonly text: string;
  private readonly imports: SourceLiteral[] = [];
  private readonly selectors: SourceLiteral[] = [];
  private readonly texts: SourceLiteral[] = [];
  private readonly comments: number[] = [];
  private readonly substitutionDepths: number[] = [];
  private position: number = 0;
  private line: number = 1;
  private braceDepth: number = 0;
  private previousToken: string | null = null;
  private earlierToken: string | null = null;
  private hasFunctionBody: boolean = false;

  public constructor(text: string) {
    this.text = text;
  }

  public scan(): ScannedSource {
    while (this.position < this.text.length)
      this.scanNext(this.text.charAt(this.position));
    return new ScannedSource(this.imports, this.selectors, this.texts, this.comments, this.hasFunctionBody);
  }

  private scanNext(character: string): void {
    if (character === Resources.scannerLineFeed) {
      this.line++;
      this.position++;
    } else if (Resources.scannerWhitespace.test(character))
      this.position++;
    else if (this.text.startsWith(Resources.scannerLineCommentStart, this.position))
      this.skipLineComment();
    else if (this.text.startsWith(Resources.scannerBlockCommentStart, this.position))
      this.skipBlockComment();
    else if (Resources.scannerQuotes.has(character))
      this.readString(character);
    else if (character === Resources.scannerBacktick) {
      this.position++;
      this.readTemplate();
    } else if (character === Resources.scannerSlash && this.allowsRegularExpression())
      this.readRegularExpression();
    else if (Resources.scannerIdentifierStart.test(character))
      this.readIdentifier();
    else if (Resources.scannerDigit.test(character)) {
      this.readWord();
      this.pushToken(Resources.scannerOperand);
    } else
      this.readPunctuator(character);
  }

  private skipLineComment(): void {
    this.comments.push(this.line);
    const end = this.text.indexOf(Resources.scannerLineFeed, this.position);
    this.position = end < 0 ? this.text.length : end;
  }

  private skipBlockComment(): void {
    this.comments.push(this.line);
    const end = this.text.indexOf(Resources.scannerBlockCommentEnd, this.position + Resources.scannerBlockCommentStart.length);
    const next = end < 0 ? this.text.length : end + Resources.scannerBlockCommentEnd.length;
    this.line += this.text.slice(this.position, next).split(Resources.scannerLineFeed).length - 1;
    this.position = next;
  }

  private readString(quote: string): void {
    const line = this.line;
    const value = new StringBuilder();
    this.position++;
    while (this.position < this.text.length) {
      const character = this.text.charAt(this.position);
      if (character === quote || character === Resources.scannerLineFeed)
        break;
      if (character === Resources.scannerBackslash) {
        const escaped = this.text.charAt(this.position + 1);
        if (escaped === Resources.scannerLineFeed)
          this.line++;
        else
          value.append(escaped);
        this.position += Resources.scannerEscapeLength;
        continue;
      }
      value.append(character);
      this.position++;
    }
    if (this.text.charAt(this.position) === quote)
      this.position++;
    this.classify(new SourceLiteral(value.toString(), line));
    this.pushToken(Resources.scannerOperand);
  }

  private readTemplate(): void {
    const line = this.line;
    const value = new StringBuilder();
    while (this.position < this.text.length) {
      const character = this.text.charAt(this.position);
      if (character === Resources.scannerBacktick) {
        this.position++;
        break;
      }
      if (this.text.startsWith(Resources.scannerSubstitutionStart, this.position)) {
        this.position += Resources.scannerSubstitutionStart.length;
        this.substitutionDepths.push(this.braceDepth);
        this.texts.push(new SourceLiteral(value.toString(), line));
        this.pushToken(Resources.scannerOpeningBrace);
        return;
      }
      if (character === Resources.scannerLineFeed)
        this.line++;
      if (character === Resources.scannerBackslash) {
        value.append(this.text.charAt(this.position + 1));
        this.position += Resources.scannerEscapeLength;
        continue;
      }
      value.append(character);
      this.position++;
    }
    this.texts.push(new SourceLiteral(value.toString(), line));
    this.pushToken(Resources.scannerOperand);
  }

  private readRegularExpression(): void {
    let isInClass = false;
    this.position++;
    while (this.position < this.text.length) {
      const character = this.text.charAt(this.position);
      if (character === Resources.scannerLineFeed)
        break;
      this.position += character === Resources.scannerBackslash ? Resources.scannerEscapeLength : 1;
      if (character === Resources.scannerOpeningBracket)
        isInClass = true;
      else if (character === Resources.scannerClosingBracket)
        isInClass = false;
      else if (character === Resources.scannerSlash && !isInClass)
        break;
    }
    this.readWord();
    this.pushToken(Resources.scannerOperand);
  }

  private readIdentifier(): void {
    const word = this.readWord();
    if (word === Resources.scannerFunctionKeyword && this.previousToken !== Resources.scannerPropertyAccess)
      this.hasFunctionBody = true;
    this.pushToken(word);
  }

  private readWord(): string {
    const start = this.position;
    while (this.position < this.text.length && Resources.scannerWordPart.test(this.text.charAt(this.position)))
      this.position++;
    return this.text.slice(start, this.position);
  }

  private readPunctuator(character: string): void {
    this.position++;
    if (character === Resources.scannerClosingBrace && this.substitutionDepths.at(-1) === this.braceDepth) {
      this.substitutionDepths.pop();
      this.readTemplate();
      return;
    }
    if (character === Resources.scannerEquals && this.text.charAt(this.position) === Resources.scannerGreaterThan
      || character === Resources.scannerOpeningBrace && this.previousToken === Resources.scannerClosingParenthesis)
      this.hasFunctionBody = true;
    if (character === Resources.scannerOpeningBrace)
      this.braceDepth++;
    else if (character === Resources.scannerClosingBrace)
      this.braceDepth--;
    this.pushToken(character);
  }

  private allowsRegularExpression(): boolean {
    if (Object.isNull(this.previousToken) || Resources.scannerRegularExpressionKeywords.has(this.previousToken))
      return true;
    return !Resources.scannerOperandEnd.test(this.previousToken);
  }

  private classify(literal: SourceLiteral): void {
    if (this.isImportSpecifier())
      this.imports.push(literal);
    else if (this.previousToken === Resources.scannerColon && this.earlierToken === Resources.scannerSelectorKey)
      this.selectors.push(literal);
    else
      this.texts.push(literal);
  }

  private isImportSpecifier(): boolean {
    if (!Object.isNull(this.previousToken) && Resources.scannerImportKeywords.has(this.previousToken))
      return true;
    return this.previousToken === Resources.scannerOpeningParenthesis && !Object.isNull(this.earlierToken) && Resources.scannerImportCalls.has(this.earlierToken);
  }

  private pushToken(token: string): void {
    this.earlierToken = this.previousToken;
    this.previousToken = token;
  }
}

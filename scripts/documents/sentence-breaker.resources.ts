/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SentenceBreakerResources {
  public static readonly prefixPattern: RegExp = /^(?:[ \t]*>[ \t]?)*[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?/;
  public static readonly prefixMarkerPattern: RegExp = /[^>\s]/g;
  public static readonly quotePattern: RegExp = /^(?:[ \t]*>[ \t]?)*/;
  public static readonly indentedCodePattern: RegExp = /^(?: {4}| {0,3}\t)/;
  public static readonly listItemPattern: RegExp = /^[ \t]*(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
  public static readonly indentedPattern: RegExp = /^[ \t]/;
  public static readonly setextUnderlinePattern: RegExp = /^(?:=+|-+)[ \t]*$/;
  public static readonly fencePattern: RegExp = /^(`{3,}|~{3,})/;
  public static readonly frontMatterFence: string = "---";
  public static readonly notProsePattern: RegExp = /^(?:#|\||<|\[[^\]]+\]:)/;
  public static readonly terminators: string = ".?!";
  public static readonly closers: string = "\"')]*_";
  public static readonly openersPattern: RegExp = /^[(["'*_`]+/;
  public static readonly sentenceStartPattern: RegExp = /^[\p{Lu}\d`*_["'(]$/u;
  public static readonly blockStartPattern: RegExp = /^(?:[*][ \t]|\d{1,9}[.)](?:[ \t]|$))/;
  public static readonly tagStartPattern: RegExp = /^[A-Za-z/!]$/;
  public static readonly abbreviations: ReadonlySet<string> = new Set(["e.g.", "i.e.", "etc.", "vs.", "cf.", "No.", "Mr.", "Mrs.", "Ms.", "Dr.", "St."]);
  public static readonly codeMarker: string = "`";
  public static readonly linkTarget: string = "](";
  public static readonly openParenthesis: string = "(";
  public static readonly closeParenthesis: string = ")";
  public static readonly tagOpen: string = "<";
  public static readonly tagClose: string = ">";
}

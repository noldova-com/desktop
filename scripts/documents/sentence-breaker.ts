/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";
import { SentenceBreakerResources } from "./sentence-breaker.resources.ts";

export class SentenceBreaker {
  public format(text: string): string {
    const lines = text.split(Resources.lineEnd);
    const prose = SentenceBreaker.findProse(lines);
    return lines.flatMap((t, index) => prose[index] === true ? SentenceBreaker.split(t) : [t]).join(Resources.lineEnd);
  }

  public findCrowdedLines(text: string): readonly number[] {
    const lines = text.split(Resources.lineEnd);
    const prose = SentenceBreaker.findProse(lines);
    return lines.flatMap((t, index) => prose[index] === true && SentenceBreaker.split(t).length > 1 ? [index + 1] : []);
  }

  private static findProse(lines: readonly string[]): readonly boolean[] {
    const prose: boolean[] = [];
    let fence: string | null = null;
    let isComment = false;
    let isFrontMatter = lines[0] === SentenceBreakerResources.frontMatterFence;
    let isCode = false;
    let isList = false;
    let isAfterBlank = true;
    for (const [index, line] of lines.entries()) {
      const content = line.replace(SentenceBreakerResources.prefixPattern, String.empty);
      const body = line.replace(SentenceBreakerResources.quotePattern, String.empty);
      const isBlank = content.trim() === String.empty;
      const opening = SentenceBreakerResources.fencePattern.exec(content)?.[1];
      if (isFrontMatter) {
        isFrontMatter = index === 0 || line !== SentenceBreakerResources.frontMatterFence;
        prose.push(false);
      }
      else if (!Object.isNull(fence)) {
        if (!Object.isUndefined(opening) && opening[0] === fence[0] && opening.length >= fence.length && content.trim() === opening)
          fence = null;
        prose.push(false);
      }
      else if (isComment || line.includes(Resources.markupCommentStart)) {
        const end = line.lastIndexOf(Resources.markupCommentEnd);
        isComment = line.lastIndexOf(Resources.markupCommentStart) > end || isComment && end === -1;
        prose.push(false);
      }
      else if (isBlank)
        prose.push(false);
      else if ((isCode || isAfterBlank && !isList) && SentenceBreakerResources.indentedCodePattern.test(body)) {
        isCode = true;
        prose.push(false);
      }
      else if (SentenceBreakerResources.setextUnderlinePattern.test(content)) {
        isCode = false;
        for (let previous = index - 1; prose[previous] === true; previous--)
          prose[previous] = false;
        prose.push(false);
      }
      else {
        isCode = false;
        isList = SentenceBreakerResources.listItemPattern.test(body) || isList && (!isAfterBlank || SentenceBreakerResources.indentedPattern.test(body));
        fence = opening ?? null;
        prose.push(Object.isNull(fence) && !SentenceBreakerResources.notProsePattern.test(content));
      }
      isAfterBlank = isBlank;
    }
    return prose;
  }

  private static split(line: string): readonly string[] {
    const content = line.replace(SentenceBreakerResources.prefixPattern, String.empty);
    const prefix = line.slice(0, line.length - content.length);
    const continuation = prefix.replace(SentenceBreakerResources.prefixMarkerPattern, Resources.space);
    const breaks = SentenceBreaker.findBreaks(content);
    return [0, ...breaks.map(t => t + 1)].map((start, index) => `${index === 0 ? prefix : continuation}${content.slice(start, breaks[index])}`);
  }

  private static findBreaks(content: string): readonly number[] {
    const breaks: number[] = [];
    let code = 0;
    let target = 0;
    let isTag = false;
    for (let index = 0; index < content.length; index++) {
      const character = content.charAt(index);
      if (character === SentenceBreakerResources.codeMarker) {
        let run = 1;
        while (content.charAt(index + run) === SentenceBreakerResources.codeMarker)
          run++;
        code = code === 0 ? run : code === run ? 0 : code;
        index += run - 1;
      }
      else if (code > 0)
        continue;
      else if (target > 0)
        target += character === SentenceBreakerResources.openParenthesis ? 1 : character === SentenceBreakerResources.closeParenthesis ? -1 : 0;
      else if (isTag)
        isTag = character !== SentenceBreakerResources.tagClose;
      else if (content.startsWith(SentenceBreakerResources.linkTarget, index)) {
        target = 1;
        index++;
      }
      else if (character === SentenceBreakerResources.tagOpen && SentenceBreakerResources.tagStartPattern.test(content.charAt(index + 1)))
        isTag = true;
      else if (SentenceBreakerResources.terminators.includes(character)) {
        let end = index + 1;
        while (end < content.length && SentenceBreakerResources.closers.includes(content.charAt(end)))
          end++;
        if (content.charAt(end) === Resources.space && SentenceBreakerResources.sentenceStartPattern.test(content.charAt(end + 1))
          && !SentenceBreakerResources.blockStartPattern.test(content.slice(end + 1)) && !SentenceBreaker.isAbbreviation(content, index))
          breaks.push(end);
      }
    }
    return breaks;
  }

  private static isAbbreviation(content: string, terminator: number): boolean {
    const word = content.slice(content.lastIndexOf(Resources.space, terminator) + 1, terminator + 1).replace(SentenceBreakerResources.openersPattern, String.empty);
    return SentenceBreakerResources.abbreviations.has(word);
  }
}

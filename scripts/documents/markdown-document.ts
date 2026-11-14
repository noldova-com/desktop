/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { StringBuilder } from "@noldova/context.text";

import { Resources } from "../resources.ts";
import { MarkdownLink } from "./markdown-link.ts";

export class MarkdownDocument {
  public readonly path: string;
  public readonly anchors: ReadonlySet<string>;
  public readonly links: readonly MarkdownLink[];

  public constructor(path: string, text: string) {
    const lines = MarkdownDocument.readVisibleLines(text);

    this.path = path;
    this.anchors = MarkdownDocument.readAnchors(lines);
    this.links = MarkdownDocument.readLinks(lines);
  }

  private static readVisibleLines(text: string): readonly string[] {
    const visible: string[] = [];
    let fence: string | null = null;
    let isComment = false;
    for (const line of text.split(Resources.lineEnd)) {
      if (!Object.isNull(fence)) {
        const closing = Resources.markdownClosingFencePattern.exec(line)?.[1];
        if (!Object.isUndefined(closing) && closing[0] === fence[0] && closing.length >= fence.length)
          fence = null;
        visible.push(String.empty);
        continue;
      }

      const kept = new StringBuilder();
      let remaining = line;
      while (remaining.length > 0) {
        const marker = isComment ? Resources.markupCommentEnd : Resources.markupCommentStart;
        const index = remaining.indexOf(marker);
        if (!isComment)
          kept.append(index < 0 ? remaining : remaining.slice(0, index));
        remaining = index < 0 ? String.empty : remaining.slice(index + marker.length);
        if (index >= 0)
          isComment = !isComment;
      }

      fence = Resources.markdownOpeningFencePattern.exec(kept.toString())?.[1] ?? null;
      visible.push(Object.isNull(fence) ? kept.toString() : String.empty);
    }
    return visible;
  }

  private static readAnchors(lines: readonly string[]): ReadonlySet<string> {
    const anchors = new Set<string>();
    const occurrences = new Map<string, number>();
    for (const line of lines) {
      const heading = Resources.markdownHeadingPattern.exec(line);
      if (Object.isNull(heading))
        continue;

      const anchor = MarkdownDocument.formatAnchor(heading[1] ?? String.empty);
      const occurrence = occurrences.get(anchor) ?? 0;
      anchors.add(occurrence === 0 ? anchor : Resources.formatMarkdownAnchorOccurrence(anchor, occurrence));
      occurrences.set(anchor, occurrence + 1);
    }
    return anchors;
  }

  private static formatAnchor(heading: string): string {
    return heading
      .replace(Resources.markdownHeadingLinkPattern, Resources.markdownFirstGroupReplacement)
      .toLowerCase()
      .replace(Resources.markdownRemovedAnchorCharacters, String.empty)
      .replace(Resources.markdownSpacePattern, Resources.dash);
  }

  private static readLinks(lines: readonly string[]): readonly MarkdownLink[] {
    const links: MarkdownLink[] = [];
    for (const [index, line] of lines.entries()) {
      const text = line.replace(Resources.markdownCodeSpanPattern, String.empty);
      const definition = Resources.markdownDefinitionPattern.exec(text)?.[1];
      if (!Object.isUndefined(definition))
        links.push(new MarkdownLink(definition, index + 1));
      for (const match of text.matchAll(Resources.markdownInlineLinkPattern))
        if (!Object.isUndefined(match[1]))
          links.push(new MarkdownLink(match[1].replace(Resources.markdownAngleBracketsPattern, Resources.markdownFirstGroupReplacement), index + 1));
    }
    return links;
  }
}

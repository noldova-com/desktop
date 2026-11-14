/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class TextFormatValidator {
  private static readonly BYTE_ORDER_MARK: Buffer = Buffer.from(Resources.textFormatByteOrderMark);

  public validate(filePath: string, content: Buffer): readonly string[] {
    if (content.includes(Resources.textFormatNullByte))
      return [];

    const findings: string[] = [];
    if (content.subarray(0, TextFormatValidator.BYTE_ORDER_MARK.length).equals(TextFormatValidator.BYTE_ORDER_MARK))
      findings.push(Resources.formatTextFormatByteOrderMark(filePath));
    let hasCarriageReturn = false;
    for (const [index, line] of content.toString(Resources.encoding).split(Resources.lineEnd).entries()) {
      if (!hasCarriageReturn && line.includes(Resources.textFormatCarriageReturn)) {
        hasCarriageReturn = true;
        findings.push(Resources.formatTextFormatCarriageReturn(filePath, index + 1));
      }
      if (Resources.textFormatTrailingWhitespacePattern.test(line))
        findings.push(Resources.formatTextFormatTrailingWhitespace(filePath, index + 1));
    }
    if (content.at(-1) !== Resources.textFormatLineFeedByte)
      findings.push(Resources.formatTextFormatNoFinalNewline(filePath));
    else if (content.length === 1 || content.at(-2) === Resources.textFormatLineFeedByte)
      findings.push(Resources.formatTextFormatBlankLastLine(filePath));
    return findings;
  }
}

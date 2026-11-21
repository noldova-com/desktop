/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export type OutputKind = "expected" | "platform-log" | "diagnostic" | "crash" | "failure";

export interface IClassifiedLine {
  readonly kind: OutputKind;
  readonly text: string;
}

export class ErrorOutputClassifier {
  private static readonly EXPECTED: readonly RegExp[] = [/^\[\d+:\d+(?:\/\d+)?\.\d+:\w+:/, /^Debugger (?:listening|attached|ending)/, /^Waiting for the debugger to disconnect/, /^For help, see/];
  private static readonly MAC_LOG: RegExp = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+ [\w ]+(?: \([A-Za-z]+\))?\[\d+:\d+\] /;
  private static readonly WEB_VIEW_SCROLL: RegExp = /^\S+ Web view \S+ of \S+ (?:kept no scroll position|was not scrolled back to)\b/;
  private static readonly GTK_WARNING: RegExp = /^\([\w.-]+:\d+\): Gtk-WARNING \*\*: /;
  private static readonly GTK_CONTINUATION: RegExp = /^This may indicate that pixbuf loaders or the mime database could not be found\.$/;
  private static readonly CRASH_START: RegExp = /^Received signal \d+ /;
  private static readonly CRASH_END: RegExp = /^\[end of stack trace\]$/;
  private static readonly CRASH_LINES: number = 300;

  private isAfterGtkWarning: boolean = false;
  private crashLinesLeft: number = 0;
  private pending: string = String.empty;

  public classify(text: string): IClassifiedLine[] {
    const parts = `${this.pending}${text}`.split(/\r?\n/);
    this.pending = parts.pop() ?? String.empty;
    return this.classifyLines(parts);
  }

  public flush(): IClassifiedLine[] {
    const rest = this.pending;
    this.pending = String.empty;
    return this.classifyLines([rest]);
  }

  private classifyLines(texts: readonly string[]): IClassifiedLine[] {
    const lines: IClassifiedLine[] = [];
    for (const line of texts.map(t => t.trim()).filter(t => t.length > 0)) {
      const kind = this.classifyLine(line);
      if (kind !== "expected")
        lines.push({ kind, text: line });
    }
    return lines;
  }

  private classifyLine(line: string): OutputKind {
    if (this.crashLinesLeft === 0 && ErrorOutputClassifier.CRASH_START.test(line))
      this.crashLinesLeft = ErrorOutputClassifier.CRASH_LINES;
    if (this.crashLinesLeft > 0) {
      this.crashLinesLeft = ErrorOutputClassifier.CRASH_END.test(line) ? 0 : this.crashLinesLeft - 1;
      this.isAfterGtkWarning = false;
      return "crash";
    }
    const isContinuation = this.isAfterGtkWarning && ErrorOutputClassifier.GTK_CONTINUATION.test(line);
    this.isAfterGtkWarning = false;
    if (ErrorOutputClassifier.EXPECTED.some(t => t.test(line)))
      return "expected";
    if (ErrorOutputClassifier.WEB_VIEW_SCROLL.test(line))
      return "diagnostic";
    if (ErrorOutputClassifier.GTK_WARNING.test(line)) {
      this.isAfterGtkWarning = true;
      return "platform-log";
    }
    return isContinuation || ErrorOutputClassifier.MAC_LOG.test(line) ? "platform-log" : "failure";
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MainProcessLogFixture {
  private static readonly ENTRY: RegExp = /^\d{4}-\d{2}-\d{2}T\S+ /;
  private static readonly CONTINUATION: string = "    ";
  private static readonly MAIN_PROCESS_FAILURE: RegExp = /^\S+ The main process(?:'s main process failed| could not ask what to do after its main process failed)/;

  public static describeMainProcessFailures(lines: readonly string[]): string {
    const failures = MainProcessLogFixture.readEntries(lines).filter(t => MainProcessLogFixture.MAIN_PROCESS_FAILURE.test(t));
    if (failures.length === 0)
      return "The main process log shows no main-process failure.";
    return `The main process log shows ${failures.length === 1 ? "this main-process failure" : "these main-process failures"}:\n${failures.join("\n")}`;
  }

  private static readEntries(lines: readonly string[]): string[] {
    const entries: string[] = [];
    for (const line of lines)
      if (MainProcessLogFixture.ENTRY.test(line))
        entries.push(line);
      else if (entries.length > 0)
        entries[entries.length - 1] += `\n${MainProcessLogFixture.CONTINUATION}${line}`;
    return entries;
  }
}

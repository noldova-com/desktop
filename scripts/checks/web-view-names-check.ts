/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import path from "node:path";
import type { Writable } from "node:stream";

import { Resources as BuildResources } from "../../src/noldova.desktop.build/src/resources.ts";
import { ClassFieldsReader } from "../structure/class-fields.reader.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class WebViewNamesCheck implements ICheck {
  public readonly title: string = Resources.webViewNamesCheckTitle;

  public async runAsync(output: Writable): Promise<boolean> {
    const protocol = await ClassFieldsReader.readAsync(path.join(import.meta.dirname, Resources.checksToRepositoryRoot, Resources.webViewNamesProtocolFile));
    const pairs = [
      [Resources.webViewNamesMethodPatternField, String(BuildResources.webViewMethodPattern), Resources.webViewNamesMethodPatternOwner, protocol.readText(Resources.webViewNamesMethodPatternField)],
      [Resources.webViewNamesNamePatternField, String(BuildResources.camelCaseNamePattern), Resources.webViewNamesMemberPatternOwner, protocol.readText(Resources.webViewNamesMemberPatternField)],
      [Resources.webViewNamesRefusedMethodsField, BuildResources.webViewRefusedMethods.join(Resources.listSeparator), Resources.webViewNamesRefusedMethodsOwner,
        protocol.readList(Resources.webViewNamesRefusedMethodsField)?.join(Resources.listSeparator) ?? null],
      [Resources.webViewNamesRefusedDomainsField, BuildResources.webViewRefusedDomains.join(Resources.listSeparator), Resources.webViewNamesRefusedDomainsOwner,
        protocol.readList(Resources.webViewNamesRefusedDomainsField)?.join(Resources.listSeparator) ?? null]
    ] as const;
    const findings = pairs.map(([name, copy, owner, owned]) => Object.isNull(owned)
      ? Resources.formatWebViewNamesUnreadable(owner, name)
      : copy === owned ? null
        : Resources.formatWebViewNamesMismatch(name, copy, owner, owned))
      .filter(t => Object.isString(t));
    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatWebViewNamesChecked(pairs.length));
    return findings.length === 0;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";

import { Resources } from "../resources.ts";
import type { MarkdownDocument } from "./markdown-document.ts";
import type { MarkdownLink } from "./markdown-link.ts";

export class DocumentLinkValidator {
  private readonly files: ReadonlySet<string>;
  private readonly folders: ReadonlySet<string>;
  private readonly documents: ReadonlyMap<string, MarkdownDocument>;

  public constructor(files: readonly string[], documents: readonly MarkdownDocument[]) {
    const folders = new Set<string>(Resources.documentLinkRootFolders);
    for (const file of files)
      for (let folder = path.posix.dirname(file); !folders.has(folder); folder = path.posix.dirname(folder))
        folders.add(folder);

    this.files = new Set<string>(files);
    this.folders = folders;
    this.documents = new Map<string, MarkdownDocument>(documents.map(t => [t.path, t]));
  }

  public validate(document: MarkdownDocument): readonly string[] {
    const findings: string[] = [];
    for (const link of document.links) {
      const problem = this.findProblem(document, link);
      if (!Object.isNull(problem))
        findings.push(Resources.formatDocumentLinkFinding(document.path, link.line, link.target, problem));
    }
    return findings;
  }

  private static findExternalProblem(target: string): string | null {
    if (!URL.canParse(target))
      return Resources.documentLinkInvalidUrl;
    return Resources.documentLinkExternalProtocols.includes(new URL(target).protocol) ? null : Resources.documentLinkUnsupportedProtocol;
  }

  private static decode(target: string): string | null {
    try {
      return decodeURIComponent(target);
    }
    catch {
      return null;
    }
  }

  private findProblem(document: MarkdownDocument, link: MarkdownLink): string | null {
    if (link.target.startsWith(Resources.documentLinkRepositoryUrl))
      return this.findRepositoryProblem(link.target.slice(Resources.documentLinkRepositoryUrl.length));
    if (Resources.documentLinkSchemePattern.test(link.target))
      return DocumentLinkValidator.findExternalProblem(link.target);

    const separator = link.target.indexOf(Resources.documentLinkAnchorSeparator);
    const target = separator < 0 ? link.target : link.target.slice(0, separator);
    const anchor = separator < 0 ? null : link.target.slice(separator + 1);
    if (target.length === 0)
      return this.findLocalProblem(document.path, anchor);

    const decoded = DocumentLinkValidator.decode(target);
    if (Object.isNull(decoded))
      return Resources.documentLinkInvalidPath;
    const resolved = decoded.startsWith(Resources.documentLinkRootPrefix)
      ? path.posix.normalize(decoded.slice(Resources.documentLinkRootPrefix.length))
      : path.posix.join(path.posix.dirname(document.path), decoded);
    return this.findLocalProblem(resolved, anchor);
  }

  private findRepositoryProblem(location: string): string | null {
    const file = Resources.documentLinkRepositoryFilePattern.exec(location)?.[1];
    if (Object.isUndefined(file))
      return null;

    const separator = file.indexOf(Resources.documentLinkAnchorSeparator);
    const target = DocumentLinkValidator.decode(separator < 0 ? file : file.slice(0, separator));
    if (Object.isNull(target))
      return Resources.documentLinkInvalidPath;
    return this.findLocalProblem(path.posix.normalize(target), separator < 0 ? null : file.slice(separator + 1));
  }

  private findLocalProblem(target: string, anchor: string | null): string | null {
    const file = target.replace(Resources.documentLinkTrailingSeparatorPattern, String.empty);
    if (file === Resources.parentFolder || file.startsWith(Resources.parentFolderPrefix))
      return Resources.documentLinkOutside;
    if (!this.files.has(file) && !this.folders.has(file))
      return Resources.documentLinkMissingFile;
    if (Object.isNull(anchor) || !file.endsWith(Resources.markdownExtension))
      return null;
    return this.documents.get(file)?.anchors.has(anchor) === true ? null : Resources.formatDocumentLinkMissingHeading(anchor);
  }
}

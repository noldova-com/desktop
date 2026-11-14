/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import { DocumentLinkValidator } from "../documents/document-link.validator.ts";
import { GitAttributesValidator } from "../documents/git-attributes.validator.ts";
import { MarkdownDocument } from "../documents/markdown-document.ts";
import { SentenceBreaker } from "../documents/sentence-breaker.ts";
import { TextFormatValidator } from "../documents/text-format.validator.ts";
import type { RepositoryFiles } from "../structure/repository-files.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class DocumentCheck implements ICheck {
  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = Resources.documentCheckTitle;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = await this.files.listAsync();
    const formatValidator = new TextFormatValidator();
    const breaker = new SentenceBreaker();
    const findings: string[] = [];
    const documents: MarkdownDocument[] = [];
    let attributes: string | null = null;
    for (const file of files) {
      const content = await readFile(path.join(this.root, file));
      findings.push(...formatValidator.validate(file, content));
      if (file === Resources.gitAttributesFile)
        attributes = content.toString(Resources.encoding);
      if (file.endsWith(Resources.markdownExtension)) {
        const text = content.toString(Resources.encoding);
        documents.push(new MarkdownDocument(file, text));
        findings.push(...breaker.findCrowdedLines(text).map(t => Resources.formatDocumentCrowded(file, t)));
      }
    }

    findings.push(...new GitAttributesValidator().validate(attributes));
    const linkValidator = new DocumentLinkValidator(files, documents);
    for (const document of documents)
      findings.push(...linkValidator.validate(document));
    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatDocumentChecked(files.length, documents.length));
    return findings.length === 0;
  }
}

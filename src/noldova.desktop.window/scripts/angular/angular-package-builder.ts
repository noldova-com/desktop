/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { BuildException } from "../../../noldova.desktop.build/src/exceptions/build.exception.ts";
import type { ProcessRunner } from "../../../noldova.desktop.build/src/services/processes/process-runner.ts";
import { ProcessTimeoutException } from "../../../noldova.desktop.build/src/exceptions/process-timeout.exception.ts";
import { SourceScanner } from "../../../noldova.desktop.build/src/services/structure/source-scanner.ts";
import { JsonFields } from "../../../../scripts/totals/json-fields.ts";
import { TotalsException } from "../../../../scripts/totals/totals.exception.ts";
import { Resources } from "../../../noldova.desktop.build/src/resources.ts";

export class AngularPackageBuilder {
  private static readonly USAGE: string = "Usage: node <package>/scripts/build.ts <output folder>, or --inputs to list what the build copies from outside the package, run from the repository's root\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly PROJECT_FOLDER: string = "src/noldova.desktop.window";
  private static readonly PROJECT_FILE: string = "tsconfig.json";
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly ENTRY_FOLDER: string = "api";
  private static readonly STYLES_FOLDER: string = "styles";
  private static readonly SCRIPT_EXTENSION: string = ".ts";
  private static readonly DECLARATIONS: string = ".d.ts";
  private static readonly STYLE_EXTENSION: string = ".css";
  private static readonly IMPORT_EXTENSION: string = ".js";
  private static readonly RELATIVE_PREFIX: string = ".";
  private static readonly GENERATED_IMPORT: RegExp = /(\bimport \* as i\d+ from )(["'])(\.{1,2}\/[^"']*)\2/g;
  private static readonly IMPORT_RULE: string = "Node.js, and TypeScript with NodeNext resolution, find a package's own file only by its full name, so each relative import in src/ names its file with .js, as in \"../app/models/status-bar-item.js\".";
  private static readonly COMPILER_MANIFEST: readonly string[] = ["node_modules", "@angular", "compiler-cli", "package.json"];
  private static readonly COMMANDS_FIELD: string = "bin";
  private static readonly COMPILER_COMMAND: string = "ngc";
  private static readonly PROJECT_OPTION: string = "-p";
  private static readonly WORK_PREFIX: string = "noldova-angular-package-";
  private static readonly ENCODING: BufferEncoding = "utf8";
  private static readonly URL: RegExp = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;
  private static readonly NOT_A_PATH: RegExp = /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i;
  private static readonly LINE_END: string = "\n";
  private static readonly PROBLEM_INDENT: string = "  ";
  private static readonly JSON_INDENT: number = 2;
  private static readonly COMPILATION_MODE: string = "partial";
  private static readonly PARENT_FOLDER: string = "..";
  private static readonly SHIPPED_SUBJECT: string = "The package ships";
  private static readonly NO_COMPILER: string = "The repository has no Angular compiler to run; its npm ci installs one.";

  private readonly root: string;
  private readonly directory: string;
  private readonly runner: ProcessRunner;
  private readonly output: Writable;
  private readonly listing: Writable;
  private readonly shipped: readonly string[];
  private readonly compileTimeout: number;
  private readonly carryTimeout: number;

  public constructor(
    root: string,
    directory: string,
    runner: ProcessRunner,
    output: Writable,
    listing: Writable,
    shipped: readonly string[] = [],
    compileTimeout: number = Resources.compileTimeout,
    carryTimeout: number = Resources.carryTimeout) {
    this.root = root;
    this.directory = directory;
    this.runner = runner;
    this.output = output;
    this.listing = listing;
    this.shipped = shipped.map(t => path.join(root, ...t.split(path.posix.sep)));
    this.compileTimeout = compileTimeout;
    this.carryTimeout = carryTimeout;
  }

  public async runAsync(buildArguments: readonly string[]): Promise<number> {
    const [folder, ...others] = buildArguments;
    if (Object.isUndefined(folder) || others.length > 0) {
      this.output.write(AngularPackageBuilder.USAGE);
      return AngularPackageBuilder.USAGE_EXIT_CODE;
    }

    try {
      if (folder === Resources.inputsOption)
        this.listing.write((await this.listInputsAsync()).map(t => `${this.describe(t)}${AngularPackageBuilder.LINE_END}`).join(String.empty));
      else
        await this.buildAsync(path.resolve(folder));
      return 0;
    }
    catch (error) {
      if (!(error instanceof BuildException || error instanceof TotalsException))
        throw error;
      this.output.write(`${error.message}${AngularPackageBuilder.LINE_END}`);
      return 1;
    }
  }

  public async buildAsync(output: string): Promise<void> {
    await this.carryDocsAsync(output, await this.compileAsync(output));
    await this.nameGeneratedImportsAsync(output);
    await this.checkImportsAsync(output);
    const copied = new Map<string, string>();
    await this.copyStylesAsync(output, copied);
    await this.copyShippedAsync(output, copied);
  }

  private async compileAsync(output: string): Promise<readonly string[]> {
    const project = path.join(this.root, AngularPackageBuilder.PROJECT_FOLDER);
    const source = path.join(this.directory, AngularPackageBuilder.SOURCE_FOLDER);
    const entries = path.join(source, AngularPackageBuilder.ENTRY_FOLDER);
    const files = existsSync(entries)
      ? (await readdir(entries)).filter(t => t.endsWith(AngularPackageBuilder.SCRIPT_EXTENSION) && !t.endsWith(AngularPackageBuilder.DECLARATIONS)).sort().map(t => path.join(entries, t))
      : [];
    if (files.length === 0)
      throw new BuildException(AngularPackageBuilder.formatNoEntries(this.describe(entries)));

    const work = await mkdtemp(path.join(os.tmpdir(), AngularPackageBuilder.WORK_PREFIX));
    try {
      const configuration = path.join(work, AngularPackageBuilder.PROJECT_FILE);
      await writeFile(configuration, `${JSON.stringify({
        extends: path.join(project, AngularPackageBuilder.PROJECT_FILE),
        compilerOptions: { rootDir: source, outDir: output, declaration: true, sourceMap: true, types: [] },
        angularCompilerOptions: { compilationMode: AngularPackageBuilder.COMPILATION_MODE },
        files
      }, null, AngularPackageBuilder.JSON_INDENT)}${AngularPackageBuilder.LINE_END}`, AngularPackageBuilder.ENCODING);
      const compiler = await this.locateCompilerAsync();
      const result = await this.runner.captureAsync(process.execPath, [compiler, AngularPackageBuilder.PROJECT_OPTION, configuration], project, this.compileTimeout)
        .catch((error: unknown) => {
          if (error instanceof ProcessTimeoutException)
            throw new BuildException(AngularPackageBuilder.formatCompileTimeout(this.describe(source), this.compileTimeout), new ExceptionOptions(error));
          throw error;
        });
      if (!result.isSuccessful)
        throw new BuildException(AngularPackageBuilder.formatCompileFailure(this.describe(source), result.exitCode, result.text));
    }
    finally {
      await rm(work, { recursive: true, force: true });
    }
    return files;
  }

  private async carryDocsAsync(output: string, entries: readonly string[]): Promise<void> {
    const script = path.join(this.root, ...Resources.carryScriptSegments);
    const project = path.join(this.root, AngularPackageBuilder.PROJECT_FOLDER, AngularPackageBuilder.PROJECT_FILE);
    const result = await this.runner.captureAsync(process.execPath, [script, project, output, ...entries], this.root, this.carryTimeout)
      .catch((error: unknown) => {
        if (error instanceof ProcessTimeoutException)
          throw new BuildException(AngularPackageBuilder.formatCarryTimeout(this.describe(output), this.carryTimeout), new ExceptionOptions(error));
        throw error;
      });
    if (!result.isSuccessful)
      throw new BuildException(AngularPackageBuilder.formatCarryFailure(this.describe(output), result.exitCode, result.text));
  }

  private async nameGeneratedImportsAsync(output: string): Promise<void> {
    for (const entry of (await readdir(output, { recursive: true })).sort()) {
      const file = path.join(output, entry);
      if (!file.endsWith(AngularPackageBuilder.DECLARATIONS) && !file.endsWith(AngularPackageBuilder.IMPORT_EXTENSION))
        continue;
      const text = await readFile(file, AngularPackageBuilder.ENCODING);
      const named = text.replace(AngularPackageBuilder.GENERATED_IMPORT, (whole, start: string, quote: string, specifier: string) =>
        specifier.endsWith(AngularPackageBuilder.IMPORT_EXTENSION) ? whole : `${start}${quote}${specifier}${AngularPackageBuilder.IMPORT_EXTENSION}${quote}`);
      if (named !== text)
        await writeFile(file, named, AngularPackageBuilder.ENCODING);
    }
  }

  private async checkImportsAsync(output: string): Promise<void> {
    const problems: string[] = [];
    for (const entry of (await readdir(output, { recursive: true })).sort()) {
      const file = path.join(output, entry);
      const declares = file.endsWith(AngularPackageBuilder.DECLARATIONS);
      if (!declares && !file.endsWith(AngularPackageBuilder.IMPORT_EXTENSION))
        continue;
      for (const literal of new SourceScanner(await readFile(file, AngularPackageBuilder.ENCODING)).scan().imports) {
        if (!literal.value.startsWith(AngularPackageBuilder.RELATIVE_PREFIX))
          continue;
        const imported = path.resolve(path.dirname(file), literal.value);
        if (!literal.value.endsWith(AngularPackageBuilder.IMPORT_EXTENSION))
          problems.push(AngularPackageBuilder.formatMissingExtension(this.describe(file), literal.line, literal.value));
        else if (!existsSync(declares ? `${imported.slice(0, -AngularPackageBuilder.IMPORT_EXTENSION.length)}${AngularPackageBuilder.DECLARATIONS}` : imported))
          problems.push(AngularPackageBuilder.formatMissingImport(this.describe(file), literal.line, literal.value));
      }
    }
    if (problems.length > 0)
      throw new BuildException(AngularPackageBuilder.formatUnloadableImports(this.describe(output), problems));
  }

  private async locateCompilerAsync(): Promise<string> {
    const manifest = path.join(this.root, ...AngularPackageBuilder.COMPILER_MANIFEST);
    if (!existsSync(manifest))
      throw new BuildException(AngularPackageBuilder.NO_COMPILER);
    const command = JsonFields.parse(await readFile(manifest, AngularPackageBuilder.ENCODING), this.describe(manifest))
      .object(AngularPackageBuilder.COMMANDS_FIELD)
      .text(AngularPackageBuilder.COMPILER_COMMAND);
    return path.join(path.dirname(manifest), command);
  }

  private async listInputsAsync(): Promise<readonly string[]> {
    const folders = new Set<string>(this.shipped);
    for (const file of (await this.listStyleFilesAsync()).filter(t => t.endsWith(AngularPackageBuilder.STYLE_EXTENSION)))
      for (const referenced of this.locateOutside(file, await readFile(file, AngularPackageBuilder.ENCODING)).values())
        if (existsSync(referenced))
          folders.add(path.dirname(referenced));
    return [...folders].sort();
  }

  private async copyStylesAsync(output: string, copied: Map<string, string>): Promise<void> {
    for (const file of await this.listStyleFilesAsync()) {
      const target = path.join(output, AngularPackageBuilder.STYLES_FOLDER, path.relative(this.stylesFolder, file));
      await mkdir(path.dirname(target), { recursive: true });
      if (!file.endsWith(AngularPackageBuilder.STYLE_EXTENSION)) {
        await copyFile(file, target);
        continue;
      }

      const text = await readFile(file, AngularPackageBuilder.ENCODING);
      const rewritten = new Map<string, string>();
      for (const [reference, referenced] of this.locateOutside(file, text)) {
        if (!existsSync(referenced))
          throw new BuildException(AngularPackageBuilder.formatMissingReference(this.describe(file), reference));
        const folder = path.dirname(referenced);
        const copy = await this.copyFolderAsync(folder, output, copied, AngularPackageBuilder.formatReferrer(this.describe(file)));
        rewritten.set(reference, path.relative(path.dirname(target), path.join(copy, path.basename(referenced))).split(path.sep).join(path.posix.sep));
      }
      await writeFile(target, text.replace(AngularPackageBuilder.URL, (whole, quote: string, reference: string) => {
        const replacement = rewritten.get(reference);
        return Object.isUndefined(replacement) ? whole : AngularPackageBuilder.formatUrl(quote, replacement);
      }), AngularPackageBuilder.ENCODING);
    }
  }

  private async copyShippedAsync(output: string, copied: Map<string, string>): Promise<void> {
    for (const folder of this.shipped) {
      if (!existsSync(folder))
        throw new BuildException(AngularPackageBuilder.formatMissingShipped(this.describe(folder)));
      await this.copyFolderAsync(folder, output, copied, AngularPackageBuilder.SHIPPED_SUBJECT);
    }
  }

  private async copyFolderAsync(folder: string, output: string, copied: Map<string, string>, subject: string): Promise<string> {
    const copy = path.join(output, path.basename(folder));
    const earlier = copied.get(copy);
    if (!Object.isUndefined(earlier) && earlier !== folder)
      throw new BuildException(AngularPackageBuilder.formatTakenFolder(subject, this.describe(folder), this.describe(earlier), path.basename(folder)));
    if (Object.isUndefined(earlier)) {
      await cp(folder, copy, { recursive: true });
      copied.set(copy, folder);
    }
    return copy;
  }

  private get stylesFolder(): string {
    return path.join(this.directory, AngularPackageBuilder.SOURCE_FOLDER, AngularPackageBuilder.STYLES_FOLDER);
  }

  private async listStyleFilesAsync(): Promise<readonly string[]> {
    const styles = this.stylesFolder;
    if (!existsSync(styles))
      return [];

    const files: string[] = [];
    for (const entry of (await readdir(styles, { recursive: true })).sort()) {
      const file = path.join(styles, entry);
      if ((await stat(file)).isFile())
        files.push(file);
    }
    return files;
  }

  private locateOutside(file: string, text: string): ReadonlyMap<string, string> {
    const references = new Map<string, string>();
    for (const match of text.matchAll(AngularPackageBuilder.URL)) {
      const reference = String(match[2]);
      if (AngularPackageBuilder.NOT_A_PATH.test(reference))
        continue;
      const referenced = path.resolve(path.dirname(file), reference);
      if (path.relative(this.stylesFolder, referenced).startsWith(AngularPackageBuilder.PARENT_FOLDER))
        references.set(reference, referenced);
    }
    return references;
  }

  private describe(file: string): string {
    return path.relative(this.root, file).split(path.sep).join(path.posix.sep);
  }

  private static formatNoEntries(entries: string): string {
    return `${entries} has no entry files to compile.`;
  }

  private static formatCompileTimeout(source: string, timeout: number): string {
    return `Compiling ${source} with the Angular compiler did not finish within ${timeout} ms.`;
  }

  private static formatCompileFailure(source: string, exitCode: number | null, text: string): string {
    return `Compiling ${source} with the Angular compiler failed with exit code ${exitCode}:${AngularPackageBuilder.LINE_END}${text}`;
  }

  private static formatCarryTimeout(output: string, timeout: number): string {
    return `Carrying the documented declarations onto ${output} did not finish within ${timeout} ms.`;
  }

  private static formatCarryFailure(output: string, exitCode: number | null, text: string): string {
    return `Carrying the documented declarations onto ${output} failed with exit code ${exitCode}:${AngularPackageBuilder.LINE_END}${text}`;
  }

  private static formatMissingExtension(file: string, line: number, specifier: string): string {
    return `${file}:${line}: imports "${specifier}" without its ${AngularPackageBuilder.IMPORT_EXTENSION} extension.`;
  }

  private static formatMissingImport(file: string, line: number, specifier: string): string {
    return `${file}:${line}: imports "${specifier}", which the package doesn't hold.`;
  }

  private static formatUnloadableImports(output: string, problems: readonly string[]): string {
    const listed = problems.map(t => `${AngularPackageBuilder.PROBLEM_INDENT}${t}${AngularPackageBuilder.LINE_END}`).join(String.empty);
    return `The compiled files in ${output} import their package's own files by names Node.js can't load:${AngularPackageBuilder.LINE_END}${listed}${AngularPackageBuilder.IMPORT_RULE}`;
  }

  private static formatMissingReference(file: string, reference: string): string {
    return `${file} refers to ${reference}, which does not exist.`;
  }

  private static formatReferrer(file: string): string {
    return `${file} refers to`;
  }

  private static formatUrl(quote: string, reference: string): string {
    return `url(${quote}${reference}${quote})`;
  }

  private static formatMissingShipped(folder: string): string {
    return `${AngularPackageBuilder.SHIPPED_SUBJECT} ${folder}, which does not exist.`;
  }

  private static formatTakenFolder(subject: string, folder: string, earlier: string, name: string): string {
    return `${subject} ${folder}, and the package already takes ${earlier} as ${name}/.`;
  }
}

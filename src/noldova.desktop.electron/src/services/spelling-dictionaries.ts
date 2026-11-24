/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";
import { FolderCreation } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";
import { FilePresence } from "./file-presence.js";

export class SpellingDictionaries {
  public static async installAsync(sourceFolder: string, profileFolder: string, log: (text: string) => void): Promise<readonly string[]> {
    let dictionaries: readonly JsonReader[];
    try {
      dictionaries = JsonReader.parse(await readFile(join(sourceFolder, Resources.dictionariesFile), Resources.textEncoding)).readObjectArray(Resources.dictionariesField);
    }
    catch (error) {
      log(Resources.formatDictionariesUnread(String(error)));
      return [];
    }
    const target = join(profileFolder, Resources.dictionariesFolder);
    const languages: string[] = [];
    for (const dictionary of dictionaries)
      try {
        const language = SpellingDictionaries.read(dictionary, Resources.languageField, Resources.languageTagPattern);
        const file = SpellingDictionaries.read(dictionary, Resources.fileField, Resources.dictionaryFilePattern);
        await SpellingDictionaries.copyAsync(join(sourceFolder, file), target, file);
        languages.push(language);
      }
      catch (error) {
        log(Resources.formatDictionaryUncopied(String(error)));
      }
    return languages;
  }

  public static addressOf(profileFolder: string): string {
    return `${pathToFileURL(join(profileFolder, Resources.dictionariesFolder)).href}${Resources.urlSeparator}`;
  }

  private static read(dictionary: JsonReader, name: string, pattern: RegExp): string {
    const value = dictionary.readString(name);
    if (!pattern.test(value))
      throw new JsonException(Resources.formatDictionaryFieldInvalid(value), Resources.formatJsonPath(dictionary.path, name));
    return value;
  }

  private static async copyAsync(source: string, target: string, file: string): Promise<void> {
    const destination = join(target, file);
    if (await FilePresence.existsAsync(destination))
      return;
    const content = await readFile(source);
    await FolderCreation.createAsync(target);
    await writeFile(`${destination}${Resources.temporarySuffix}`, content);
    await rename(`${destination}${Resources.temporarySuffix}`, destination);
  }
}

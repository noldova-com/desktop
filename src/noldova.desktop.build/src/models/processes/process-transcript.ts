/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StringDecoder } from "node:string_decoder";

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class ProcessTranscript {
  private readonly lines: string[] = [];
  private readonly streams: [{ readonly decoder: StringDecoder, tail: string }, { readonly decoder: StringDecoder, tail: string }] = [
    { decoder: new StringDecoder(Resources.textEncoding), tail: String.empty },
    { decoder: new StringDecoder(Resources.textEncoding), tail: String.empty }
  ];

  public add(chunk: Buffer, isError: boolean): void {
    const stream = this.streams[isError ? 1 : 0];
    const text = `${stream.tail}${stream.decoder.write(chunk)}`;
    const end = text.lastIndexOf(Resources.lineSeparator) + 1;
    this.lines.push(text.slice(0, end));
    stream.tail = text.slice(end);
  }

  public get text(): string {
    return `${this.lines.join(String.empty)}${this.streams.map(t => t.tail).filter(t => t.length > 0).join(Resources.lineSeparator)}`;
  }
}

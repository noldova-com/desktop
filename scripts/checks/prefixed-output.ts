/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Writable } from "node:stream";
import { StringDecoder } from "node:string_decoder";

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class PrefixedOutput extends Writable {
  private readonly prefix: string;
  private readonly target: Writable;
  private readonly decoder: StringDecoder = new StringDecoder(Resources.encoding);
  private pending: string = String.empty;

  public constructor(prefix: string, target: Writable) {
    super();

    this.prefix = prefix;
    this.target = target;
  }

  public flush(): void {
    const rest = this.pending + this.decoder.end();
    this.pending = String.empty;
    if (rest.length > 0)
      this.target.write(`${this.prefix}${rest}${Resources.lineEnd}`);
  }

  public override _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
    const lines = (this.pending + this.decoder.write(chunk)).split(Resources.lineEnd);
    this.pending = lines.pop() ?? String.empty;
    if (lines.length > 0)
      this.target.write(lines.map(t => `${this.prefix}${t}${Resources.lineEnd}`).join(String.empty));
    done();
  }
}

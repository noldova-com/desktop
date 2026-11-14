/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageAuthor, MessageBlock } from "@noldova/ui.components.angular";

export class NotesFeedMessage {
  public readonly key: string;
  public readonly author: MessageAuthor;
  public readonly time: Date;
  public readonly blocks: readonly MessageBlock[];

  public constructor(key: string, author: MessageAuthor, time: Date, blocks: readonly MessageBlock[]) {
    this.key = key;
    this.author = author;
    this.time = time;
    this.blocks = blocks;
  }
}

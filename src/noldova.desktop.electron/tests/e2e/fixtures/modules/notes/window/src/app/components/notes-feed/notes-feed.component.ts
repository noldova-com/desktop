/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, input, type InputSignal } from "@angular/core";

import {
  ArrayVirtualListSource, MessageAuthor, MessageAuthorKind, type MessageBlock, MessageCode, MessageComponent, MessageStatus, MessageText, VirtualListComponent, VirtualListKind, VirtualRowDirective
} from "@noldova/ui.components.angular";

import { NotesFeedMessage } from "../../notes-feed-message";

@Component({
  selector: "nol-notes-feed",
  imports: [MessageComponent, VirtualListComponent, VirtualRowDirective],
  templateUrl: "./notes-feed.component.html",
  styleUrl: "./notes-feed.component.css"
})
export class NotesFeedComponent {
  private static readonly LENGTH: number = 10_000;
  private static readonly ESTIMATE: number = 30;
  private static readonly START: number = Date.UTC(2026, 9, 1, 9);
  private static readonly STEP: number = 60_000;
  private static readonly PERSON: MessageAuthor = new MessageAuthor("ada", "Ada", MessageAuthorKind.Person);
  private static readonly AGENT: MessageAuthor = new MessageAuthor("reviewer", "Reviewer", MessageAuthorKind.Agent);
  private static readonly TEXT: string = "The build finished on every system, and the list kept its place while older messages loaded above it.";
  private static readonly CODE: string = "npm run build";

  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input.required<string>();

  protected readonly kinds: typeof VirtualListKind = VirtualListKind;
  protected readonly complete: MessageStatus = MessageStatus.Complete;
  protected readonly messages: ArrayVirtualListSource<NotesFeedMessage> = new ArrayVirtualListSource(Array.from({ length: NotesFeedComponent.LENGTH }, (_, t) =>
    new NotesFeedMessage(`message-${t + 1}`, t % 2 === 0 ? NotesFeedComponent.PERSON : NotesFeedComponent.AGENT,
      new Date(NotesFeedComponent.START + t * NotesFeedComponent.STEP), NotesFeedComponent.createBlocks(t))),
  t => t.key, NotesFeedComponent.ESTIMATE);

  private static createBlocks(index: number): readonly MessageBlock[] {
    const text = new MessageText(`Message ${index + 1}. ${NotesFeedComponent.TEXT}`);
    return index === NotesFeedComponent.LENGTH - 1 ? [text, new MessageCode(NotesFeedComponent.CODE)] : [text];
  }
}

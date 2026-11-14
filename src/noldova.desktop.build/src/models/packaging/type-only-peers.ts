/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { PackagingSection } from "./packaging-section.ts";
import { Resources } from "../../resources.ts";

export class TypeOnlyPeers {
  private readonly peers: ReadonlyMap<string, ReadonlySet<string>>;

  public constructor(peers: ReadonlyMap<string, ReadonlySet<string>> = new Map()) {
    this.peers = peers;
  }

  public static async readAsync(root: string): Promise<TypeOnlyPeers> {
    return new TypeOnlyPeers(await PackagingSection.readAsync(root, Resources.typeOnlyPeersField, Resources.typeOnlyPeersShape, t => PackagingSection.readNames(t, Resources.typeOnlyPeersListField)));
  }

  public passes(id: string, peer: string): boolean {
    return this.peers.get(id)?.has(peer) ?? false;
  }

  public of(id: string): readonly string[] {
    return [...this.peers.get(id) ?? []];
  }

  public describe(): string {
    return Resources.formatTypeOnlyPeers(this.peers);
  }

  public get ids(): readonly string[] {
    return [...this.peers.keys()];
  }

  public listOtherVersions(id: string): readonly string[] {
    const name = TypeOnlyPeers.nameOf(id);
    return this.ids.filter(t => t !== id && TypeOnlyPeers.nameOf(t) === name);
  }

  private static nameOf(id: string): string {
    return id.slice(0, id.lastIndexOf(Resources.packageVersionSeparator));
  }
}

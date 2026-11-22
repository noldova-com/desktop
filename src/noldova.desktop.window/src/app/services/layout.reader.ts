/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { QualifiedName } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.js";
import { BottomDockSpan } from "../enums/bottom-dock-span.js";
import { DockSide } from "../enums/dock-side.js";
import { SplitAxis } from "../enums/split-axis.js";
import { Dock } from "../models/layout/dock.js";
import { DocumentGroup } from "../models/layout/document-group.js";
import { DocumentTab } from "../models/layout/document-tab.js";
import { Layout } from "../models/layout/layout.js";
import type { LayoutNode } from "../models/layout/layout.node.js";
import { SplitPart } from "../models/layout/split-part.js";
import { SplitNode } from "../models/layout/split.node.js";
import type { Tab } from "../models/layout/tab.js";
import { TabGroup } from "../models/layout/tab-group.js";
import { ToolbarLayout } from "../models/layout/toolbar-layout.js";
import { ViewTab } from "../models/layout/view-tab.js";

export class LayoutReader {
  private readonly moves: ReadonlyMap<string, DocumentTab>;
  private nextId: number = Resources.documentsGroupId + 1;
  private hasDocuments: boolean = false;

  private constructor(moves: ReadonlyMap<string, DocumentTab> = new Map()) {
    this.moves = moves;
  }

  public static read(value: unknown, formerNames: ReadonlyMap<string, string> = new Map()): Layout {
    return new LayoutReader(LayoutReader.readMoves(value, formerNames)).readLayout(JsonReader.fromValue(value));
  }

  public static readTitles(value: unknown, formerNames: ReadonlyMap<string, string> = new Map()): ReadonlyMap<string, string> {
    const json = JsonReader.fromValue(value);
    if (!json.hasField(Resources.titlesField))
      return new Map();
    const moves = LayoutReader.readMoves(value, formerNames);
    const titles = json.readObject(Resources.titlesField);
    return new Map(Object.keys(titles.toJson()).map(t => [moves.get(t)?.key ?? t, titles.readString(t)]));
  }

  private static readMoves(value: unknown, formerNames: ReadonlyMap<string, string>): ReadonlyMap<string, DocumentTab> {
    if (formerNames.size === 0)
      return new Map();
    const tabs = new LayoutReader().readLayout(JsonReader.fromValue(value)).groups.flatMap(t => t.tabs);
    const keys = new Set(tabs.map(t => t.key));
    const moves = new Map<string, DocumentTab>();
    for (const tab of tabs.filter(t => t instanceof DocumentTab)) {
      const name = formerNames.get(tab.name);
      const moved = Object.isUndefined(name) ? null : new DocumentTab(name, tab.instance);
      if (Object.isNull(moved) || keys.has(moved.key))
        continue;
      keys.add(moved.key);
      moves.set(tab.key, moved);
    }
    return moves;
  }

  private static readViewToolbars(json: JsonReader): ReadonlyMap<string, ToolbarLayout> {
    const bands = new Map<string, ToolbarLayout>();
    for (const band of Object.keys(json.toJson()))
      bands.set(band, LayoutReader.construct(json, () => {
        QualifiedName.parse(band, Resources.nameParameter);
        return ToolbarLayout.fromJson(json.readObject(band));
      }));
    return bands;
  }

  private static construct<T>(json: JsonReader, create: () => T): T {
    try {
      return create();
    }
    catch (error) {
      throw new JsonException(Resources.invalidLayoutPart, json.path, new ExceptionOptions(error));
    }
  }

  private readLayout(json: JsonReader): Layout {
    const version = json.readInteger(Resources.versionField);
    if (version !== Resources.layoutFormatVersion)
      throw new JsonException(Resources.formatUnsupportedVersion(version), json.path);
    const docks = json.readObject(Resources.docksField);
    const read = Object.values(DockSide).map(t => this.readDock(t, docks.readObject(t)));
    const middle = this.readNode(json.readObject(Resources.middleField));
    const documents = middle.groups.filter(t => t.isDocuments);
    const index = json.hasField(Resources.activeDocumentsField) ? json.readInteger(Resources.activeDocumentsField) : 0;
    const span = json.hasField(Resources.bottomSpanField) ? json.readOneOf(Resources.bottomSpanField, Object.values(BottomDockSpan)) : BottomDockSpan.Full;
    const toolbars = json.hasField(Resources.toolbarsField) ? LayoutReader.construct(json, () => ToolbarLayout.fromJson(json.readObject(Resources.toolbarsField))) : ToolbarLayout.EMPTY;
    const middleSize = json.hasField(Resources.middleSizeField) ? json.readNumber(Resources.middleSizeField) : null;
    const viewToolbars = json.hasField(Resources.viewToolbarsField) ? LayoutReader.readViewToolbars(json.readObject(Resources.viewToolbarsField)) : new Map<string, ToolbarLayout>();
    return LayoutReader.construct(json, () => new Layout(read, middle, span, toolbars, documents[index]?.id, middleSize, viewToolbars));
  }

  private readDock(side: DockSide, json: JsonReader): Dock {
    const root = json.readNullableObject(Resources.rootField);
    const node = Object.isNull(root) ? null : this.readNode(root);
    const size = Object.isNull(json.readValue(Resources.sizeField)) ? null : json.readNumber(Resources.sizeField);
    const collapsed = json.readBoolean(Resources.collapsedField);
    return LayoutReader.construct(json, () => new Dock(side, node, size, collapsed));
  }

  private readNode(json: JsonReader): LayoutNode {
    if (json.hasField(Resources.childrenField))
      return this.readSplit(json);
    if (json.hasField(Resources.tabsField))
      return this.readGroup(json);
    throw new JsonException(Resources.unknownNode, json.path);
  }

  private readSplit(json: JsonReader): LayoutNode {
    const id = this.nextId++;
    const axis = json.readOneOf(Resources.axisField, Object.values(SplitAxis));
    const parts = json.readObjectArray(Resources.childrenField).map(t => new SplitPart(this.readNode(t), t.readNumber(Resources.weightField)));
    return LayoutReader.construct(json, () => new SplitNode(id, axis, parts));
  }

  private readGroup(json: JsonReader): TabGroup {
    const tabs = json.readObjectArray(Resources.tabsField).map(t => this.readTab(t));
    const index = json.readNullableInteger(Resources.activeField);
    const active = Object.isNull(index) ? null : tabs[index];
    if (Object.isUndefined(active))
      throw new JsonException(Resources.inactiveTab, json.path);
    const previewIndex = json.hasField(Resources.previewField) ? json.readNullableInteger(Resources.previewField) : null;
    const preview = Object.isNull(previewIndex) ? null : tabs[previewIndex];
    if (Object.isUndefined(preview))
      throw new JsonException(Resources.previewOutsideGroup, json.path);
    const isDocuments = json.hasField(Resources.documentsField) && json.readBoolean(Resources.documentsField);
    if (isDocuments) {
      const documentsId = this.hasDocuments ? this.nextId++ : Resources.documentsGroupId;
      this.hasDocuments = true;
      return LayoutReader.construct(json, () => new DocumentGroup(tabs, active, preview, documentsId));
    }
    const id = this.nextId++;
    return LayoutReader.construct(json, () => new TabGroup(id, tabs, active, preview));
  }

  private readTab(json: JsonReader): Tab {
    const instance = json.readOptionalString(Resources.instanceField);
    if (json.hasField(Resources.viewField)) {
      const name = json.readString(Resources.viewField);
      return LayoutReader.construct(json, () => new ViewTab(name, instance));
    }
    if (json.hasField(Resources.documentField)) {
      const name = json.readString(Resources.documentField);
      const tab = LayoutReader.construct(json, () => new DocumentTab(name, instance));
      return this.moves.get(tab.key) ?? tab;
    }
    throw new JsonException(Resources.unknownTab, json.path);
  }
}

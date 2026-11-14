/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ErrorHandler, type Signal, type WritableSignal, computed, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/context.json";
import { CommandRun, Notification, NotificationAction, NotificationPost, NotificationSeverity, NotificationState, QualifiedName } from "@noldova/desktop.protocol";

import { NotificationsComponent } from "../../src/app/components/notifications/notifications.component";
import { NotificationService } from "../../src/app/services/notification.service";
import { PreloadBridgeFixture } from "./preload-bridge.fixture";
import { ModuleStatusFixture } from "./module-status.fixture";
import { DomFixture } from "./dom.fixture";

export class NotificationsFixture {
  public readonly calls: string[] = [];
  public readonly errors: unknown[] = [];
  public readonly stateValue: WritableSignal<NotificationState> = signal(new NotificationState([], false, [], 0));
  public readonly state: Signal<NotificationState> = this.stateValue.asReadonly();
  public readonly unreadCount: Signal<number> = computed(() => this.stateValue().notifications.filter(t => !t.isRead).length);
  public failure: Error | null = null;

  public static install(): NotificationsFixture {
    const service = new NotificationsFixture();
    PreloadBridgeFixture.install();
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationService, useValue: service },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => service.errors.push(error) } }
      ]
    });
    ModuleStatusFixture.report(ModuleStatusFixture.create("notes", "Notes"));
    return service;
  }

  public static remove(): void {
    PreloadBridgeFixture.remove();
  }

  public static createNotification(
    id: number,
    kind: string,
    title: string,
    options: Partial<{ text: string; severity: NotificationSeverity; open: string; actions: readonly string[]; progress: number | typeof NotificationPost.indeterminate; isRead: boolean }> = {}): Notification {
    return new Notification(String(id), id, new NotificationPost(
      QualifiedName.parse(kind), null, title, options.text ?? null, options.severity ?? NotificationSeverity.Info,
      Object.isUndefined(options.open) ? null : NotificationsFixture.createRun(options.open), (options.actions ?? []).map(t => new NotificationAction(`Run ${t}`, NotificationsFixture.createRun(t))),
      options.progress ?? null), "2026-10-03T08:05:00.000Z", options.isRead ?? false);
  }

  public static async renderAsync(): Promise<ComponentFixture<NotificationsComponent>> {
    const fixture = TestBed.createComponent(NotificationsComponent);
    await fixture.whenStable();
    return fixture;
  }

  public static findItem(fixture: ComponentFixture<NotificationsComponent>): HTMLButtonElement {
    return DomFixture.oneOf(DomFixture.host(fixture), "button.nol-notifications-item", HTMLButtonElement);
  }

  public static findPopover(): HTMLElement | null {
    return document.querySelector(".nol-notifications-popover");
  }

  public static async openAsync(fixture: ComponentFixture<NotificationsComponent>): Promise<HTMLElement> {
    NotificationsFixture.findItem(fixture).click();
    await fixture.whenStable();
    return DomFixture.present(NotificationsFixture.findPopover());
  }

  public isAvailable(command: CommandRun): boolean {
    return command.name.text !== "clock.reset";
  }

  public runAsync(command: CommandRun): Promise<JsonValue> {
    this.calls.push(`run ${command.name.text}`);
    return Object.isNull(this.failure) ? Promise.resolve(null) : Promise.reject(this.failure);
  }

  public markAllRead(): void {
    this.calls.push("read");
  }

  public clear(): void {
    this.calls.push("clear");
  }

  public dismiss(id: string): void {
    this.calls.push(`dismiss ${id}`);
  }

  public setDoNotDisturb(isOn: boolean): void {
    this.calls.push(`quiet ${String(isOn)}`);
  }

  private static createRun(name: string): CommandRun {
    return new CommandRun(QualifiedName.parse(name), null);
  }
}

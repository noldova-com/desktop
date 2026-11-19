/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, readdir, readlink, realpath, rename } from "node:fs/promises";
import { devNull, homedir, tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { isatty } from "node:tty";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { BrowserWindow, Menu, Notification, Tray, app, autoUpdater, clipboard, ClipboardItem, dialog, globalShortcut, ipcMain, nativeImage, nativeTheme, protocol, safeStorage, screen, session, shell, utilityProcess } from "electron";
import { AppImageUpdater, DebUpdater, MacUpdater, NsisUpdater } from "electron-updater";

import "@noldova/context.core";
import {
  AppImageSource, ChildProcessStarter, FolderProtectorFactory, type Installation, ModuleDeclarationReader, ProcessPresence, ProductInfo, RuntimeBuild, RuntimeEntry, RuntimeLauncher, SystemCommand,
  WindowsProcessApi
} from "@noldova/desktop.runtime";

import type { IUpdateHandoff } from "./interfaces/i-update-handoff.js";
import type { IUpdater } from "./interfaces/i-updater.js";
import { FeedSource } from "./models/feed-source.js";
import { Resources } from "./resources.js";
import { AppImageHandoff } from "./services/app-image-handoff.js";
import { AppImageReplacement } from "./services/app-image-replacement.js";
import { ChildProgramHost } from "./services/child-program-host.js";
import { CommandLineRelay } from "./services/command-line-relay.js";
import { DebianHandoff } from "./services/debian-handoff.js";
import { DebianPackage } from "./services/debian-package.js";
import { DailyCheckMark } from "./services/daily-check-mark.js";
import { DeviceFileStore } from "./services/device-file-store.js";
import { DeviceIdentity } from "./services/device-identity.js";
import { ElectronWebViewEngine } from "./services/electron-web-view-engine.js";
import { FeedRequestGuard } from "./services/feed-request-guard.js";
import { FeedSession } from "./services/feed-session.js";
import { FeedUpdater } from "./services/feed-updater.js";
import { InstallerHandoff } from "./services/installer-handoff.js";
import { InstallerStart } from "./services/installer-start.js";
import { MainProcessRecord } from "./services/main-process-record.js";
import { MainProcess } from "./services/main-process.js";
import { PathCommand } from "./services/path-command.js";
import { ProductAppAdapter } from "./services/product-app-adapter.js";
import { PublisherCheck } from "./services/publisher-check.js";
import { ShipItProcess } from "./services/ship-it-process.js";
import { SquirrelHandoff } from "./services/squirrel-handoff.js";
import { UpdateCheckLock } from "./services/update-check-lock.js";
import { UtilityProcessStarter } from "./services/utility-process-starter.js";

const starter = process.platform === Resources.windowsPlatform ? new UtilityProcessStarter(utilityProcess, process.env) : new ChildProcessStarter();
const programs = new ChildProgramHost(process.platform, Resources.programTimeout);
const presence = ProcessPresence.create(process.platform);
const isDebianPackage = DebianPackage.isInstalled(process.platform, process.execPath);

function createHandoff(installation: Installation, updater: IUpdater, verifyAsync: (installer: string) => Promise<string | null>, logsFolder: string, log: (text: string) => void): IUpdateHandoff {
  if (process.platform === Resources.windowsPlatform) {
    const start = new InstallerStart(starter, verifyAsync, process.env, join(logsFolder, Resources.installerErrorFile));
    const protector = FolderProtectorFactory.create(process.platform, new SystemCommand(), process.env);
    return new InstallerHandoff(installation.folder, t => protector.protectAsync(t), WindowsProcessApi.create(), t => start.startAsync(t), log);
  }
  if (process.platform === Resources.macPlatform)
    return new SquirrelHandoff(updater, autoUpdater, new ShipItProcess(ProductInfo.current.applicationId, new SystemCommand()), (wait, run) => {
      const timer = setTimeout(run, wait);
      return () => clearTimeout(timer);
    }, log);
  if (isDebianPackage)
    return new DebianHandoff(existsSync(Resources.debianInstallerProgram) ? Resources.debianInstallerProgram : null, async (program, args) => {
      await promisify(execFile)(program, [...args]);
    });
  const image = AppImageSource.find(process.env, process.execPath);
  return new AppImageHandoff(Object.isNull(image) ? null : new AppImageReplacement(image.file, log));
}

const commandLine = CommandLineRelay.readArguments(process.argv);
if (!Object.isNull(commandLine))
  process.exit(new CommandLineRelay((program, args, options) => spawnSync(program, [...args], options), process.execPath,
    join(dirname(fileURLToPath(import.meta.url)), ...Resources.repositoryRootSegments, ...Resources.desktopToolsEntrySegments), process.env, process.stderr).relay(commandLine));
else
  await MainProcess.startAsync(
    {
      app,
      ipcMain,
      session,
      protocol,
      screen,
      menu: Menu,
      clipboard: {
        writeText: t => clipboard.writeText(t),
        writeImageAsync: async t => {
          if (nativeImage.createFromBuffer(Buffer.from(t.buffer, t.byteOffset, t.byteLength)).isEmpty())
            return false;
          await clipboard.write([new ClipboardItem({ [Resources.pngMimeType]: new Blob([new Uint8Array(t)], { type: Resources.pngMimeType }) })]);
          return true;
        }
      },
      shell,
      dialog: {
        showMessageBox: (windowId, options) => {
          const window = Object.isNull(windowId) ? null : BrowserWindow.fromId(windowId);
          return Object.isNull(window) ? dialog.showMessageBox(options) : dialog.showMessageBox(window, options);
        },
        showOpenDialog: (windowId, options) => {
          const window = BrowserWindow.fromId(windowId);
          return Object.isNull(window) ? Promise.resolve({ canceled: true, filePaths: [] }) : dialog.showOpenDialog(window, options);
        },
        showSaveDialog: (windowId, options) => {
          const window = BrowserWindow.fromId(windowId);
          return Object.isNull(window) ? Promise.resolve({ canceled: true, filePath: String.empty }) : dialog.showSaveDialog(window, options);
        }
      },
      notifications: { isSupported: () => Notification.isSupported(), create: t => new Notification(t) },
      theme: nativeTheme,
      tray: { create: t => new Tray(t) },
      shortcuts: globalShortcut,
      nativeUpdater: autoUpdater,
      webViews: new ElectronWebViewEngine(),
      safeStorage,
      createWindow: t => new BrowserWindow(t)
    },
    {
      argv: process.argv,
      env: process.env,
      platform: process.platform,
      execPath: process.execPath,
      homeFolder: homedir(),
      temporaryFolder: tmpdir(),
      workingDirectory: process.cwd(),
      isDefaultApp: process.defaultApp === true,
      errorOutput: process.stderr,
      processId: process.pid,
      programs,
      files: { lstat, readlink, realpath, rename, readdir },
      presence,
      isTerminal: Resources.standardDescriptors.some(t => isatty(t)),
      startDetached: (path, args, onFailure) => programs.startDetached(path, args, process.env, onFailure),
      startDetachedAsync: (path, args, environment, folder) => programs.startDetachedAsync(path, args, environment, folder),
      startApartAsync: async (path, args, environment) => {
        await new UtilityProcessStarter(utilityProcess, process.env, process.cwd()).startAsync(path, args, environment, devNull);
      },
      endProcess: t => process.kill(t, Resources.killSignal),
      probeProcess: t => process.kill(t, Resources.probeSignal),
      onUncaughtException: t => process.on(Resources.uncaughtExceptionEvent, t),
      onUnhandledRejection: t => process.on(Resources.unhandledRejectionEvent, t),
      readAccountHomeFolder: () => userInfo().homedir,
      readWebViewsAsync: async () => new Map((await ModuleDeclarationReader.readAsync(ModuleDeclarationReader.locate(RuntimeEntry.entryPath)))
        .flatMap(t => Object.isNull(t.webViews) ? [] : [[t.id, t.webViews] as const]))
    },
    import.meta.url,
    (settings, installation, log) => new RuntimeLauncher(settings, RuntimeBuild.identity, installation, log, starter),
    t => DeviceIdentity.readOrCreateAsync(t),
    (folder, fileName) => new DeviceFileStore(folder, fileName),
    t => PathCommand.forBundle(t, async (program, args) => {
      await promisify(execFile)(program, [...args]);
    }),
    t => MainProcessRecord.recordAsync(t, presence, process.pid),
    (installation, _isPackaged, logsFolder, log) => {
      const product = ProductInfo.current;
      const address = product.updateFeed;
      if (Object.isNull(address))
        return null;
      const guard = new FeedRequestGuard(address, [product.slug, product.version, process.platform, process.arch],
        new DailyCheckMark(join(installation.folder, Resources.dailyCheckFile), () => new Date(), log), log);
      const feedSession = new FeedSession(() => {
        const created = ProductAppAdapter.readNetSession();
        return {
          webRequest: {
            onBeforeRequest: t => created.webRequest.onBeforeRequest((details, callback) => t(details, callback)),
            onBeforeSendHeaders: t => created.webRequest.onBeforeSendHeaders((details, callback) => t(details, callback)),
            onResponseStarted: t => created.webRequest.onResponseStarted(details => t(details)),
            onErrorOccurred: t => created.webRequest.onErrorOccurred(details => t(details))
          },
          fetch: (url, init) => created.fetch(url, init)
        };
      }, guard);
      const source = FeedSource.create(address, product.name, process.platform, process.arch, (url, signal) => feedSession.fetchAsync(url, signal), isDebianPackage);
      if (Object.isNull(source))
        return null;
      const updater = process.platform === Resources.windowsPlatform ? new NsisUpdater()
        : process.platform === Resources.macPlatform ? new MacUpdater() : isDebianPackage ? new DebUpdater() : new AppImageUpdater();
      const check = new PublisherCheck(product.windowsPublisher, WindowsProcessApi.create(), log, Date.now);
      const feed = new FeedUpdater(updater, source, installation.folder, ProductAppAdapter.cacheFolder, product.slug, updater instanceof NsisUpdater ? t => check.checkAsync(t) : null, log);
      return { updater: feed, handoff: createHandoff(installation, feed, t => check.checkAsync(t), logsFolder, log) };
    },
    (installation, log) => new UpdateCheckLock(installation.folder, async () => (await presence.stampAsync([[process.pid, Resources.clientName]]))[0] ?? null, t => presence.isRunningAsync(t), log));

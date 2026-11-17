"use strict";

const { appendFileSync } = require("node:fs");
const childProcess = require("node:child_process");
const { syncBuiltinESMExports } = require("node:module");

const log = process.env["DESKTOP_STARTUP_LOG"];
if (log !== undefined && process.type === "browser") {
  const mark = (name, detail) => appendFileSync(log, `${JSON.stringify({ at: Date.now(), name, ...detail })}\n`);
  mark("main.preload", { origin: performance.timeOrigin });

  const realSpawn = childProcess.spawn;
  childProcess.spawn = function (command, args, ...rest) {
    if (Array.isArray(args) && args.some(t => typeof t === "string" && t.includes("runtime-entry")))
      mark("runtime.spawn");
    return realSpawn.call(this, command, args, ...rest);
  };
  syncBuiltinESMExports();

  const electron = require("electron");
  const realFork = electron.utilityProcess.fork.bind(electron.utilityProcess);
  electron.utilityProcess.fork = (modulePath, ...rest) => {
    mark("utility.fork", { modulePath: String(modulePath) });
    const child = realFork(modulePath, ...rest);
    const realPost = child.postMessage.bind(child);
    child.postMessage = (message, ...more) => {
      if (JSON.stringify(message ?? null).includes("runtime-entry"))
        mark("runtime.fork");
      return realPost(message, ...more);
    };
    return child;
  };

  electron.app.once("ready", () => mark("app.ready"));
  electron.app.on("browser-window-created", (_event, window) => {
    mark("window.created");
    window.once("show", () => mark("window.show"));
    window.webContents.once("did-finish-load", () => mark("contents.did-finish-load"));
  });
}

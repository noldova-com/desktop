/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MainPackageConfigurationsFixture {
  public static readonly configurations: Readonly<Record<string, unknown>> = {
    "windows-x64": {
      "appId": "com.example.sample",
      "productName": "Sample App",
      "copyright": "Copyright (c) Sample",
      "directories": {
        "app": "<cwd>/sample-app/stage",
        "output": "<cwd>/sample-app/out"
      },
      "electronDist": "<cwd>/sample-app/electron",
      "electronVersion": "44.5.1",
      "asar": {
        "smartUnpack": false
      },
      "asarUnpack": [
        "**/*.node",
        "node_modules/x/build/Release/x.node"
      ],
      "npmRebuild": false,
      "nodeGypRebuild": false,
      "buildDependenciesFromSource": false,
      "electronFuses": {
        "runAsNode": true,
        "enableCookieEncryption": false,
        "enableNodeOptionsEnvironmentVariable": false,
        "enableNodeCliInspectArguments": false,
        "enableEmbeddedAsarIntegrityValidation": true,
        "onlyLoadAppFromAsar": true,
        "loadBrowserProcessSpecificV8Snapshot": false,
        "grantFileProtocolExtraPrivileges": true
      },
      "extraResources": [
        {
          "from": "<cwd>/sample-app/LICENSE",
          "to": "licenses/LICENSE"
        },
        {
          "from": "<cwd>/node_modules/@noldova/desktop.build/assets/licenses/fonts",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/assets/dictionaries",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/stage/_build/window/3rdpartylicenses.txt",
          "to": "licenses/window-third-party.txt"
        },
        {
          "from": "<cwd>/sample-app/_build/package/runtime-third-party.txt",
          "to": "licenses/runtime-third-party.txt"
        }
      ],
      "publish": null,
      "win": {
        "target": [
          {
            "target": "nsis",
            "arch": [
              "x64"
            ]
          }
        ],
        "icon": "<cwd>/sample-app/assets/icons/icon-dark.ico",
        "artifactName": "Sample App-1.2.3-windows-x64.${ext}",
        "extraFiles": [
          {
            "from": "<cwd>/sample-app/_build/package/command/sample-app.cmd",
            "to": "bin/sample-app.cmd"
          }
        ]
      },
      "nsis": {
        "oneClick": true,
        "perMachine": false,
        "packElevateHelper": false,
        "deleteAppDataOnUninstall": false,
        "shortcutName": "Sample App",
        "uninstallDisplayName": "Sample App",
        "artifactName": "Sample App-1.2.3-windows-x64.${ext}",
        "include": "<cwd>/node_modules/@noldova/desktop.build/assets/installer/installer.nsh"
      }
    },
    "windows-arm64": {
      "appId": "com.example.sample",
      "productName": "Sample App",
      "copyright": "Copyright (c) Sample",
      "directories": {
        "app": "<cwd>/sample-app/stage",
        "output": "<cwd>/sample-app/out"
      },
      "electronDist": "<cwd>/sample-app/electron",
      "electronVersion": "44.5.1",
      "asar": {
        "smartUnpack": false
      },
      "asarUnpack": [
        "**/*.node",
        "node_modules/x/build/Release/x.node"
      ],
      "npmRebuild": false,
      "nodeGypRebuild": false,
      "buildDependenciesFromSource": false,
      "electronFuses": {
        "runAsNode": true,
        "enableCookieEncryption": true,
        "enableNodeOptionsEnvironmentVariable": false,
        "enableNodeCliInspectArguments": false,
        "enableEmbeddedAsarIntegrityValidation": true,
        "onlyLoadAppFromAsar": true,
        "loadBrowserProcessSpecificV8Snapshot": false,
        "grantFileProtocolExtraPrivileges": true
      },
      "extraResources": [
        {
          "from": "<cwd>/sample-app/LICENSE",
          "to": "licenses/LICENSE"
        },
        {
          "from": "<cwd>/node_modules/@noldova/desktop.build/assets/licenses/fonts",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/assets/dictionaries",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/stage/_build/window/3rdpartylicenses.txt",
          "to": "licenses/window-third-party.txt"
        },
        {
          "from": "<cwd>/sample-app/_build/package/runtime-third-party.txt",
          "to": "licenses/runtime-third-party.txt"
        }
      ],
      "publish": null,
      "forceCodeSigning": true,
      "win": {
        "target": [
          {
            "target": "nsis",
            "arch": [
              "arm64"
            ]
          }
        ],
        "icon": "<cwd>/sample-app/assets/icons/icon-dark.ico",
        "artifactName": "Sample App-1.2.3-windows-arm64.${ext}",
        "extraFiles": [
          {
            "from": "<cwd>/sample-app/_build/package/command/sample-app.cmd",
            "to": "bin/sample-app.cmd"
          }
        ],
        "signtoolOptions": {
          "sign": "<cwd>/node_modules/@noldova/desktop.build/services/packaging/windows-sign-hook.js",
          "signingHashAlgorithms": [
            "sha256"
          ],
          "publisherName": "CN=Sample"
        },
        "signExts": [
          ".node",
          ".Node",
          ".nOde",
          ".NOde",
          ".noDe",
          ".NoDe",
          ".nODe",
          ".NODe",
          ".nodE",
          ".NodE",
          ".nOdE",
          ".NOdE",
          ".noDE",
          ".NoDE",
          ".nODE",
          ".NODE",
          ".dll",
          ".Dll",
          ".dLl",
          ".DLl",
          ".dlL",
          ".DlL",
          ".dLL",
          ".DLL",
          ".exe",
          ".Exe",
          ".eXe",
          ".EXe",
          ".exE",
          ".ExE",
          ".eXE",
          ".EXE"
        ]
      },
      "nsis": {
        "oneClick": true,
        "perMachine": false,
        "packElevateHelper": false,
        "deleteAppDataOnUninstall": false,
        "shortcutName": "Sample App",
        "uninstallDisplayName": "Sample App",
        "artifactName": "Sample App-1.2.3-windows-arm64.${ext}",
        "include": "<cwd>/node_modules/@noldova/desktop.build/assets/installer/installer.nsh"
      }
    },
    "macos-arm64": {
      "appId": "com.example.sample",
      "productName": "Sample App",
      "copyright": "Copyright (c) Sample",
      "directories": {
        "app": "<cwd>/sample-app/stage",
        "output": "<cwd>/sample-app/out"
      },
      "electronDist": "<cwd>/sample-app/electron",
      "electronVersion": "44.5.1",
      "asar": {
        "smartUnpack": false
      },
      "asarUnpack": [
        "**/*.node",
        "node_modules/x/build/Release/x.node"
      ],
      "npmRebuild": false,
      "nodeGypRebuild": false,
      "buildDependenciesFromSource": false,
      "electronFuses": {
        "runAsNode": true,
        "enableCookieEncryption": false,
        "enableNodeOptionsEnvironmentVariable": false,
        "enableNodeCliInspectArguments": false,
        "enableEmbeddedAsarIntegrityValidation": true,
        "onlyLoadAppFromAsar": true,
        "loadBrowserProcessSpecificV8Snapshot": false,
        "grantFileProtocolExtraPrivileges": true
      },
      "extraResources": [
        {
          "from": "<cwd>/sample-app/LICENSE",
          "to": "licenses/LICENSE"
        },
        {
          "from": "<cwd>/node_modules/@noldova/desktop.build/assets/licenses/fonts",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/assets/dictionaries",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/stage/_build/window/3rdpartylicenses.txt",
          "to": "licenses/window-third-party.txt"
        },
        {
          "from": "<cwd>/sample-app/_build/package/runtime-third-party.txt",
          "to": "licenses/runtime-third-party.txt"
        }
      ],
      "publish": null,
      "forceCodeSigning": true,
      "mac": {
        "target": [
          {
            "target": "dmg",
            "arch": [
              "arm64"
            ]
          },
          {
            "target": "zip",
            "arch": [
              "arm64"
            ]
          }
        ],
        "icon": "<cwd>/sample-app/assets/icons/icon-dock-512.png",
        "category": "public.app-category.developer-tools",
        "artifactName": "Sample App-1.2.3-macos-arm64.${ext}",
        "extraResources": [
          {
            "from": "<cwd>/sample-app/_build/package/command/sample-app",
            "to": "bin/sample-app"
          }
        ],
        "hardenedRuntime": true,
        "entitlements": "<cwd>/node_modules/@noldova/desktop.build/assets/macos/entitlements.plist",
        "entitlementsInherit": "<cwd>/node_modules/@noldova/desktop.build/assets/macos/entitlements.plist",
        "notarize": true
      },
      "dmg": {
        "sign": true
      }
    },
    "macos-x64": {
      "appId": "com.example.sample",
      "productName": "Sample App",
      "copyright": "Copyright (c) Sample",
      "directories": {
        "app": "<cwd>/sample-app/stage",
        "output": "<cwd>/sample-app/out"
      },
      "electronDist": "<cwd>/sample-app/electron",
      "electronVersion": "44.5.1",
      "asar": {
        "smartUnpack": false
      },
      "asarUnpack": [
        "**/*.node",
        "node_modules/x/build/Release/x.node"
      ],
      "npmRebuild": false,
      "nodeGypRebuild": false,
      "buildDependenciesFromSource": false,
      "electronFuses": {
        "runAsNode": true,
        "enableCookieEncryption": true,
        "enableNodeOptionsEnvironmentVariable": false,
        "enableNodeCliInspectArguments": false,
        "enableEmbeddedAsarIntegrityValidation": true,
        "onlyLoadAppFromAsar": true,
        "loadBrowserProcessSpecificV8Snapshot": false,
        "grantFileProtocolExtraPrivileges": true,
        "resetAdHocDarwinSignature": true
      },
      "extraResources": [
        {
          "from": "<cwd>/sample-app/LICENSE",
          "to": "licenses/LICENSE"
        },
        {
          "from": "<cwd>/node_modules/@noldova/desktop.build/assets/licenses/fonts",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/assets/dictionaries",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/stage/_build/window/3rdpartylicenses.txt",
          "to": "licenses/window-third-party.txt"
        },
        {
          "from": "<cwd>/sample-app/_build/package/runtime-third-party.txt",
          "to": "licenses/runtime-third-party.txt"
        }
      ],
      "publish": null,
      "mac": {
        "target": [
          {
            "target": "dmg",
            "arch": [
              "x64"
            ]
          },
          {
            "target": "zip",
            "arch": [
              "x64"
            ]
          }
        ],
        "icon": "<cwd>/sample-app/assets/icons/icon-dock-512.png",
        "category": "public.app-category.developer-tools",
        "artifactName": "Sample App-1.2.3-macos-x64.${ext}",
        "extraResources": [
          {
            "from": "<cwd>/sample-app/_build/package/command/sample-app",
            "to": "bin/sample-app"
          }
        ]
      }
    },
    "linux-x64": {
      "appId": "com.example.sample",
      "productName": "Sample App",
      "copyright": "Copyright (c) Sample",
      "directories": {
        "app": "<cwd>/sample-app/stage",
        "output": "<cwd>/sample-app/out"
      },
      "electronDist": "<cwd>/sample-app/electron",
      "electronVersion": "44.5.1",
      "asar": {
        "smartUnpack": false
      },
      "asarUnpack": [
        "**/*.node",
        "node_modules/x/build/Release/x.node"
      ],
      "npmRebuild": false,
      "nodeGypRebuild": false,
      "buildDependenciesFromSource": false,
      "electronFuses": {
        "runAsNode": true,
        "enableCookieEncryption": false,
        "enableNodeOptionsEnvironmentVariable": false,
        "enableNodeCliInspectArguments": false,
        "enableEmbeddedAsarIntegrityValidation": true,
        "onlyLoadAppFromAsar": true,
        "loadBrowserProcessSpecificV8Snapshot": false,
        "grantFileProtocolExtraPrivileges": true
      },
      "extraResources": [
        {
          "from": "<cwd>/sample-app/LICENSE",
          "to": "licenses/LICENSE"
        },
        {
          "from": "<cwd>/node_modules/@noldova/desktop.build/assets/licenses/fonts",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/assets/dictionaries",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/stage/_build/window/3rdpartylicenses.txt",
          "to": "licenses/window-third-party.txt"
        },
        {
          "from": "<cwd>/sample-app/_build/package/runtime-third-party.txt",
          "to": "licenses/runtime-third-party.txt"
        }
      ],
      "publish": null,
      "toolsets": {
        "appimage": "1.0.3"
      },
      "extraMetadata": {
        "homepage": "https://github.com/example/sample-app"
      },
      "deb": {
        "maintainer": "Sample",
        "afterInstall": "<cwd>/sample-app/_build/package/debian-templates/after-install.tpl",
        "afterRemove": "<cwd>/sample-app/_build/package/debian-templates/after-remove.tpl",
        "appArmorProfile": "<cwd>/sample-app/_build/package/debian-templates/apparmor-profile.tpl"
      },
      "linux": {
        "target": [
          {
            "target": "AppImage",
            "arch": [
              "x64"
            ]
          },
          {
            "target": "deb",
            "arch": [
              "x64"
            ]
          }
        ],
        "icon": "<cwd>/sample-app/assets/icons/icon-dark-512.png",
        "executableName": "sample-app",
        "extraResources": [
          {
            "from": "<cwd>/sample-app/_build/package/command/sample-app",
            "to": "bin/sample-app"
          },
          {
            "from": "<cwd>/sample-app/_build/package/command/linux-update-install",
            "to": "linux-update-install"
          }
        ],
        "syncDesktopName": true,
        "category": "Development",
        "artifactName": "Sample App-1.2.3-linux-x64.${ext}",
        "desktop": {
          "entry": {
            "Name": "Sample App",
            "StartupWMClass": "com.example.sample"
          }
        }
      }
    },
    "linux-arm64": {
      "appId": "com.example.sample",
      "productName": "Sample App",
      "copyright": "Copyright (c) Sample",
      "directories": {
        "app": "<cwd>/sample-app/stage",
        "output": "<cwd>/sample-app/out"
      },
      "electronDist": "<cwd>/sample-app/electron",
      "electronVersion": "44.5.1",
      "asar": {
        "smartUnpack": false
      },
      "asarUnpack": [
        "**/*.node",
        "node_modules/x/build/Release/x.node"
      ],
      "npmRebuild": false,
      "nodeGypRebuild": false,
      "buildDependenciesFromSource": false,
      "electronFuses": {
        "runAsNode": true,
        "enableCookieEncryption": true,
        "enableNodeOptionsEnvironmentVariable": false,
        "enableNodeCliInspectArguments": false,
        "enableEmbeddedAsarIntegrityValidation": true,
        "onlyLoadAppFromAsar": true,
        "loadBrowserProcessSpecificV8Snapshot": false,
        "grantFileProtocolExtraPrivileges": true
      },
      "extraResources": [
        {
          "from": "<cwd>/sample-app/LICENSE",
          "to": "licenses/LICENSE"
        },
        {
          "from": "<cwd>/node_modules/@noldova/desktop.build/assets/licenses/fonts",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/assets/dictionaries",
          "to": "licenses",
          "filter": [
            "*.txt"
          ]
        },
        {
          "from": "<cwd>/sample-app/stage/_build/window/3rdpartylicenses.txt",
          "to": "licenses/window-third-party.txt"
        },
        {
          "from": "<cwd>/sample-app/_build/package/runtime-third-party.txt",
          "to": "licenses/runtime-third-party.txt"
        }
      ],
      "publish": null,
      "toolsets": {
        "appimage": "1.0.3"
      },
      "extraMetadata": {
        "homepage": "https://github.com/example/sample-app"
      },
      "deb": {
        "maintainer": "Sample",
        "afterInstall": "<cwd>/sample-app/_build/package/debian-templates/after-install.tpl",
        "afterRemove": "<cwd>/sample-app/_build/package/debian-templates/after-remove.tpl",
        "appArmorProfile": "<cwd>/sample-app/_build/package/debian-templates/apparmor-profile.tpl"
      },
      "linux": {
        "target": [
          {
            "target": "AppImage",
            "arch": [
              "arm64"
            ]
          },
          {
            "target": "deb",
            "arch": [
              "arm64"
            ]
          }
        ],
        "icon": "<cwd>/sample-app/assets/icons/icon-dark-512.png",
        "executableName": "sample-app",
        "extraResources": [
          {
            "from": "<cwd>/sample-app/_build/package/command/sample-app",
            "to": "bin/sample-app"
          },
          {
            "from": "<cwd>/sample-app/_build/package/command/linux-update-install",
            "to": "linux-update-install"
          }
        ],
        "syncDesktopName": true,
        "category": "Development",
        "artifactName": "Sample App-1.2.3-linux-arm64.${ext}",
        "desktop": {
          "entry": {
            "Name": "Sample App",
            "StartupWMClass": "com.example.sample"
          }
        }
      }
    }
  };
}

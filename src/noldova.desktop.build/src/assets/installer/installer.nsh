/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "WordFunc.nsh"

!if ${NSIS_MAX_STRLEN} < 8192
  !error "The command folder's Path entry needs NSIS strings of at least 8192 characters."
!endif

!define /math COMMAND_PATH_LIMIT ${NSIS_MAX_STRLEN} - 1
!define COMMAND_FOLDER "$INSTDIR\bin"
!define REMOVE_ATTEMPTS 60
!define REMOVE_PAUSE 500
!define SNAPSHOT_PROCESSES 2
!define INVALID_HANDLE -1
!define PROCESS_QUERY_LIMITED 0x1000
!define PROCESS_END 0x100001
!define FILE_WRITE 0x40000000
!define FILE_SHARE_ALL 7
!define FILE_OPEN_EXISTING 3
!define SHARING_VIOLATION 32
!define APP_END_WAIT 2000
!define APP_CLOSE_ATTEMPTS 3
!define APP_CLOSE_PAUSE 2000

!macro announceEnvironment
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro listLeftovers RESULT
  StrCpy ${RESULT} ""
  ClearErrors
  FindFirst $R3 $R4 "$INSTDIR\*.*"
  ${DoUntil} $R4 == ""
    ${If} $R4 != "."
    ${AndIf} $R4 != ".."
    ${AndIf} $R4 != "${UNINSTALL_FILENAME}"
      StrCpy ${RESULT} "${RESULT}, $R4"
    ${EndIf}
    FindNext $R3 $R4
  ${Loop}
  FindClose $R3
  StrCpy ${RESULT} ${RESULT} "" 2
!macroend

!macro removeProgramFiles
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  SetOutPath $TEMP
  StrCpy $R0 0
  ${Do}
    RMDir /r $INSTDIR
    !insertmacro listLeftovers $R1
    ${If} $R1 == ""
    ${OrIf} $R0 >= ${REMOVE_ATTEMPTS}
      ${ExitDo}
    ${EndIf}
    Sleep ${REMOVE_PAUSE}
    IntOp $R0 $R0 + 1
  ${Loop}
  ${If} $R1 != ""
    DetailPrint "Other programs still use $R1 in $INSTDIR, so the uninstall left them there."
    ${GetParameters} $R2
    ClearErrors
    ${GetOptions} $R2 "/S" $R3
    ${If} ${Errors}
      MessageBox MB_OK|MB_ICONEXCLAMATION "${PRODUCT_NAME} is uninstalled, but other programs still use $R1 in $INSTDIR. Delete that folder once nothing uses it."
    ${EndIf}
  ${EndIf}
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
!macroend

!macro repointShortcut LINK
  ${If} ${FileExists} "${LINK}"
    CreateShortCut "${LINK}" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "${LINK}" "${APP_ID}"
  ${EndIf}
!macroend

!macro readAppFolder
  System::Call 'kernel32::GetLongPathNameW(w "$INSTDIR", w .R6, i ${NSIS_MAX_STRLEN}) i .R8'
  ${If} $R8 = 0
  ${OrIf} $R8 >= ${NSIS_MAX_STRLEN}
    StrCpy $R6 $INSTDIR
  ${EndIf}
  StrCpy $R8 $R6 1 -1
  ${If} $R8 != "\"
    StrCpy $R6 "$R6\"
  ${EndIf}
  StrLen $R8 $R6
  System::Call 'kernel32::GetCurrentProcessId() i .R7'
!macroend

!macro findAppProcesses END
  StrCpy $R0 0
  StrCpy $R1 0
  System::Call 'kernel32::CreateToolhelp32Snapshot(i ${SNAPSHOT_PROCESSES}, i 0) p .r6'
  ${If} $6 P<> ${INVALID_HANDLE}
    System::Call '*(&l4, i, i, p, i, i, i, i, i, &w260) p .r7'
    System::Call 'kernel32::Process32FirstW(p r6, p r7) i .r0'
    ${DoWhile} $0 <> 0
      System::Call '*$7(i, i, i .r1)'
      ${If} $1 <> $R7
      ${AndIf} $1 <> 0
        System::Call 'kernel32::OpenProcess(i ${PROCESS_QUERY_LIMITED}, i 0, i r1) p .r2'
        ${If} $2 P<> 0
          System::Call 'kernel32::QueryFullProcessImageNameW(p r2, i 0, w .r3, *i ${NSIS_MAX_STRLEN}) i .r4'
          System::Call 'kernel32::CloseHandle(p r2)'
          StrCpy $5 $3 $R8
          ${If} $4 <> 0
          ${AndIf} $5 == $R6
            IntOp $R0 $R0 + 1
            !if ${END} == 1
              System::Call 'kernel32::OpenProcess(i ${PROCESS_END}, i 0, i r1) p .r2'
              ${If} $2 P<> 0
                System::Call 'kernel32::TerminateProcess(p r2, i 1)'
                System::Call 'kernel32::WaitForSingleObject(p r2, i ${APP_END_WAIT})'
                System::Call 'kernel32::CloseHandle(p r2)'
              ${EndIf}
            !endif
          ${EndIf}
        ${EndIf}
      ${EndIf}
      System::Call 'kernel32::Process32NextW(p r6, p r7) i .r0'
    ${Loop}
    System::Free $7
    System::Call 'kernel32::CloseHandle(p r6)'
  ${EndIf}
  ${If} $R0 = 0
  ${AndIf} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    System::Call 'kernel32::CreateFileW(w "$INSTDIR\${APP_EXECUTABLE_FILENAME}", i ${FILE_WRITE}, i ${FILE_SHARE_ALL}, p 0, i ${FILE_OPEN_EXISTING}, i 0, p 0) p .r2 ?e'
    Pop $3
    ${If} $2 P= ${INVALID_HANDLE}
      ${If} $3 = ${SHARING_VIOLATION}
        StrCpy $R1 1
      ${EndIf}
    ${Else}
      System::Call 'kernel32::CloseHandle(p r2)'
    ${EndIf}
  ${EndIf}
!macroend

!macro customCheckAppRunning
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  Push $7
  Push $R0
  Push $R1
  Push $R2
  Push $R7
  Push $R8
  Push $R6
  !insertmacro readAppFolder
  ${If} ${isUpdated}
    Sleep 300
  ${EndIf}
  !insertmacro findAppProcesses 0
  ${If} $R0 <> 0
  ${OrIf} $R1 = 1
    ${If} ${isUpdated}
      Sleep 1000
    ${Else}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK +2
      Quit
    ${EndIf}
    DetailPrint "$(appClosing)"
    StrCpy $R2 0
    ${Do}
      !insertmacro findAppProcesses 1
      !insertmacro findAppProcesses 0
      ${If} $R0 = 0
      ${AndIf} $R1 = 0
        ${ExitDo}
      ${EndIf}
      IntOp $R2 $R2 + 1
      ${If} $R2 >= ${APP_CLOSE_ATTEMPTS}
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY +2
        Quit
        StrCpy $R2 0
      ${Else}
        DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
        Sleep ${APP_CLOSE_PAUSE}
      ${EndIf}
    ${Loop}
  ${EndIf}
  Pop $R6
  Pop $R8
  Pop $R7
  Pop $R2
  Pop $R1
  Pop $R0
  Pop $7
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro customInit
  !ifdef MENU_FILENAME
    Var /GLOBAL movedFrom
    StrCpy $movedFrom ""
    Push $0
    Push $1
    Push $2
    !insertmacro GetDParameter $0
    ${If} $0 == ""
      StrCpy $0 "$LOCALAPPDATA\Programs"
      StrCpy $2 0
      System::Call 'SHELL32::SHGetKnownFolderPath(g "{5CD7AEE2-2219-4A67-B85D-6C9CE15660CB}", i 0x00008000, p 0, *p .r2)i.r1'
      ${If} $1 == 0
        System::Call 'KERNEL32::lstrcpynW(w .r0, p r2, i ${NSIS_MAX_STRLEN})p'
      ${EndIf}
      ${If} $2 != 0
        System::Call 'OLE32::CoTaskMemFree(p r2)'
      ${EndIf}
      ${If} $INSTDIR == "$0\${APP_FILENAME}"
        StrCpy $movedFrom $INSTDIR
        StrCpy $INSTDIR "$0\${MENU_FILENAME}\${PRODUCT_FILENAME}"
      ${EndIf}
    ${EndIf}
    Pop $2
    Pop $1
    Pop $0
  !endif
!macroend

!macro customInstall
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  !ifdef MENU_FILENAME
    ${If} $movedFrom != ""
      !insertmacro repointShortcut $newStartMenuLink
      !insertmacro repointShortcut $newDesktopLink
      ClearErrors
      ReadRegStr $R0 HKCU "Environment" "Path"
      ${IfNot} ${Errors}
        StrLen $R1 ";$R0;"
        ${If} $R1 < ${COMMAND_PATH_LIMIT}
          ClearErrors
          ${WordReplace} ";$R0;" ";$movedFrom\bin;" ";" "E+" $R1
          ${IfNot} ${Errors}
            StrCpy $R1 $R1 -1 1
            WriteRegExpandStr HKCU "Environment" "Path" $R1
            !insertmacro announceEnvironment
          ${EndIf}
        ${EndIf}
      ${EndIf}
    ${EndIf}
  !endif
  ClearErrors
  ReadRegStr $R0 HKCU "Environment" "Path"
  ${If} ${Errors}
    StrCpy $R1 0
    StrCpy $R3 ""
    ${Do}
      ClearErrors
      EnumRegValue $R2 HKCU "Environment" $R1
      ${If} $R2 == "Path"
        StrCpy $R3 "found"
      ${EndIf}
      IntOp $R1 $R1 + 1
    ${LoopUntil} $R2 == ""
    ${If} $R3 == ""
      WriteRegExpandStr HKCU "Environment" "Path" "${COMMAND_FOLDER}"
      !insertmacro announceEnvironment
    ${Else}
      DetailPrint "The user's Path could not be read, so ${COMMAND_FOLDER} was not added to it."
    ${EndIf}
  ${Else}
    StrLen $R1 ";$R0;${COMMAND_FOLDER};"
    ${If} $R1 >= ${COMMAND_PATH_LIMIT}
      DetailPrint "The user's Path is too long to add ${COMMAND_FOLDER} to it."
    ${Else}
      ClearErrors
      ${WordReplace} ";$R0;" ";${COMMAND_FOLDER};" ";" "E+" $R1
      ${If} ${Errors}
        StrCpy $R2 $R0 1 -1
        ${If} $R0 == ""
          StrCpy $R0 "${COMMAND_FOLDER}"
        ${ElseIf} $R2 == ";"
          StrCpy $R0 "$R0${COMMAND_FOLDER};"
        ${Else}
          StrCpy $R0 "$R0;${COMMAND_FOLDER}"
        ${EndIf}
        WriteRegExpandStr HKCU "Environment" "Path" $R0
        !insertmacro announceEnvironment
      ${EndIf}
    ${EndIf}
  ${EndIf}
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
!macroend

!macro customUnInstall
  ${IfNot} ${isUpdated}
    Push $R0
    Push $R1
    ClearErrors
    ReadRegStr $R0 HKCU "Environment" "Path"
    ${IfNot} ${Errors}
      StrLen $R1 ";$R0;"
      ${If} $R1 < ${COMMAND_PATH_LIMIT}
        ClearErrors
        ${WordReplace} ";$R0;" ";${COMMAND_FOLDER};" ";" "E+" $R1
        ${IfNot} ${Errors}
          StrCpy $R1 $R1 -1 1
          ${If} $R1 == ""
            DeleteRegValue HKCU "Environment" "Path"
          ${Else}
            WriteRegExpandStr HKCU "Environment" "Path" $R1
          ${EndIf}
          !insertmacro announceEnvironment
        ${EndIf}
      ${EndIf}
    ${EndIf}
    Pop $R1
    Pop $R0
    !insertmacro removeProgramFiles
    !ifdef MENU_FILENAME
      Push $R0
      Push $R1
      ${GetParent} $INSTDIR $R0
      ${GetFileName} $R0 $R1
      ${If} $R1 == "${MENU_FILENAME}"
        RMDir $R0
      ${EndIf}
      Pop $R1
      Pop $R0
    !endif
  ${EndIf}
!macroend

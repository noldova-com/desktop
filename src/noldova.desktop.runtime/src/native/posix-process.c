/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

#if defined(__linux__)
#define _GNU_SOURCE
#endif
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#if defined(__linux__)
#include <sys/syscall.h>
#if !defined(SYS_close_range) && defined(__NR_close_range)
#define SYS_close_range __NR_close_range
#elif !defined(SYS_close_range) && (defined(__x86_64__) || defined(__aarch64__))
#define SYS_close_range 436
#elif !defined(SYS_close_range)
#error "The POSIX process addon needs close_range's system call number on Linux."
#endif
#endif
#if defined(__APPLE__)
#include <dlfcn.h>
#include <libproc.h>
#include <mach/message.h>
#include <spawn.h>
#include <sys/mount.h>
#include <sys/param.h>
#include <sys/proc_info.h>
#include <sys/sysctl.h>
#include <sys/un.h>
#define TOKEN_PROCESS_ID 5
#define TOKEN_PROCESS_VERSION 7

typedef int (*disclaim_function)(posix_spawnattr_t *attributes, int disclaim);
typedef pid_t (*responsible_function)(pid_t process_id);

typedef struct {
  posix_spawnattr_t attributes;
  posix_spawn_file_actions_t actions;
  bool has_actions;
} disclaimed_spawn;
#endif
#include <node_api.h>

#define MESSAGE_LENGTH 256
#define STATUS_DESCRIPTOR 3
#define FIRST_STRAY_DESCRIPTOR 4
#define DESCRIPTOR_LIMIT_CAP 65536
#define STARTED_RECORD 0
#define FAILED_RECORD 1
#define FOLDER_FAILED_RECORD 2
#define SPAWN_FAILED_RECORD 3
#if defined(NOLDOVA_SPAWN_FAILURE_HOOK)
#define START_ARGUMENT_LIMIT 9
#else
#define START_ARGUMENT_LIMIT 8
#endif
#define EXEC_FAILED_EXIT_CODE 127
#define NULL_DEVICE "/dev/null"
#define PROCESS_ROW_LENGTH 6
#define PROCESS_LIST_SPARE 64
#define NO_TERMINAL_DEVICE UINT32_MAX

typedef struct {
  char **items;
  uint32_t count;
} string_list;

typedef struct {
  int32_t kind;
  int32_t value;
} status_record;

static napi_value fail(napi_env env) {
  bool is_pending = false;
  if (napi_is_exception_pending(env, &is_pending) == napi_ok && !is_pending)
    napi_throw_error(env, NULL, "A Node-API call in the POSIX process addon failed.");
  return NULL;
}

static napi_value throw_system(napi_env env, const char *function, int error, const char *message) {
  napi_value code;
  napi_value text;
  napi_value exception;
  napi_value number;
  if (napi_create_string_utf8(env, function, NAPI_AUTO_LENGTH, &code) != napi_ok
      || napi_create_string_utf8(env, message, NAPI_AUTO_LENGTH, &text) != napi_ok
      || napi_create_error(env, NULL, text, &exception) != napi_ok
      || napi_create_int32(env, error, &number) != napi_ok
      || napi_set_named_property(env, exception, "errno", number) != napi_ok
      || napi_set_named_property(env, exception, "syscall", code) != napi_ok
      || napi_throw(env, exception) != napi_ok)
    return fail(env);
  return NULL;
}

static napi_value fail_system(napi_env env, const char *function, int error) {
  char message[MESSAGE_LENGTH];
  snprintf(message, sizeof(message), "%s failed: %s", function, strerror(error));
  return throw_system(env, function, error, message);
}

static napi_value fail_start(napi_env env, int spawn_error, int error) {
  char spawn_message[MESSAGE_LENGTH];
  char message[MESSAGE_LENGTH * 2];
  if (spawn_error == 0)
    return fail_system(env, "execve", error);
  snprintf(spawn_message, sizeof(spawn_message), "%s", strerror(spawn_error));
  snprintf(message, sizeof(message), "posix_spawn failed: %s; execve failed: %s", spawn_message, strerror(error));
  return throw_system(env, "execve", error, message);
}

static void free_list(string_list *list) {
  uint32_t index;
  if (list->items == NULL)
    return;
  for (index = 0; index < list->count; index++)
    free(list->items[index]);
  free(list->items);
  list->items = NULL;
  list->count = 0;
}

static char *read_string(napi_env env, napi_value value) {
  size_t length = 0;
  size_t written = 0;
  char *text;
  if (napi_get_value_string_utf8(env, value, NULL, 0, &length) != napi_ok) {
    napi_throw_type_error(env, NULL, "The POSIX process addon expects strings.");
    return NULL;
  }
  text = malloc(length + 1);
  if (text == NULL) {
    fail_system(env, "malloc", ENOMEM);
    return NULL;
  }
  if (napi_get_value_string_utf8(env, value, text, length + 1, &written) != napi_ok) {
    free(text);
    fail(env);
    return NULL;
  }
  if (strlen(text) != written) {
    free(text);
    napi_throw_type_error(env, NULL, "The POSIX process addon cannot pass a string that holds a null character.");
    return NULL;
  }
  return text;
}

static bool read_list(napi_env env, napi_value value, const char *first, string_list *list) {
  uint32_t length = 0;
  uint32_t offset = first == NULL ? 0 : 1;
  uint32_t index;
  bool is_array = false;
  napi_value item;
  list->items = NULL;
  list->count = 0;
  if (napi_is_array(env, value, &is_array) != napi_ok || !is_array || napi_get_array_length(env, value, &length) != napi_ok) {
    napi_throw_type_error(env, NULL, "The POSIX process addon expects its arguments and environment as arrays of strings.");
    return false;
  }
  list->items = calloc((size_t)length + offset + 1, sizeof(char *));
  if (list->items == NULL) {
    fail_system(env, "calloc", ENOMEM);
    return false;
  }
  if (first != NULL) {
    list->items[0] = strdup(first);
    list->count = 1;
    if (list->items[0] == NULL) {
      free_list(list);
      fail_system(env, "strdup", ENOMEM);
      return false;
    }
  }
  for (index = 0; index < length; index++) {
    if (napi_get_element(env, value, index, &item) != napi_ok) {
      free_list(list);
      fail(env);
      return false;
    }
    list->items[offset + index] = read_string(env, item);
    if (list->items[offset + index] == NULL) {
      free_list(list);
      return false;
    }
    list->count++;
  }
  return true;
}

static int read_descriptor_limit(void) {
  struct rlimit limit;
  if (getrlimit(RLIMIT_NOFILE, &limit) != 0 || limit.rlim_cur == RLIM_INFINITY || limit.rlim_cur > DESCRIPTOR_LIMIT_CAP)
    return DESCRIPTOR_LIMIT_CAP;
  return (int)limit.rlim_cur;
}

static void close_stray_descriptors(int limit) {
  int descriptor;
#if defined(__linux__)
  if (syscall(SYS_close_range, (unsigned int)FIRST_STRAY_DESCRIPTOR, ~0U, 0) == 0)
    return;
#endif
  for (descriptor = FIRST_STRAY_DESCRIPTOR; descriptor < limit; descriptor++)
    fcntl(descriptor, F_SETFD, FD_CLOEXEC);
}

static void write_record(int descriptor, int32_t kind, int32_t value) {
  status_record record;
  ssize_t written;
  record.kind = kind;
  record.value = value;
  do
    written = write(descriptor, &record, sizeof(record));
  while (written < 0 && errno == EINTR);
}

static void reset_signals(void) {
  struct sigaction action;
  sigset_t empty;
  int number;
  memset(&action, 0, sizeof(action));
  action.sa_handler = SIG_DFL;
  for (number = 1; number < NSIG; number++)
    if (number != SIGKILL && number != SIGSTOP)
      sigaction(number, &action, NULL);
  sigemptyset(&empty);
  sigprocmask(SIG_SETMASK, &empty, NULL);
}

static void run_program(const char *file, char *const *arguments, char *const *environment, const char *folder, int given_input, int given_output, int errors,
    int status, int limit, void *spawn) {
  int input = given_input >= 0 ? given_input : open(NULL_DEVICE, O_RDONLY);
  int output = given_output >= 0 ? given_output : open(NULL_DEVICE, O_WRONLY);
  int spawn_error = 0;
  int error;
  reset_signals();
  if (input < 0 || output < 0 || setsid() < 0
      || dup2(input, STDIN_FILENO) < 0 || dup2(output, STDOUT_FILENO) < 0 || dup2(errors, STDERR_FILENO) < 0
      || dup2(status, STATUS_DESCRIPTOR) < 0 || fcntl(STATUS_DESCRIPTOR, F_SETFD, FD_CLOEXEC) < 0) {
    write_record(status, FAILED_RECORD, errno);
    _exit(EXEC_FAILED_EXIT_CODE);
  }
  if (folder != NULL && chdir(folder) != 0) {
    write_record(STATUS_DESCRIPTOR, FOLDER_FAILED_RECORD, errno);
    _exit(EXEC_FAILED_EXIT_CODE);
  }
  close_stray_descriptors(limit);
#if defined(__APPLE__)
  if (spawn != NULL) {
    disclaimed_spawn *disclaimed = (disclaimed_spawn *)spawn;
    spawn_error = posix_spawn(NULL, file, disclaimed->has_actions ? &disclaimed->actions : NULL, &disclaimed->attributes, arguments, environment);
  }
#else
  (void)spawn;
#endif
  execve(file, arguments, environment);
  error = errno;
  if (spawn_error != 0)
    write_record(STATUS_DESCRIPTOR, SPAWN_FAILED_RECORD, spawn_error);
  write_record(STATUS_DESCRIPTOR, FAILED_RECORD, error);
  _exit(EXEC_FAILED_EXIT_CODE);
}

static void release_spawn(void *spawn) {
#if defined(__APPLE__)
  disclaimed_spawn *disclaimed = (disclaimed_spawn *)spawn;
  if (disclaimed == NULL)
    return;
  posix_spawnattr_destroy(&disclaimed->attributes);
  if (disclaimed->has_actions)
    posix_spawn_file_actions_destroy(&disclaimed->actions);
#else
  (void)spawn;
#endif
}

#if defined(__APPLE__)
static bool read_optional_string(napi_env env, napi_value *values, size_t given, size_t index, char **text) {
  napi_valuetype type = napi_undefined;
  *text = NULL;
  if (given > index && napi_typeof(env, values[index], &type) != napi_ok) {
    fail(env);
    return false;
  }
  if (type == napi_undefined || type == napi_null)
    return true;
  *text = read_string(env, values[index]);
  return *text != NULL;
}

static bool prepare_disclaim(napi_env env, napi_value *values, size_t given, disclaimed_spawn *spawn, bool *is_prepared) {
  char *name;
  char *input = NULL;
  disclaim_function disclaim;
  *is_prepared = false;
  spawn->has_actions = false;
  if (!read_optional_string(env, values, given, 7, &name))
    return false;
  if (name == NULL)
    return true;
#if defined(NOLDOVA_SPAWN_FAILURE_HOOK)
  if (!read_optional_string(env, values, given, 8, &input)) {
    free(name);
    return false;
  }
#endif
  disclaim = (disclaim_function)dlsym(RTLD_DEFAULT, name);
  free(name);
  if (disclaim == NULL || posix_spawnattr_init(&spawn->attributes) != 0) {
    free(input);
    return true;
  }
  if (posix_spawnattr_setflags(&spawn->attributes, POSIX_SPAWN_SETEXEC) != 0 || disclaim(&spawn->attributes, 1) != 0) {
    posix_spawnattr_destroy(&spawn->attributes);
    free(input);
    return true;
  }
#if defined(NOLDOVA_SPAWN_FAILURE_HOOK)
  if (input != NULL && posix_spawn_file_actions_init(&spawn->actions) == 0) {
    spawn->has_actions = posix_spawn_file_actions_addopen(&spawn->actions, STDIN_FILENO, input, O_RDONLY, 0) == 0;
    if (!spawn->has_actions)
      posix_spawn_file_actions_destroy(&spawn->actions);
  }
#endif
  free(input);
  *is_prepared = true;
  return true;
}
#endif

static int open_status_pipe(int descriptors[2]) {
#if defined(__linux__)
  return pipe2(descriptors, O_CLOEXEC);
#else
  if (pipe(descriptors) != 0)
    return -1;
  if (fcntl(descriptors[0], F_SETFD, FD_CLOEXEC) != 0 || fcntl(descriptors[1], F_SETFD, FD_CLOEXEC) != 0) {
    close(descriptors[0]);
    close(descriptors[1]);
    return -1;
  }
  return 0;
#endif
}

static bool read_records(int descriptor, int32_t *process_id, int32_t *error, int32_t *folder_error, int32_t *spawn_error) {
  status_record record;
  size_t received = 0;
  ssize_t count;
  *process_id = 0;
  *error = 0;
  *folder_error = 0;
  *spawn_error = 0;
  for (;;) {
    count = read(descriptor, (char *)&record + received, sizeof(record) - received);
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      return count == 0 && received == 0;
    received += (size_t)count;
    if (received < sizeof(record))
      continue;
    received = 0;
    if (record.kind == STARTED_RECORD)
      *process_id = record.value;
    else if (record.kind == FOLDER_FAILED_RECORD)
      *folder_error = record.value;
    else if (record.kind == SPAWN_FAILED_RECORD)
      *spawn_error = record.value;
    else
      *error = record.value;
  }
}

static bool read_optional_descriptor(napi_env env, napi_value *values, size_t given, size_t index, int32_t *descriptor) {
  napi_valuetype type = napi_undefined;
  if (given > index && napi_typeof(env, values[index], &type) != napi_ok)
    return false;
  return type == napi_undefined || (napi_get_value_int32(env, values[index], descriptor) == napi_ok && *descriptor >= 0);
}

static napi_value start_detached(napi_env env, napi_callback_info info) {
  napi_value values[9];
  size_t given = 9;
  char *file;
  char *folder = NULL;
  string_list arguments;
  string_list environment;
  int32_t errors = -1;
  int32_t output = -1;
  int32_t input = -1;
  napi_valuetype folder_type = napi_undefined;
  int descriptors[2];
  int limit = read_descriptor_limit();
  int fork_error;
  int wait_status;
  int32_t process_id;
  int32_t error;
  int32_t folder_error;
  int32_t spawn_error;
  bool is_complete;
  sigset_t all;
  sigset_t previous;
  pid_t intermediate;
  napi_value result;
  void *spawn = NULL;
#if defined(__APPLE__)
  disclaimed_spawn disclaimed;
  bool is_prepared = false;
#endif

  if (napi_get_cb_info(env, info, &given, values, NULL, NULL) != napi_ok)
    return fail(env);
  if (given > START_ARGUMENT_LIMIT) {
    napi_throw_type_error(env, NULL, "The POSIX process addon was given more arguments than it takes to start a program.");
    return NULL;
  }
  if (given < 4 || napi_get_value_int32(env, values[3], &errors) != napi_ok || errors < 0) {
    napi_throw_type_error(env, NULL, "The POSIX process addon expects a file, its arguments, its environment and a descriptor for its errors.");
    return NULL;
  }
  if (!read_optional_descriptor(env, values, given, 5, &output) || !read_optional_descriptor(env, values, given, 6, &input)) {
    napi_throw_type_error(env, NULL, "The POSIX process addon expects its output and input descriptors, when given, as descriptors.");
    return NULL;
  }
  if (given >= 5 && napi_typeof(env, values[4], &folder_type) != napi_ok)
    return fail(env);
  if (folder_type != napi_undefined) {
    folder = read_string(env, values[4]);
    if (folder == NULL)
      return NULL;
  }
  file = read_string(env, values[0]);
  if (file == NULL) {
    free(folder);
    return NULL;
  }
  if (!read_list(env, values[1], file, &arguments)) {
    free(file);
    free(folder);
    return NULL;
  }
  if (!read_list(env, values[2], NULL, &environment)) {
    free_list(&arguments);
    free(file);
    free(folder);
    return NULL;
  }
#if defined(__APPLE__)
  if (!prepare_disclaim(env, values, given, &disclaimed, &is_prepared)) {
    free_list(&environment);
    free_list(&arguments);
    free(file);
    free(folder);
    return NULL;
  }
  if (is_prepared)
    spawn = &disclaimed;
#endif
  if (open_status_pipe(descriptors) != 0) {
    fork_error = errno;
    release_spawn(spawn);
    free_list(&environment);
    free_list(&arguments);
    free(file);
    free(folder);
    return fail_system(env, "pipe", fork_error);
  }

  sigfillset(&all);
  pthread_sigmask(SIG_SETMASK, &all, &previous);
  intermediate = fork();
  if (intermediate == 0) {
    pid_t program = fork();
    if (program == 0)
      run_program(file, arguments.items, environment.items, folder, input, output, errors, descriptors[1], limit, spawn);
    if (program < 0)
      write_record(descriptors[1], FAILED_RECORD, errno);
    else
      write_record(descriptors[1], STARTED_RECORD, (int32_t)program);
    _exit(0);
  }
  fork_error = errno;
  pthread_sigmask(SIG_SETMASK, &previous, NULL);
  close(descriptors[1]);
  release_spawn(spawn);
  free_list(&environment);
  free_list(&arguments);
  free(file);
  free(folder);
  if (intermediate < 0) {
    close(descriptors[0]);
    return fail_system(env, "fork", fork_error);
  }

  is_complete = read_records(descriptors[0], &process_id, &error, &folder_error, &spawn_error);
  close(descriptors[0]);
  while (waitpid(intermediate, &wait_status, 0) < 0 && errno == EINTR)
    ;
  if (folder_error != 0)
    return fail_system(env, "chdir", folder_error);
  if (error != 0)
    return fail_start(env, spawn_error, error);
  if (!is_complete || process_id <= 0)
    return fail_system(env, "fork", EIO);
  return napi_create_int32(env, process_id, &result) == napi_ok ? result : fail(env);
}

#if defined(__linux__)
static napi_value clock_ticks(napi_env env, napi_callback_info info) {
  napi_value result;
  long ticks;
  (void)info;
  errno = 0;
  ticks = sysconf(_SC_CLK_TCK);
  if (ticks <= 0)
    return fail_system(env, "sysconf", errno == 0 ? EINVAL : errno);
  return napi_create_int64(env, ticks, &result) == napi_ok ? result : fail(env);
}
#endif

#if defined(__APPLE__)
static bool set_row(napi_env env, napi_value rows, uint32_t index, const double *values) {
  napi_value row;
  napi_value number;
  uint32_t column;
  if (napi_create_array_with_length(env, PROCESS_ROW_LENGTH, &row) != napi_ok)
    return false;
  for (column = 0; column < PROCESS_ROW_LENGTH; column++)
    if (napi_create_double(env, values[column], &number) != napi_ok || napi_set_element(env, row, column, number) != napi_ok)
      return false;
  return napi_set_element(env, rows, index, row) == napi_ok;
}

static napi_value list_processes(napi_env env, napi_callback_info info) {
  struct proc_bsdinfo process;
  double values[PROCESS_ROW_LENGTH];
  napi_value rows;
  pid_t *processes;
  uint32_t listed = 0;
  int capacity;
  int count;
  int index;
  int error;
  (void)info;
  errno = 0;
  capacity = proc_listallpids(NULL, 0);
  if (capacity <= 0)
    return fail_system(env, "proc_listallpids", errno == 0 ? EIO : errno);
  capacity += PROCESS_LIST_SPARE;
  processes = calloc((size_t)capacity, sizeof(pid_t));
  if (processes == NULL)
    return fail_system(env, "calloc", ENOMEM);
  errno = 0;
  count = proc_listallpids(processes, capacity * (int)sizeof(pid_t));
  if (count <= 0) {
    error = errno == 0 ? EIO : errno;
    free(processes);
    return fail_system(env, "proc_listallpids", error);
  }
  if (napi_create_array(env, &rows) != napi_ok) {
    free(processes);
    return fail(env);
  }
  for (index = 0; index < count && index < capacity; index++) {
    if (proc_pidinfo(processes[index], PROC_PIDTBSDINFO, 0, &process, PROC_PIDTBSDINFO_SIZE) != PROC_PIDTBSDINFO_SIZE)
      continue;
    values[0] = process.pbi_pid;
    values[1] = process.pbi_ppid;
    values[2] = process.pbi_pgid;
    values[3] = process.e_tdev == NO_TERMINAL_DEVICE ? 0 : process.e_tdev;
    values[4] = (double)process.pbi_start_tvsec * 1000.0 + (double)process.pbi_start_tvusec / 1000.0;
    values[5] = 0;
    if (!set_row(env, rows, listed++, values)) {
      free(processes);
      return fail(env);
    }
  }
  free(processes);
  return rows;
}
#endif

static bool read_integer(napi_env env, napi_callback_info info, int32_t *number) {
  size_t count = 1;
  napi_value value;
  if (napi_get_cb_info(env, info, &count, &value, NULL, NULL) != napi_ok) {
    fail(env);
    return false;
  }
  if (count < 1 || napi_get_value_int32(env, value, number) != napi_ok) {
    napi_throw_type_error(env, NULL, "The POSIX process addon expects a number.");
    return false;
  }
  return true;
}

#if defined(__linux__)
static napi_value peer_process_id(napi_env env, napi_callback_info info) {
  napi_value result;
  int32_t descriptor;
  struct ucred credentials;
  socklen_t length = sizeof(credentials);
  if (!read_integer(env, info, &descriptor))
    return NULL;
  if (getsockopt(descriptor, SOL_SOCKET, SO_PEERCRED, &credentials, &length) != 0)
    return fail_system(env, "getsockopt", errno);
  return napi_create_int32(env, credentials.pid, &result) == napi_ok ? result : fail(env);
}
#endif

#if defined(__APPLE__)
static napi_value peer_token(napi_env env, napi_callback_info info) {
  audit_token_t token;
  socklen_t length = sizeof(token);
  napi_value result;
  napi_value item;
  int32_t descriptor;
  if (!read_integer(env, info, &descriptor))
    return NULL;
  if (getsockopt(descriptor, SOL_LOCAL, LOCAL_PEERTOKEN, &token, &length) != 0 || length != sizeof(token)) {
    if (napi_get_null(env, &result) != napi_ok)
      return fail(env);
    return result;
  }
  if (napi_create_array_with_length(env, 2, &result) != napi_ok
      || napi_create_uint32(env, token.val[TOKEN_PROCESS_ID], &item) != napi_ok || napi_set_element(env, result, 0, item) != napi_ok
      || napi_create_uint32(env, token.val[TOKEN_PROCESS_VERSION], &item) != napi_ok || napi_set_element(env, result, 1, item) != napi_ok)
    return fail(env);
  return result;
}

static napi_value read_responsible_process_id(napi_env env, napi_callback_info info) {
  napi_value values[2];
  size_t given = 2;
  napi_value result;
  int32_t process_id;
  char *name;
  responsible_function responsible;
  pid_t responsible_id;
  if (napi_get_cb_info(env, info, &given, values, NULL, NULL) != napi_ok)
    return fail(env);
  if (given < 2 || napi_get_value_int32(env, values[0], &process_id) != napi_ok) {
    napi_throw_type_error(env, NULL, "The POSIX process addon expects a process id and a function's name.");
    return NULL;
  }
  name = read_string(env, values[1]);
  if (name == NULL)
    return NULL;
  responsible = (responsible_function)dlsym(RTLD_DEFAULT, name);
  free(name);
  responsible_id = responsible == NULL ? 0 : responsible((pid_t)process_id);
  if (responsible_id <= 0)
    return napi_get_null(env, &result) == napi_ok ? result : fail(env);
  return napi_create_int32(env, (int32_t)responsible_id, &result) == napi_ok ? result : fail(env);
}

static napi_value read_process_path(napi_env env, napi_callback_info info) {
  char path[PROC_PIDPATHINFO_MAXSIZE];
  napi_value result;
  int32_t process_id;
  if (!read_integer(env, info, &process_id))
    return NULL;
  if (proc_pidpath(process_id, path, sizeof(path)) <= 0) {
    if (napi_get_null(env, &result) != napi_ok)
      return fail(env);
    return result;
  }
  return napi_create_string_utf8(env, path, NAPI_AUTO_LENGTH, &result) == napi_ok ? result : fail(env);
}

static napi_value to_environment(napi_env env, const char *arguments, size_t size) {
  napi_value list;
  napi_value item;
  int argument_count;
  size_t offset = sizeof(int);
  uint32_t index = 0;
  size_t length;
  if (napi_create_array(env, &list) != napi_ok)
    return fail(env);
  if (size < sizeof(int))
    return list;
  memcpy(&argument_count, arguments, sizeof(int));
  while (offset < size && arguments[offset] != '\0')
    offset++;
  while (offset < size && arguments[offset] == '\0')
    offset++;
  while (offset < size && argument_count > 0) {
    if (arguments[offset++] == '\0')
      argument_count--;
  }
  while (offset < size && arguments[offset] != '\0') {
    length = strnlen(arguments + offset, size - offset);
    if (napi_create_string_utf8(env, arguments + offset, length, &item) != napi_ok || napi_set_element(env, list, index++, item) != napi_ok)
      return fail(env);
    offset += length + 1;
  }
  return list;
}

static napi_value read_environment(napi_env env, napi_callback_info info) {
  int names[3];
  int maximum = 0;
  size_t size = sizeof(maximum);
  char *arguments;
  napi_value result;
  int32_t process_id;
  if (!read_integer(env, info, &process_id))
    return NULL;
  names[0] = CTL_KERN;
  names[1] = KERN_ARGMAX;
  if (sysctl(names, 2, &maximum, &size, NULL, 0) != 0 || maximum <= 0)
    return fail_system(env, "sysctl", errno == 0 ? EINVAL : errno);
  arguments = malloc((size_t)maximum);
  if (arguments == NULL)
    return fail_system(env, "malloc", ENOMEM);
  names[0] = CTL_KERN;
  names[1] = KERN_PROCARGS2;
  names[2] = process_id;
  size = (size_t)maximum;
  if (sysctl(names, 3, arguments, &size, NULL, 0) != 0) {
    free(arguments);
    if (napi_get_null(env, &result) != napi_ok)
      return fail(env);
    return result;
  }
  result = to_environment(env, arguments, size);
  free(arguments);
  return result;
}

static napi_value read_volume(napi_env env, napi_callback_info info) {
  size_t count = 1;
  napi_value value;
  napi_value result;
  napi_value item;
  struct statfs volume;
  char *folder;
  int error;
  if (napi_get_cb_info(env, info, &count, &value, NULL, NULL) != napi_ok)
    return fail(env);
  if (count < 1) {
    napi_throw_type_error(env, NULL, "The POSIX process addon expects strings.");
    return NULL;
  }
  folder = read_string(env, value);
  if (folder == NULL)
    return NULL;
  error = statfs(folder, &volume) == 0 ? 0 : errno;
  free(folder);
  if (error != 0)
    return fail_system(env, "statfs", error);
  if (napi_create_array_with_length(env, 2, &result) != napi_ok
      || napi_create_string_utf8(env, volume.f_mntonname, NAPI_AUTO_LENGTH, &item) != napi_ok
      || napi_set_element(env, result, 0, item) != napi_ok
      || napi_get_boolean(env, (volume.f_flags & MNT_IGNORE_OWNERSHIP) != 0, &item) != napi_ok
      || napi_set_element(env, result, 1, item) != napi_ok)
    return fail(env);
  return result;
}
#endif

static bool export_function(napi_env env, napi_value exports, const char *name, napi_callback callback) {
  napi_value function;
  return napi_create_function(env, name, NAPI_AUTO_LENGTH, callback, NULL, &function) == napi_ok
    && napi_set_named_property(env, exports, name, function) == napi_ok;
}

NAPI_MODULE_INIT() {
  if (!export_function(env, exports, "startDetached", start_detached))
    return fail(env);
#if defined(__linux__)
  if (!export_function(env, exports, "peerProcessId", peer_process_id)
      || !export_function(env, exports, "clockTicks", clock_ticks))
    return fail(env);
#endif
#if defined(__APPLE__)
  if (!export_function(env, exports, "listProcesses", list_processes))
    return fail(env);
  if (!export_function(env, exports, "peerToken", peer_token)
      || !export_function(env, exports, "readProcessPath", read_process_path)
      || !export_function(env, exports, "readResponsibleProcessId", read_responsible_process_id)
      || !export_function(env, exports, "readEnvironment", read_environment)
      || !export_function(env, exports, "readVolume", read_volume))
    return fail(env);
#endif
  return exports;
}

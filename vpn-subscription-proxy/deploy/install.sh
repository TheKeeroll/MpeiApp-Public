#!/usr/bin/env bash
# Run from an interactive SSH terminal: sudo bash /path/to/deploy/install.sh
set +x
set -Eeuo pipefail
unset NODE_OPTIONS NODE_PATH
export PATH="/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RED=$'\033[31m'
RESET=$'\033[0m'
SEPARATOR='****************************************************************'
BOOTSTRAP_DIRECTORY=''

banner() {
  local text='Developed by DragonSavA with Codex' border
  printf -v border '%*s' "$((${#text} + 4))" ''
  border=${border// /*}
  printf '%s\n* Developed by %sDragonSavA%s with Codex *\n%s\n' "$border" "$GREEN" "$RESET" "$border"
}

bootstrap_error() {
  printf '\n%s[ОШИБКА] Подготовка системы не завершена (строка %s).%s\n' "$RED" "$1" "$RESET" >&2
}

cleanup_bootstrap() {
  if [[ "$BOOTSTRAP_DIRECTORY" == /run/dragonet-proxy-installer/bootstrap.* && -d "$BOOTSTRAP_DIRECTORY" ]]; then
    rm -f -- "$BOOTSTRAP_DIRECTORY/nodesource.sh"
    rmdir -- "$BOOTSTRAP_DIRECTORY" 2>/dev/null || true
  fi
}

main() {
  banner
  if [[ "${1:-}" == --help ]]; then
    printf 'Установка/обновление: sudo bash %s\nDebian/Ubuntu, systemd >= 247, интерактивная SSH-сессия.\n' "$0"
    return
  fi
  [[ $# == 0 ]] || { printf '%sНеизвестные аргументы. Используйте --help.%s\n' "$RED" "$RESET" >&2; return 1; }
  [[ $(id -u) == 0 ]] || { printf '%sЗапустите скрипт от root (sudo bash ...).%s\n' "$RED" "$RESET" >&2; return 1; }
  [[ $(uname -s) == Linux ]] || { printf '%sТребуется Linux с systemd.%s\n' "$RED" "$RESET" >&2; return 1; }
  [[ -t 0 && -t 1 ]] || { printf '%sНужна интерактивная SSH-сессия для вопросов и скрытого ввода Token.%s\n' "$RED" "$RESET" >&2; return 1; }
  command -v apt-get >/dev/null || { printf '%sАвтоустановка зависимостей поддерживает Debian/Ubuntu (apt-get).%s\n' "$RED" "$RESET" >&2; return 1; }
  [[ -d /run/systemd/system ]] || { printf '%sСистема должна быть запущена под управлением systemd.%s\n' "$RED" "$RESET" >&2; return 1; }

  trap 'bootstrap_error "$LINENO"' ERR
  trap cleanup_bootstrap EXIT
  umask 077
  local project_directory package systemd_version node_version
  local -a missing=()
  project_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
  [[ -f "$project_directory/package-lock.json" && -f "$project_directory/deploy/setup.mjs" ]]
  printf '\n%s\n[1/8] Система и зависимости\n' "$SEPARATOR"

  # Never enable a firewall or upgrade the entire OS in a dependency step.
  for package in ca-certificates curl gnupg build-essential python3 openssl tar coreutils util-linux iproute2 passwd; do
    if [[ $(dpkg-query -W -f='${Status}' "$package" 2>/dev/null || true) != 'install ok installed' ]]; then
      missing+=("$package")
    fi
  done
  if ((${#missing[@]})); then
    printf '%sУстановка недостающих пакетов: %s%s\n' "$YELLOW" "${missing[*]}" "$RESET"
    apt-get update
    DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l apt-get install -y --no-install-recommends "${missing[@]}"
  fi

  install -d -o root -g root -m 0700 /run/dragonet-proxy-installer
  exec 9>/run/dragonet-proxy-installer/install.lock
  flock -n 9 || { printf '%sДругой установщик proxy уже выполняется.%s\n' "$RED" "$RESET" >&2; return 1; }
  read -r _ systemd_version _ < <(systemctl --version)
  [[ "$systemd_version" =~ ^[0-9]+$ && "$systemd_version" -ge 247 ]] || {
    printf '%sТребуется systemd >= 247 для LoadCredential; обновите ОС.%s\n' "$RED" "$RESET" >&2
    return 1
  }
  systemctl list-units --no-pager >/dev/null

  if ! /usr/bin/node -e 'process.exit(Number(process.versions.node.split(".")[0]) === 24 ? 0 : 1)' 2>/dev/null \
      || ! command -v npm >/dev/null; then
    printf '%sУстановка Node.js 24 и npm из официального репозитория NodeSource.%s\n' "$YELLOW" "$RESET"
    BOOTSTRAP_DIRECTORY=$(mktemp -d /run/dragonet-proxy-installer/bootstrap.XXXXXX)
    curl --fail --silent --show-error --location --connect-timeout 15 --max-time 120 \
      https://deb.nodesource.com/setup_24.x -o "$BOOTSTRAP_DIRECTORY/nodesource.sh"
    DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l bash "$BOOTSTRAP_DIRECTORY/nodesource.sh"
    node_version=$(apt-cache madison nodejs | awk '$3 ~ /^24\./ && !found { print $3; found=1 }')
    [[ -n "$node_version" ]] || { printf '%sВерсия Node.js 24 не найдена в настроенном apt-репозитории.%s\n' "$RED" "$RESET" >&2; return 1; }
    DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l apt-get install -y --reinstall --allow-downgrades "nodejs=$node_version"
  fi
  /usr/bin/node -e 'if (Number(process.versions.node.split(".")[0]) !== 24) process.exit(1)'
  npm --version
  printf '%s[OK] Node.js %s, systemd %s; зависимости готовы.%s\n' "$GREEN" "$(/usr/bin/node --version)" "$systemd_version" "$RESET"
  # Keep fd 9 locked in this shell until the complete Node installer exits.
  trap - ERR
  /usr/bin/node "$project_directory/deploy/setup.mjs"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi

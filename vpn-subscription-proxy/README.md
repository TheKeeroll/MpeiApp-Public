# vpn-subscription-proxy

Автономный HTTPS-сервис для MpeiApp и DragoNet. Он принимает только два
запроса на `PROXY_REQUEST_PATH`:

- `verify` получает статус клиента через `GET /apiv2/clients` панели S-UI;
- `demo` создаёт нового S-UI клиента через form-data `POST /apiv2/save` и
  возвращает разовую ссылку подписки.

`GET /healthz` и `GET /stats` существуют только для loopback VPS. `/stats`
не хранит историю: он показывает с последнего старта успешные `verify`,
успешные `demo`, ответы `reqStatus: "failed"` и uptime в сутках, часах и
минутах. Запросы с неверным `Mpei-App-Req-Id`, для которых socket закрывается
без ответа, в него не входят.

Сервис не является частью React Native-проекта. Панельный Token, TLS-ключи,
данные клиентов, исходные IP и идентификаторы устройств не входят в Git и не
передаются в MpeiApp. SQLite содержит только HMAC IP/device, время выдачи,
окончание cooldown и состояние reservation/issued.

`demo` создаёт клиента с лимитом **2 GiB** и `expiry` ровно через **3 суток**.
Повторная выдача блокируется ровно на **14 суток** как по IP,
так и по устройству. Неопределённый результат панели сохраняет reservation,
чтобы после сбоя не выдать второй demo-доступ.

При создании demo передаётся полный config из **15 секций** по
[контракту S-UI 1.6.5](S_UI_API_V2_1_6_5_CONTRACT.md): `mixed`, `socks`, `http`,
`shadowsocks`, `shadowsocks16`, `shadowtls`, `vmess`, `vless`, `anytls`, `trojan`,
`naive`, `hysteria`, `snell`, `tuic`, `hysteria2`.
У `mixed/socks/http/naive` используется `username`, у остальных — `name`
demo-клиента. UUID и общий пароль согласованы между соответствующими секциями;
для Shadowsocks генерируются base64-ключи из 32/16 случайных байт, для Snell —
32-символьный буквенно-цифровой `userkey`. Изменение относится к новым клиентам;
ранее выданные demo автоматически не изменяются.

Обновление существующего сервера, совместимость с MpeiApp 2.5.0,
миграция SQLite и чтение новых журналов описаны в [UPDATING.md](UPDATING.md).
При cooldown ответ — `{"reqStatus":"failed","reason":"demo_cooldown"}`,
при технической ошибке — `{"reqStatus":"failed","reason":"service_error"}`.
HTTP 200 и успешные ответы сохранены; старый клиент игнорирует новое поле.

## Автоматическая установка и обновление

В архив входит [deploy/install.sh](deploy/install.sh) и его Node helpers.
Одна и та же команда подходит для первого запуска, нового VPS с перенесённым
state и обновления работающего proxy. Поддерживаются **Debian/Ubuntu с apt
и запущенным systemd >= 247**. Нужна интерактивная SSH-сессия от root.

На Windows, из корня репозитория:

```powershell
$ProxyArchive = Join-Path $env:TEMP 'vpn-subscription-proxy-update.tar.gz'
tar -czf $ProxyArchive --exclude=node_modules --exclude=dist --exclude='.env*' --exclude='*.sqlite*' -C .\vpn-subscription-proxy .
if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать архив proxy' }
scp $ProxyArchive <ssh-user>@<vps-address>:/tmp/vpn-subscription-proxy-update.tar.gz
```

На VPS:

```bash
sudo -i
PROXY_SOURCE="$(mktemp -d /root/dragonet-proxy-source.XXXXXX)"
tar -xzf /tmp/vpn-subscription-proxy-update.tar.gz -C "$PROXY_SOURCE"
bash "$PROXY_SOURCE/deploy/install.sh"
```

Отсутствие ранее установленных proxy units допустимо, в том числе на systemd
247, где пустой `list-unit-files` возвращает код 1. Если прежний установщик
остановился на этапе 2 с этим кодом, передайте обновлённый tar и повторите
команды выше с новым временным каталогом. Установленные зависимости
используются повторно; удалять существующие env/state не нужно.

При переносе сначала восстановите прежние env и SQLite по
[инструкции](UPDATING.md#перенос-на-другой-vps), затем запустите установщик.
Код и закрытый архив state передаются отдельно. История demo сохраняется
только вместе с прежним `DEMO_COOLDOWN_HMAC_KEY`.

Установщик последовательно:

1. Показывает рамку `Developed by DragonSavA with Codex` с зелёным ником,
   проверяет root, systemd и зависимости. Недостающие пакеты и Node.js 24/npm
   устанавливаются автоматически; Node устанавливается через
   [NodeSource](https://github.com/nodesource/distributions#installation-instructions).
   Повторный запуск сохраняет подходящий Node. Helpers используют
   [встроенную обработку TypeScript в Node 24](https://nodejs.org/docs/latest-v24.x/api/typescript.html#type-stripping),
   поэтому для чтения env и поиска TLS не нужна предварительная установка npm-пакетов.
2. Запрашивает пути к коду, env и SQLite, параметры listener/подписки,
   HTTPS URL панели, Token и JSON demo inbound ID. Enter сохраняет значение
   из существующего env, иначе предлагается значение по умолчанию/пример.
   Token и закрытый URL вводятся без эха и не выводятся. Дополнительные
   лимиты можно оставить прежними. HMAC-ключ сохраняется, а для новой
   установки генерируется автоматически. Создаётся непривилегированный
   пользователь `dragonet-proxy`.
3. Находит подходящие пары Certbot и S-UI, проверяя срок, ключ, DNS/IP,
   цепочку доверия ОС и пригодность для HTTPS через OpenSSL.
   Если пар несколько, показывает источник, DNS-имена, срок и fingerprint
   и запрашивает номер. Для multi-SAN также можно выбрать DNS-имя proxy.
4. В отдельном staging-каталоге выполняет `npm ci`, typecheck, все тесты,
   build и удаление dev-зависимостей. Проверяет доступ к S-UI/Token read-only
   запросом списка клиентов; содержимое списка не печатается, demo не создаётся.
   Работающий proxy до завершения подготовки не останавливается.
5. Останавливает watcher/service, сохраняет env, SQLite и systemd в
   `/var/backups/dragonet-subscription-proxy/<дата>/`, заменяет код и
   записывает env атомарно с правами 0600. State получает 0700 и владельца
   `dragonet-proxy`; при изменении state-пути переносится закрытая SQLite.
6. Устанавливает все units и instance drop-in `30-installation.conf`
   с выбранной парой и путями. Выполняет daemon-reload, verify и
   enable/restart service и watcher. Старый instance при смене имени
   сертификата отключается.
7. Дожидается доверенного HTTPS/SNI `/healthz`, проверяет `/stats` и состояния
   systemd, затем показывает адрес proxy, пути и команду journal. Для активного
   UFW добавляет правило выбранного TCP-порта; сам firewall не включается.
   Правила провайдера и другого firewall нужно проверить отдельно.

Этапы разделены звёздочками; успехи зелёные, предупреждения жёлтые,
ошибки красные. При ошибке после остановки скрипт возвращает прежние файлы
и состояние запуска systemd. Актуальная SQLite не откатывается старым снимком;
при возврате state-пути переносятся новые записи. Неудачная первая установка
сохраняет созданный env/HMAC для повтора. Код возврата при ошибке — ненулевой,
даже если восстановление файлов удалось.

Метаданные путей/instance хранятся root-only в
`/etc/dragonet-subscription-proxy-installation.json`. Env может содержать
неизвестные дополнительные поля — их значения сохраняются. Для обновления
передайте новый tar и повторите ту же команду; вручную заменять файлы в
установленном каталоге не нужно. Если применялся установщик, дальнейшие
обновления/смену TLS выполняйте им: его `30-installation.conf` имеет приоритет
над старым ручным `20-s-ui-tls.conf`.

Для уже опубликованной MpeiApp 2.5.0 сохраняйте прежние DNS-host, публичные
порт и путь. Выбранное имя записывается в необязательный `PROXY_PUBLIC_HOST`;
без него старые env продолжают работать с автоматическим выбором имени.
При наличии systemd credentials используется только выбранная пара,
без незаметного переключения на другой сертификат при ошибке обновления.

Ниже сохранены ручные процедуры для установок без этого скрипта.

## Что проверяется на старте

До открытия публичного listener сервис:

1. Запрашивает IPv4 у `api.ipify.org`, `ifconfig.me/ip` и `icanhazip.com`.
   Нужны как минимум два одинаковых глобальных IPv4.
2. При systemd credentials проверяет только переданный snapshot выбранной
   пары. PID 1 читает исходные Certbot/S-UI файлы, а непривилегированный
   процесс получает временную read-only копию; ключ в код/env не копируется.
3. При отсутствии credentials ищет пары `fullchain.pem` + `privkey.pem` в
   `/etc/letsencrypt/live/*/`, раскрывает symlink и проверяет чтение,
   соответствие сертификата ключу, срок действия и SAN/CN.
4. При отсутствии подходящей пары ограниченно проверяет `/etc/ssl`,
   `/etc/nginx/ssl`, `/root/cert/` и его непосредственные подкаталоги
   (включая `/root/cert/<домен>/fullchain.pem` + `privkey.pem` от `s-ui.sh`),
   `/opt/*/ssl`, `/root/{fullchain.pem,privkey.pem}`,
   `/root/{cert.pem,key.pem}` и один уровень `/root/.acme.sh`.
5. Принимает только конкретное DNS-имя из сертификата, чей единственный A
   record совпадает с IPv4 из голосования. Если задан `PROXY_PUBLIC_HOST`,
   выбирается именно он. Wildcard сам по себе не подходит.

При любой неудаче listener не открывается. Сервис сам завершает TLS и
сверяет SNI и Host с обнаруженным именем; обычный Nginx с TLS termination
перед ним использовать нельзя.

## Развёртывание на Debian 11/12/13

Команды ниже выполняются на VPS от пользователя с `sudo`. Заменяйте только
явные примеры `proxy.example.com`, имена сертификатов и значения env-файла.
Для переноса с прежнего VPS сначала прочитайте
[раздел переноса](UPDATING.md#перенос-на-другой-vps): он сохраняет env/HMAC и
SQLite. На новом сервере не нужно заново выдавать сертификат, если `s-ui.sh`
уже установил действующую пару.

### 1. Подготовить DNS, Node и сервисного пользователя

Создайте отдельное имя, например `proxy.example.com`. Его единственная
A-запись должна указывать на публичный IPv4 VPS. Порт 443 уже занят, поэтому
proxy ниже слушает `8443`; DNS от номера порта не зависит.

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg build-essential python3 openssl
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node --version
systemctl --version
id -u dragonet-proxy >/dev/null 2>&1 || \
  sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin dragonet-proxy
```

`node --version` должен вывести версию 24.x. `build-essential` нужен на
случай, если `better-sqlite3` будет собран из исходного кода для архитектуры
VPS. Нужен systemd 247 или новее для `LoadCredential`; штатные Debian 11–13
этому соответствуют.

### 2. Выбрать существующую TLS-пару: S-UI или Certbot

Нужен действующий публично доверенный сертификат с DNS-именем proxy в SAN.
Поддерживаются оба типовых расположения:

| Источник | `CERTIFICATE_SOURCE` | Исходная пара |
| --- | --- | --- |
| Меню `s-ui.sh`, использующее acme.sh | `s-ui` | `/root/cert/<CERTIFICATE_NAME>/{fullchain.pem,privkey.pem}` |
| Certbot | `letsencrypt` | `/etc/letsencrypt/live/<CERTIFICATE_NAME>/{fullchain.pem,privkey.pem}` |

Для вашего случая выберите `s-ui`. `CERTIFICATE_NAME` — точное имя каталога
сертификата и instance systemd. У Certbot оно иногда имеет суффикс `-0001`.
`PROXY_HOST` — DNS-имя из SAN, которое открывает приложение; эти имена могут
различаться. Следующие переменные нужны только для команд установки, в
EnvironmentFile их добавлять не нужно:

```bash
export CERTIFICATE_SOURCE='s-ui' # либо letsencrypt
export CERTIFICATE_NAME='proxy.example.com'
export PROXY_HOST='proxy.example.com'
export PROXY_PORT='8443'
case "$CERTIFICATE_SOURCE" in
  s-ui) export CERTIFICATE_DIRECTORY="/root/cert/$CERTIFICATE_NAME" ;;
  letsencrypt) export CERTIFICATE_DIRECTORY="/etc/letsencrypt/live/$CERTIFICATE_NAME" ;;
  *) echo 'CERTIFICATE_SOURCE must be s-ui or letsencrypt' >&2; exit 1 ;;
esac
export SERVICE="dragonet-subscription-proxy@$CERTIFICATE_NAME.service"
export WATCHER="dragonet-subscription-proxy-certificate-reload@$CERTIFICATE_NAME.path"
export RELOADER="dragonet-subscription-proxy-certificate-reload@$CERTIFICATE_NAME.service"
export TLS_DROP_IN="/etc/systemd/system/$SERVICE.d/20-s-ui-tls.conf"
```

Закрытый ключ остаётся root-only в исходном каталоге. PID 1 читает пару через
`LoadCredential`, а процесс `dragonet-proxy` получает временный read-only
snapshot. Для S-UI в шаге 5 устанавливается готовый drop-in, который заменяет
обязательные Certbot-пути в unit: простого добавления каталога в Node discovery
недостаточно для запуска systemd без `/etc/letsencrypt/live/`.
Права на `/root` и ключ расширять не требуется; постоянных копий ключа нет.
[Механизм systemd credentials](https://www.freedesktop.org/software/systemd/man/247/systemd.exec.html#Credentials).

Проверьте выбранную исходную пару. `notAfter` должен быть в будущем, SAN —
содержать `PROXY_HOST`. Команды не выводят содержимое закрытого ключа:

```bash
sudo test -r "$CERTIFICATE_DIRECTORY/privkey.pem"
sudo openssl x509 -in "$CERTIFICATE_DIRECTORY/fullchain.pem" \
  -noout -subject -dates -ext subjectAltName
sudo openssl x509 -in "$CERTIFICATE_DIRECTORY/fullchain.pem" -noout -checkend 0
```

Сохраняйте тот механизм продления, который выпустил сертификат:

```bash
# S-UI/acme.sh: проверить регистрацию сертификата и задачу автопродления.
sudo /root/.acme.sh/acme.sh --list
sudo crontab -l

# Только для Certbot:
sudo certbot certificates
sudo systemctl enable --now certbot.timer
sudo systemctl list-timers certbot.timer --all
```

Выполняйте только подходящий блок. Для acme.sh проверьте, что его install-cert
по-прежнему обновляет именно пару в `/root/cert/<имя>/`; `s-ui.sh` регистрирует
эти пути при выпуске. Если используется systemd timer вместо cron, проверяйте
его. Если сертификат истёк, сначала продлите его через S-UI/acme.sh либо
`sudo certbot renew` соответственно, повторите OpenSSL-проверку и после
установки proxy перезапустите `$SERVICE`. При validation-ошибке исправляется
выпуск сертификата, проверки proxy остаются включёнными.

### 3. Установить код и зависимости

Передайте исходники архивом, исключив Windows-зависимости, локальные env и
SQLite. Команды выполняются из корня репозитория на Windows:

```powershell
$ProxyArchive = Join-Path $env:TEMP 'vpn-subscription-proxy-update.tar.gz'
tar -czf $ProxyArchive --exclude=node_modules --exclude=dist --exclude='.env*' --exclude='*.sqlite*' -C .\vpn-subscription-proxy .
if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать архив proxy' }
scp $ProxyArchive <ssh-user>@<vps-address>:/tmp/vpn-subscription-proxy-update.tar.gz
```

Затем на VPS соберите именно этот самостоятельный проект:

```bash
sudo install -d -o root -g root -m 0755 /opt/vpn-subscription-proxy
sudo tar -xzf /tmp/vpn-subscription-proxy-update.tar.gz -C /opt/vpn-subscription-proxy
cd /opt/vpn-subscription-proxy
sudo npm ci
sudo npm run typecheck
sudo npm test
sudo npm run build
sudo npm prune --omit=dev
sudo chown -R root:root /opt/vpn-subscription-proxy
sudo chmod -R a+rX /opt/vpn-subscription-proxy
```

`npm run build` здесь выполняется на VPS. Он не относится к сборке Android или
iOS MpeiApp.

### 4. Создать root-owned EnvironmentFile

При переносе VPS восстановите env и SQLite по
[инструкции переноса](UPDATING.md#перенос-на-другой-vps) до первого старта.
Существующий env не затирайте, `DEMO_COOLDOWN_HMAC_KEY` не генерируйте заново.
Для первой установки:

```bash
if ! sudo test -e /etc/dragonet-subscription-proxy.env; then
  sudo install -o root -g root -m 0600 /dev/null /etc/dragonet-subscription-proxy.env
fi
sudoedit /etc/dragonet-subscription-proxy.env
```

Для новой установки перенесите значения из [`.env.example`](.env.example)
в репозитории, заменив placeholder. Шаблон и реальные env не входят в архив
выше; его можно открыть локально. При переносе проверьте адрес/Token новой
панели и inbound ID, сохранив HMAC-ключ и прежний state. Основные строки:

```dotenv
PROXY_LISTEN_HOST=0.0.0.0
PROXY_LISTEN_PORT=8443
PROXY_REQUEST_PATH=/api/v1/subscription
VPN_PANEL_BASE_URL=https://panel.example.com:2053/panel-secret
VPN_PANEL_TOKEN=<S-UI-token>
VPN_DEMO_INBOUNDS=[12,13,15]
VPN_SUBSCRIPTION_PORT=443
VPN_SUBSCRIPTION_PATH_PREFIX=/sub
DEMO_COOLDOWN_HMAC_KEY=<output-of-openssl-rand-hex-32>
STATE_DIRECTORY=/var/lib/dragonet-subscription-proxy
```

Только для первой установки создайте новый HMAC-ключ:

```bash
openssl rand -hex 32
```

`VPN_DEMO_INBOUNDS` должен содержать только существующие активные demo
inbound ID панели. `VPN_SUBSCRIPTION_PORT` и `VPN_SUBSCRIPTION_PATH_PREFIX`
относятся к S-UI subscription URL, а `PROXY_LISTEN_PORT` — к этому HTTPS
proxy. Это разные порты.

### 5. Включить systemd и firewall

Используйте переменные из шага 2. Устанавливаются все три units и, для S-UI,
drop-in конкретного instance; базовый unit сохраняет совместимость с Certbot:

```bash
sudo install -o root -g root -m 0644 \
  /opt/vpn-subscription-proxy/deploy/dragonet-subscription-proxy@.service \
  /opt/vpn-subscription-proxy/deploy/dragonet-subscription-proxy-certificate-reload@.service \
  /opt/vpn-subscription-proxy/deploy/dragonet-subscription-proxy-certificate-reload@.path \
  /etc/systemd/system/
case "$CERTIFICATE_SOURCE" in
  s-ui)
    sudo install -d -o root -g root -m 0755 "$(dirname "$TLS_DROP_IN")"
    sudo install -o root -g root -m 0644 \
      /opt/vpn-subscription-proxy/deploy/s-ui-tls.conf "$TLS_DROP_IN"
    ;;
  letsencrypt) sudo rm -f "$TLS_DROP_IN" ;;
  *) echo 'CERTIFICATE_SOURCE must be s-ui or letsencrypt' >&2; exit 1 ;;
esac
sudo systemctl daemon-reload
sudo systemd-analyze verify "$SERVICE" "$WATCHER" "$RELOADER"
sudo systemctl enable --now "$SERVICE" "$WATCHER"
sudo systemctl status "$SERVICE" --no-pager
sudo systemctl status "$WATCHER" --no-pager
sudo ss -ltnp "( sport = :$PROXY_PORT )"
sudo ufw allow "$PROXY_PORT/tcp"
```

`RestrictAddressFamilies` в unit намеренно разрешает также `AF_NETLINK`.
Fastify запрашивает у Node список интерфейсов после привязки `0.0.0.0`; Linux
использует для этого именно это семейство, без открытия дополнительного сетевого
listener. Если proxy был установлен до этой правки и журнал содержит
`uv_interface_addresses ... error 97`, обновите unit и перезапустите service:

```bash
sudo install -o root -g root -m 0644 \
  /opt/vpn-subscription-proxy/deploy/dragonet-subscription-proxy@.service \
  /etc/systemd/system/dragonet-subscription-proxy@.service
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE"
sudo systemctl status "$SERVICE" --no-pager
```

Также откройте TCP 8443 в firewall провайдера VPS. Если выбран другой
`PROXY_LISTEN_PORT`, последняя команда и проверка `ss` должны использовать
его. `CAP_NET_BIND_SERVICE` в unit позволяет при необходимости использовать
и порт ниже 1024, но не освобождает уже занятый 443.

Шаблон `dragonet-subscription-proxy-certificate-reload@.path` следит за
Certbot и `/root/cert/<CERTIFICATE_NAME>`: каталогом, `fullchain.pem` и
`privkey.pem`. Замена файлов или запись на месте вызывает restart proxy,
и systemd перечитывает исходную пару. Отсутствие второго расположения
не мешает watcher; он не создаёт каталоги сертификатов. Дополнительный
deploy-hook не требуется. Watcher только подхватывает обновлённые файлы —
сам сертификаты он не продлевает.
[Поведение PathChanged](https://www.freedesktop.org/software/systemd/man/247/systemd.path.html).

Панель S-UI и `/apiv2/*` не должны быть доступны извне. Открывается только
выбранный порт proxy.

### 6. Проверить service и статистику на VPS

`/healthz` и `/stats` разрешены только с loopback. Проверка должна
использовать домен сертификата, чтобы пройти проверку SNI:

```bash
curl --fail --silent --show-error \
  --resolve "$PROXY_HOST:$PROXY_PORT:127.0.0.1" \
  "https://$PROXY_HOST:$PROXY_PORT/healthz"
curl --fail --silent --show-error \
  --resolve "$PROXY_HOST:$PROXY_PORT:127.0.0.1" \
  "https://$PROXY_HOST:$PROXY_PORT/stats"
sudo journalctl -u "$SERVICE" -n 50 --no-pager
```

Ожидаемый ответ: `{"status":"ok"}`. При ошибке запуска не ослабляйте
проверки discovery: проверьте A-запись, `notAfter` выбранной исходной пары,
её механизм продления и `$WATCHER`. Ошибка systemd `Failed to load
credentials` до запуска Node обычно означает неверный `CERTIFICATE_NAME`
или отсутствие S-UI drop-in. Проверьте `sudo systemctl cat "$SERVICE"`:
последние `LoadCredential` должны указывать на выбранный источник.
Сразу после запуска `/stats` вернёт нулевые счётчики и uptime, например:

```json
{
  "successfulVerifyRequests": 0,
  "successfulDemoRequests": 0,
  "failedRequests": 0,
  "uptime": {"days": 0, "hours": 0, "minutes": 0, "formatted": "0 суток 0 часов 0 минут"}
}
```

После PowerShell-проверок `verify` и `demo` ниже снова выполните команду
`curl .../stats` на VPS: успешные terminal-запросы отразятся в двух первых
счётчиках. Все значения намеренно обнуляются при рестарте service.
Журнал содержит JSON-события request_received/request_completed,
demo_created/demo_failed: итог, причина, стадия, коды HTTP/сети/SQLite,
очищенное сообщение отказа панели и HMAC IP/device. Body, Token,
клиентские имена, исходные IP/device и demo-ссылки не записываются.

## Проверка с текущего Windows-ноутбука

Выполняйте эти команды в **PowerShell текущего ноутбука**, когда DNS уже
виден снаружи. Укажите реальное доменное имя и порт proxy. Не используйте
`-SkipCertificateCheck`: корректный сертификат и SNI должны проверяться.

Сначала подготовьте общие значения. Windows использует системный ID часового
пояса `Russian Standard Time` для Москвы:

```powershell
$Moscow = [TimeZoneInfo]::FindSystemTimeZoneById('Russian Standard Time')
$MoscowDate = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $Moscow).ToString('dd-MM-yyyy')
$Endpoint = 'https://proxy.example.com:8443/api/v1/subscription'
```

### Verify

Подставьте имя **уже существующего** клиента S-UI в нормализованной форме.
Этот запрос ничего не меняет в панели.

```powershell
$VerifyClientName = 'replace-with-an-existing-normalised-client-name'
$VerifyHeaders = @{
  'Mpei-App-Req-Id' = "DragoNet-$MoscowDate-Windows-Verify-$([guid]::NewGuid().ToString('N'))"
}
$VerifyBody = @{ purpose = 'verify'; clientName = $VerifyClientName } |
  ConvertTo-Json -Compress
$VerifyResponse = Invoke-RestMethod -Method Post -Uri $Endpoint `
  -ContentType 'application/json' -Headers $VerifyHeaders -Body $VerifyBody
$VerifyResponse | ConvertTo-Json -Compress
```

Ожидается один из безопасных результатов:

```json
[
   {"reqStatus":"success","isClientFound":true,"isClientActive":true},
   {"reqStatus":"success","isClientFound":true,"isClientActive":false},
   {"reqStatus":"success","isClientFound":false,"isClientActive":false}
]
```

### Demo

Этот запрос **действительно создаёт** одно demo-подключение на 2 GiB и 3
суток, а затем блокирует совпадающие публичный IP или device ID на 14
суток. Используйте его только при осознанном приёмочном тесте и при
необходимости удалите тестового клиента из панели после проверки.

```powershell
$DemoHeaders = @{
  'Mpei-App-Req-Id' = "DragoNet-$MoscowDate-Windows-Demo-$([guid]::NewGuid().ToString('N'))"
}
$DemoBody = @{ purpose = 'demo' } | ConvertTo-Json -Compress
$DemoResponse = Invoke-RestMethod -Method Post -Uri $Endpoint `
  -ContentType 'application/json' -Headers $DemoHeaders -Body $DemoBody
if ($DemoResponse.reqStatus -ne 'success' -or [string]::IsNullOrWhiteSpace($DemoResponse.demoSubURL)) {
  throw 'Demo proxy test failed.'
}
$DemoResponse | ConvertTo-Json -Compress
```

Успешный ответ содержит только `reqStatus` и уникальный `demoSubURL`. Не
отправляйте эту ссылку в issue, лог или общий чат. Для отдельной проверки
gate можно повторить любой запрос с `Mpei-App-Req-Id = 'invalid'`: соединение
должно быть закрыто без HTTP-ответа.

## Обновление и откат

Для существующего VPS используйте [пошаговое обновление и откат](UPDATING.md).
Оно сохраняет env/HMAC/SQLite, собирает staging до остановки сервиса и
описывает совместимость старого приложения и nullable-колонки reserved_at.

`PROXY_LISTEN_PORT` должен совпадать с публичной константой
`DRAGONET_PROXY_PORT` в `src/config/Secrets.ts`. При этом обновлении
домен, порт, путь и значения конфигурации приложения менять не требуется,
если при переносе сохранён прежний публичный endpoint. Для уже выпущенной
2.5.0 сохраните тот же DNS-host/порт/путь и перенаправьте его A-запись на
новый VPS; сертификат должен подходить этому host. Замена самого endpoint
вместо DNS потребовала бы обновления конфигурации приложения.

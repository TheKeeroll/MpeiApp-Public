# Обновление и перенос vpn-subscription-proxy

Обновляется только самостоятельный серверный каталог. APK/IPA для этого
не нужны: новый proxy совместим с уже опубликованной MpeiApp 2.5.0.
Контракт запросов/ответов и `Mpei-App-Req-Id` не меняются. Для совместимости
при переносе сохраните прежние публичные DNS-host, порт и путь; меняется
A-запись на IPv4 нового VPS. Новый сертификат должен включать прежний host.
Новые сообщения об ошибках и offline появятся после обновления самого приложения.
Сборка proxy ниже выполняется вами на VPS; при подготовке изменений она не запускалась.

## Автоматический способ

Для установки и обновления используйте
[единый deploy/install.sh](README.md#автоматическая-установка-и-обновление).
Передайте новый tar, распакуйте во временный каталог и запустите скрипт
от root. Он запрашивает настройки, сохраняет текущие значения/ключ,
сам выполняет тесты/build, backup, замену кода, настройку systemd и HTTPS-проверки.
При нескольких подходящих сертификатах предлагается выбор.

Если proxy ранее установлен вручную, скрипт читает стандартный env и находит
работающий/включённый instance. Для нестандартного env укажите его путь в
первом вопросе. После первого запуска пути хранятся в
`/etc/dragonet-subscription-proxy-installation.json`; дополнительные env-поля
сохраняются, Token не показывается. Установщик рассчитан на одну установку
proxy, а не на несколько независимых одновременно работающих instances.

Сбой подготовки не останавливает текущий proxy. После начала замены
предусмотрено восстановление кода/env/units и прежнего состояния запуска.
SQLite сохраняет актуальные выдачи; старый snapshot не подменяет живую БД.
Скрипт возвращает ошибку, если установка/проверки не удались; проверьте journal
после сообщения о восстановлении, особенно при сетевой проблеме/продлении TLS.

Резервный каталог автоматического способа содержит `files.json`, `file-N`,
`services.json`, `deployment.json`, `candidate.env` и snapshot `state/`.
`candidate.env` — закрытая конфигурация попытки, включая HMAC; при ручном
восстановлении ориентируйтесь на пути/режимы в JSON. Прежний код сохраняется
рядом как `.previous-<дата>`, неудачный новый — как `.failed-<дата>`.
Это другой формат, чем `systemd.tar.gz` ручного способа ниже.

Пути кода/env/state могут настраиваться, но они должны быть раздельными
абсолютными путями без symlink, пробелов и системных корней. Установщик
не меняет владельца посторонних данных. Продление сертификатов остаётся
за Certbot/acme.sh; installer и watcher не выпускают сертификаты.

На новом VPS сначала перенесите env/HMAC/SQLite по разделу ниже. При
нестандартных путях перенесите также файл метаданных установки и фактические
env/state из него. При необходимости можно выбрать новые пути в мастере.
Ранее установленный `30-installation.conf` настраивает и TLS, и пути:
последующие обновления выполняйте тем же скриптом. Ручные команды ниже
предназначены для прежнего ручного способа.

## Исправление 20.10.2026: невидимые вопросы в SSH/PuTTY

После устранения ошибки пустого списка units обнаружена следующая причина
видимого «зависания» этапа 2: вопрос печатался отдельно от `readline`, а его
ANSI-перерисовка стирала эту строку. Установщик продолжал ожидать ввода.
Теперь текст вопроса передаётся непосредственно в `readline.question`,
показывается жёлтым с префиксом `[ВВОД]` и остаётся видимым при редактировании.
У секретных полей скрывается только вводимое значение, а не сам вопрос.
Существующие секреты не показываются; Enter сохраняет их, Ctrl+C отменяет ввод.

На этапе 2 добавлены сообщения `[ДЕЙСТВИЕ]` перед поиском units, проверкой их
состояния, чтением env, проверкой путей/state и подготовкой пользователя.
Теперь ожидание команды можно отличить от ожидания ответа.

Передайте обновлённый tar и повторите запуск из нового временного каталога
по инструкции выше. Установленные пакеты и ранее сохранённый env/HMAC
используются повторно. Вводить настройки вслепую или удалять их не требуется.

Typecheck и **85 tests** успешны. Новые проверки используют настоящий Node
readline с потоками, имитирующими TTY: `TERM=xterm`/`dumb`, ANSI-перерисовка,
узкое окно, редактирование, defaults, отсутствие эха секретов и отмена/EOF.
Дополнительно вручную проверены видимый обычный вопрос и скрытый ввод
синтетического Token в интерактивном терминале с `TERM=xterm`.
Полный root/systemd-запуск по-прежнему проверяется на VPS.

## Исправление 20.10.2026: чистая установка на systemd 247

Исправлен останов на этапе 2 до вопросов настройки. При отсутствии proxy
units `systemctl list-unit-files` в
[systemd 247](https://github.com/systemd/systemd/blob/v247/src/systemctl/systemctl-list-unit-files.c#L246)
возвращает код 1 без stdout/stderr. Теперь такой результат означает пустой
список, после чего установщик также проверяет загруженные instances и
продолжает первичную настройку. Ошибки D-Bus, доступа, запуска команды и
таймауты по-прежнему останавливают установку. Диагностика указывает подкоманду.

Передайте новый tar целиком и повторите запуск по
[автоматической инструкции](README.md#автоматическая-установка-и-обновление)
из нового временного каталога. Установленные на этапе 1 пакеты используются
повторно; сбрасывать env, SQLite или настройки systemd не требуется.

Убраны отмеченные Code Analysis локально перехватываемые `throw`: парсинг
и проверка результата разделены без изменения правил валидации. Watcher
использует штатный запуск одноимённого `.service` вместо избыточного `Unit=`;
источник сертификатов и instance сохраняются.

Typecheck и **76 tests** успешны, включая чистую установку/повтор с ответами
systemd 247, обнаружение существующих instances, реальные ошибки команд,
проверку symlink и валидацию URL/inbounds. Сохранён HTTP-тест совместимости
с MpeiApp 2.5.0. Системные команды в этих тестах подменены; окончательная
приёмка полного установщика выполняется на VPS.

## Дополнение 19.10.2026: сертификаты S-UI

Startup discovery теперь проверяет `/root/cert/` и его непосредственные
подкаталоги, в том числе пару
`/root/cert/<имя>/{fullchain.pem,privkey.pem}` от `s-ui.sh`.
Проверки срока, соответствия ключа, SAN/CN и DNS/IP остаются прежними.

В systemd базовый unit сохраняет Certbot-пути. Для S-UI устанавливается
[s-ui-tls.conf](deploy/s-ui-tls.conf) как drop-in конкретного instance:
он сбрасывает прежние `LoadCredential` и задаёт `/root/cert/%i/`.
PID 1 читает root-only ключ и передаёт временный read-only snapshot
пользователю `dragonet-proxy`. Расширять права `/root`, копировать ключ в
каталог приложения или запускать Node от root не требуется.

Watcher теперь отслеживает оба источника — Certbot и S-UI/acme.sh.
При обновлении устанавливайте **все три units**, а для S-UI — также drop-in,
как показано ниже. Новых обязательных env, зависимостей или миграций SQLite для TLS нет.
Клиент MpeiApp 2.5.0 получает прежние HTTPS-ответы.

Локально прошли typecheck и **68 tests**: прежние HTTP/SQLite-проверки,
синтетические TLS-пары, выбор S-UI/Certbot и multi-SAN, приоритет выбранных
credentials, env со спецсимволами, файловое восстановление, перенос SQLite
без старого WAL и ошибки этапов установки/отката. Также проходит прежний
HTTP-тест совместимости 2.5.0. Bash проверен `bash -n` и ShellCheck 0.11.0;
скрытый ввод проверен в терминале. Установщик проверялся без установки пакетов
и запуска systemd в Windows — реальная установка/build и HTTPS-приёмка
выполняются на VPS.

## Исправление 17.10.2026: полный config S-UI 1.6.5

Предыдущее дополнение naive/snell передавало `naive.name`, что при Naive-inbound
вызывало `users[11].name: json: unknown field "name"`. Теперь у Naive используется
`username` без `name`, как и у mixed/socks/http. У остальных секций остаётся `name`.
Proxy создаёт полный config из **15 секций**, включая отдельные base64-ключи
Shadowsocks из 32/16 случайных байт, VMess с `alterId: 0` и Hysteria с `auth_str`.
Общий пароль и UUID согласованы между протоколами; Snell сохраняет отдельный
случайный `userkey` из 32 латинских букв/цифр. Поля перечислены в
[контракте для proxy](S_UI_API_V2_1_6_5_CONTRACT.md).

Повторите процедуру ниже с новым архивом исходников. Дополнительные env,
зависимости и миграции SQLite для этого дополнения не требуются; контракт
MpeiApp, включая 2.5.0, остаётся прежним. После обновления проверьте в панели
полный config нового demo-клиента: 15 секций, `naive.username` без `naive.name`,
правильные имена/credentials и доступ через выбранные inbounds. Через API
полный config читается запросом `GET /apiv2/clients?id=<ID>`; общий список
без `id` его не возвращает. Ранее выданные demo-клиенты автоматически не изменяются.

В предоставленном отчёте также обнаружен отдельный дефект hot-reload Naive:
ошибка `close inbound/naive[...]: ... use of closed network connection`.
Он возможен и с корректным config и требует проверки состояния Naive в панели;
эта доработка исправляет состав credentials. Автоматического повтора POST нет,
поскольку отказ API может сопровождаться изменением runtime listener.

## Контракт и SQLite

Успешные ответы остались прежними. Все обработанные HTTP-отказы по-прежнему
имеют статус 200 и `reqStatus: "failed"`; добавлено только `reason`:

```json
[
   {"reqStatus": "failed", "reason": "demo_cooldown"},
   {"reqStatus": "failed", "reason": "service_error"}
]
```

`demo_cooldown` означает найденную запись **issued** для IP или устройства.
`service_error` — проблему панели, транспорта, SQLite, ограничение частоты,
некорректный запрос или неопределённую прошлую попытку создания. Подробности
остаются в journal. Парсер 2.5.0 проверяет `reqStatus` и игнорирует новые поля;
его старый общий Alert при отказе останется до обновления приложения.

Новые записи действуют ровно **14 × 24 часа**. При первом запуске новой версии
nullable-колонка `reserved_at` добавляется автоматически. Существующие `issued`
с известным `issued_at` получают `min(старый срок, issued_at + 14 суток)`;
перезапуск не продлевает их. История и HMAC не сбрасываются. Старый код умеет
работать с этой добавочной колонкой, поэтому обычный откат кода не требует
отката БД.

У старых **reservation** время создания отсутствует: известен лишь прежний
deadline, причём календарное прибавление месяца не всегда обратимо.
Их deadline сохранён. В журнале они видны как `reservation_pending` с
`legacyReservation: true`; приложение получает техническую ошибку, а не cooldown.
Новые неопределённые попытки также сохраняют reservation, уже на 14 суток.
Это исключает вторую выдачу, если панель создала клиента, но её ответ потерялся.
Явный JSON-отказ S-UI `success:false` освобождает только собственную reservation.

Не удаляйте SQLite и не меняйте `DEMO_COOLDOWN_HMAC_KEY`: это обнулит защиту
от повторных выдач. Если журнал показывает pending после сбоя панели, сначала
проверьте фактическое состояние S-UI. Нельзя автоматически удалять все reservation:
среди них могут быть успешно созданные клиенты с потерянным ответом.

## Перенос на другой VPS

На новом VPS сначала выполните подготовку пользователя/Node и выбор TLS-пары
из [первичной инструкции](README.md#развёртывание-на-debian-111213).
Не запускайте proxy до восстановления state. Если старый VPS ещё доступен,
перенесите **оба** объекта: EnvironmentFile с прежним HMAC-ключом и весь
`/var/lib/dragonet-subscription-proxy`, включая возможные WAL/SHM.
Стандартные пути приведены ниже; для изменённого `STATE_DIRECTORY`
подставьте фактический каталог в команды упаковки/восстановления.

На **старом VPS**, из обычной SSH-сессии:

```bash
export OLD_CERTIFICATE_NAME='proxy.example.com'
export PRIVATE_TRANSFER="$(mktemp -d)"
chmod 0700 "$PRIVATE_TRANSFER"
sudo systemctl stop \
  "dragonet-subscription-proxy-certificate-reload@$OLD_CERTIFICATE_NAME.path" \
  "dragonet-subscription-proxy-certificate-reload@$OLD_CERTIFICATE_NAME.service" \
  "dragonet-subscription-proxy@$OLD_CERTIFICATE_NAME.service"
sudo tar -czf "$PRIVATE_TRANSFER/dragonet-proxy-state.tar.gz" -C / \
  etc/dragonet-subscription-proxy.env var/lib/dragonet-subscription-proxy
sudo chown "$(id -u):$(id -g)" "$PRIVATE_TRANSFER/dragonet-proxy-state.tar.gz"
chmod 0600 "$PRIVATE_TRANSFER/dragonet-proxy-state.tar.gz"
scp "$PRIVATE_TRANSFER/dragonet-proxy-state.tar.gz" \
  <ssh-user>@<new-vps-address>:dragonet-proxy-state.tar.gz
```

Это закрытый архив с секретами и БД, в отличие от архива исходников.
Он передаётся только по SSH и не добавляется в репозиторий. Старый proxy
после снимка не запускайте: новые выдачи иначе остались бы только в старой БД.

На **новом VPS**, после создания пользователя `dragonet-proxy` и до первого
старта сервиса:

```bash
chmod 0600 "$HOME/dragonet-proxy-state.tar.gz"
sudo tar -xzf "$HOME/dragonet-proxy-state.tar.gz" -C /
sudo chown root:root /etc/dragonet-subscription-proxy.env
sudo chmod 0600 /etc/dragonet-subscription-proxy.env
sudo chown -R dragonet-proxy:dragonet-proxy /var/lib/dragonet-subscription-proxy
sudo chmod 0700 /var/lib/dragonet-subscription-proxy
sudoedit /etc/dragonet-subscription-proxy.env
```

Сохраните `DEMO_COOLDOWN_HMAC_KEY`; адрес/Token и inbound ID панели проверьте
для новой инфраструктуры. Дальше продолжите первичную установку с шагов 3–6,
выбрав нужный TLS-источник. Прежние `issued` и `reservation` сохраняются,
данные в панели этим переносом не изменяются.

Если старого VPS и резервной копии больше нет, прежнюю историю запретов
demo восстановить невозможно. Это не требует изменения клиента, но новый
state будет пустым — существующую копию не заменяйте пустой базой.

## 1. Передать код с Windows

В корне репозитория выполните PowerShell-команды. Архив содержит текущие
изменения, в том числе ещё не закоммиченные; Windows-зависимости и env исключены.

```powershell
$ProxyArchive = Join-Path $env:TEMP 'vpn-subscription-proxy-update.tar.gz'
tar -czf $ProxyArchive --exclude=node_modules --exclude=dist --exclude='.env*' --exclude='*.sqlite*' -C .\vpn-subscription-proxy .
if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать архив proxy' }
scp $ProxyArchive <ssh-user>@<vps-address>:/tmp/vpn-subscription-proxy-update.tar.gz
```

## 2. Подготовить новый каталог на VPS

Далее описано обновление уже установленного proxy на том же VPS. Для пустого
нового VPS используйте раздел переноса и README. Ниже — штатные пути из unit;
для изменённых установки/state используйте фактические каталоги. Node — 24.x.
Укажите текущий источник и имя каталога сертификата; имя systemd instance
сохраните прежним, если источник не менялся.

```bash
export CERTIFICATE_SOURCE='s-ui' # либо letsencrypt для существующего Certbot
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
export UPDATE_ID="$(date -u +%Y%m%dT%H%M%SZ)"
export STAGING="/opt/vpn-subscription-proxy.release-$UPDATE_ID"
export PREVIOUS="/opt/vpn-subscription-proxy.previous-$UPDATE_ID"
export STATE_BACKUP="/var/backups/dragonet-subscription-proxy/$UPDATE_ID"

node --version
sudo test -r "$CERTIFICATE_DIRECTORY/privkey.pem"
sudo openssl x509 -in "$CERTIFICATE_DIRECTORY/fullchain.pem" \
  -noout -subject -dates -ext subjectAltName
sudo openssl x509 -in "$CERTIFICATE_DIRECTORY/fullchain.pem" -noout -checkend 0
sudo install -d -o root -g root -m 0755 "$STAGING"
sudo tar -xzf /tmp/vpn-subscription-proxy-update.tar.gz -C "$STAGING"
cd "$STAGING"
sudo npm ci
sudo npm run typecheck
sudo npm test
sudo npm run build
sudo npm prune --omit=dev
sudo chown -R root:root "$STAGING"
sudo chmod -R a+rX "$STAGING"
```

`CERTIFICATE_NAME` — имя существующего каталога сертификата/instance
(у Certbot бывает суффикс `-0001`), а `PROXY_HOST` — фактическое DNS-имя
из SAN. Они могут различаться; для HTTPS-проверок используется `PROXY_HOST`.
Переменные этого блока относятся только к командам установки, не к env proxy.

До успешного завершения этих команд работающий сервис не останавливайте.
Зависимости устанавливаются на Linux, чтобы получить подходящий better-sqlite3.

## 3. Остановить, сохранить state и заменить код

Остановите watcher, чтобы обновление сертификата не перезапустило proxy
во время замены каталога. SQLite копируется только после остановки процесса:
вместе с БД сохраняются возможные WAL/SHM и права. Env и systemd-конфигурация
сохраняются отдельно в root-only каталоге; содержимое env не выводится.

```bash
cd /opt
sudo systemctl stop "$WATCHER" "$RELOADER"
sudo systemctl stop "$SERVICE"
sudo install -d -o root -g root -m 0700 "$STATE_BACKUP"
sudo cp -a /var/lib/dragonet-subscription-proxy "$STATE_BACKUP/state"
sudo cp -a /etc/dragonet-subscription-proxy.env "$STATE_BACKUP/environment.env"
sudo tar -czf "$STATE_BACKUP/systemd.tar.gz" -C /etc/systemd/system \
  dragonet-subscription-proxy@.service \
  dragonet-subscription-proxy-certificate-reload@.service \
  dragonet-subscription-proxy-certificate-reload@.path
if sudo test -d "/etc/systemd/system/$SERVICE.d"; then
  sudo cp -a "/etc/systemd/system/$SERVICE.d" "$STATE_BACKUP/instance-drop-ins"
fi

sudo mv /opt/vpn-subscription-proxy "$PREVIOUS"
sudo mv "$STAGING" /opt/vpn-subscription-proxy
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
sudo systemctl start "$SERVICE"
sudo systemctl start "$WATCHER"
sudo systemctl status "$SERVICE" --no-pager
```

Не запускайте установку «с нуля» с заменой EnvironmentFile. Новых обязательных
env-переменных нет, Token, inbound ID, HMAC и state path остаются прежними.
Unit направляет stdout/stderr в journal; LoadCredential и защита файловой
системы сохранены. Если раньше использовались собственные drop-in для TLS,
проверьте `sudo systemctl cat "$SERVICE"`: последние источники credentials
должны относиться к выбранной паре. Watcher отслеживает оба штатных каталога,
а продление выполняет прежний Certbot либо acme.sh, не сам proxy.

## 4. Проверить сервер и совместимость

```bash
curl --fail --silent --show-error \
  --resolve "$PROXY_HOST:$PROXY_PORT:127.0.0.1" \
  "https://$PROXY_HOST:$PROXY_PORT/healthz"
curl --fail --silent --show-error \
  --resolve "$PROXY_HOST:$PROXY_PORT:127.0.0.1" \
  "https://$PROXY_HOST:$PROXY_PORT/stats"
sudo journalctl -u "$SERVICE" -n 80 --no-pager -o cat
```

Ожидаются `{"status":"ok"}` и обычная статистика; её счётчики после рестарта
обнуляются. При ошибке discovery проверяйте DNS, выбранную исходную пару
и её продление по [основной инструкции](README.md), не отключая TLS-проверки.
Если Node не запускается и systemd пишет `Failed to load credentials`,
проверьте имя каталога/instance и наличие S-UI drop-in. Одна правка TypeScript
без обновления units эту проблему не устраняет.

Затем используйте [PowerShell-примеры verify/demo](README.md#проверка-с-текущего-windows-ноутбука):

1. Verify существующего активного, неактивного и отсутствующего клиента:
   прежние `reqStatus`, `isClientFound`, `isClientActive`, HTTP 200.
2. На установленной **2.5.0** проверить подписку: успешное предоставление
   привилегий должно сохраниться. Обычная проверка подписки не создаёт demo.
3. Если выполняете demo-проверку, она действительно создаст клиента на
   **2 GiB / 3 суток** и заблокирует совпадающие IP/устройство на 14 суток.
   Сохраните тот же `$DemoHeaders`: первый запрос вернёт ссылку, повтор —
   `{"reqStatus":"failed","reason":"demo_cooldown"}`. Удаление тестового клиента
   из S-UI не удаляет cooldown из SQLite.
4. На **новой MpeiApp** проверить offline/подключение без интернета — HTTP-запрос
   demo не отправляется. При доступном proxy с технической проблемой появляется
   извинение и предложение попробовать позже; только cooldown сообщает о двух неделях.
   Неизвестный старый ответ `{"reqStatus":"failed"}` трактуется как техническая ошибка.
5. Реальную панель намеренно не ломайте: HTTP 503, тайм-аут, неверный JSON,
   отказ S-UI, сохранение reservation и ошибки БД покрыты изолированными тестами.

## Чтение journal

```bash
sudo journalctl -u "$SERVICE" -f -o cat
# Если установлен jq — только терминальные результаты и неудачные demo:
sudo journalctl -u "$SERVICE" --since '30 minutes ago' -o cat --no-pager \
  | jq -Rc 'fromjson? | select(.event == "request_completed" or .event == "demo_failed")'
```

После корректного заголовка появляется `request_received` с `headerAccepted:true`,
серверным requestId и HMAC IP/device; затем один `request_completed` с
`outcome`, `reason`, `purpose`, `statusCode` и длительностью. Неверный заголовок
остаётся без ответа и без записи. Служебные loopback `/healthz` и `/stats`
не создают request-аудит. Неверные Host/SNI/method/path после допуска заголовка
закрывают socket и получают `statusCode:0` с конкретной причиной.

Пример неудачной попытки создания (фиктивные идентификаторы):

```json
{"event":"demo_failed","requestId":"req-a","reason":"service_error","stage":"panel_create","category":"panel_http_error","endpoint":"/apiv2/save","httpStatus":503,"reservationRetained":true}
```

Основные причины:

| Поле/значение | Значение для оператора |
| --- | --- |
| `demo_cooldown`, `blocking[].state=issued` | Запрет подтверждённой повторной выдачи; `expiresAt` — deadline в Unix milliseconds |
| `reservation_pending` | Результат прошлой попытки неизвестен, повторное создание не выполнялось |
| `panel_rejected` | Явный отказ S-UI, есть очищенный `panelMessage`; собственная reservation снята |
| `panel_http_error`, `httpStatus` | Ошибка HTTP панели; результат создания считается неопределённым |
| `panel_timeout` / `panel_network_error`, `code` | Тайм-аут, DNS/TLS/соединение; сырой Error.message не записывается |
| `panel_invalid_json` / `panel_invalid_response` | Ответ не JSON или не содержит явного boolean success |
| `stage=reserve/commit/release`, `SQLITE_*` | Сбой чтения/фиксации/снятия reservation, `reservationRetained` отражает консервативное сохранение |
| `invalid_body/invalid_json/body_too_large/unsupported_content_type` | Запрос отвергнут до обращения к панели |
| `rate_limited` | Превышен краткосрочный лимит запросов, это не двухнедельный cooldown |
| `client_disconnected/request_aborted/connection_timeout` | Соединение завершилось до ответа; итог обработки панели может появиться позже |

`demo_created` фиксирует подтверждённую выдачу без самой ссылки, даже если
клиент разорвал соединение до получения ответа. Записи одного запроса
сопоставляются по requestId; время journal отделяет запуски с повторившимися ID.
Полные header/body, IP/device, clientName, Token, UUID/password/userkey и demoSubURL
не записываются. Сообщение явного отказа панели ограничено 512 символами,
из него удаляются известные секреты и URL; неструктурированные сетевые ошибки
представлены только безопасной категорией/кодом.

## Откат

При неудачном запуске остановите watcher и service. Верните прежний код и
сохранённые systemd units/drop-in;
БД оставьте текущей: старый код понимает добавочную колонку. Восстановление
старого snapshot потеряло бы выдачи, сделанные после обновления.

```bash
sudo systemctl stop "$WATCHER" "$RELOADER" "$SERVICE"
export FAILED="/opt/vpn-subscription-proxy.failed-$UPDATE_ID"
sudo mv /opt/vpn-subscription-proxy "$FAILED"
sudo mv "$PREVIOUS" /opt/vpn-subscription-proxy
sudo tar -xzf "$STATE_BACKUP/systemd.tar.gz" -C /etc/systemd/system
sudo rm -f "$TLS_DROP_IN"
if sudo test -d "$STATE_BACKUP/instance-drop-ins"; then
  sudo install -d -o root -g root -m 0755 "/etc/systemd/system/$SERVICE.d"
  sudo cp -a "$STATE_BACKUP/instance-drop-ins/." "/etc/systemd/system/$SERVICE.d/"
fi
sudo systemctl daemon-reload
sudo systemctl start "$SERVICE" "$WATCHER"
sudo systemctl status "$SERVICE" --no-pager
```

Само TLS-дополнение не меняет cooldown и схему БД. Политика новых выдач после
отката определяется возвращённой версией кода. Резервная копия state
предназначена для отдельного восстановления при повреждении БД, после сверки
фактически созданных клиентов, а не для обычного отката кода.

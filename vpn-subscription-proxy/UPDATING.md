# Обновление proxy: journal, demo на 14 суток и совместимость с MpeiApp 2.5.0

Обновляется только самостоятельный серверный каталог. APK/IPA для этого
не нужны: новый proxy совместим с уже опубликованной MpeiApp 2.5.0.
Домен, порт, путь, TLS discovery и `Mpei-App-Req-Id` не меняются.
Новые сообщения об ошибках и offline появятся после обновления самого приложения.
Сборка proxy ниже выполняется вами на VPS; при подготовке изменений она не запускалась.

## Контракт и SQLite

Успешные ответы остались прежними. Все обработанные HTTP-отказы по-прежнему
имеют статус 200 и `reqStatus: "failed"`; добавлено только `reason`:

```json
{"reqStatus":"failed","reason":"demo_cooldown"}
{"reqStatus":"failed","reason":"service_error"}
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

Ниже используются штатные пути из unit. Подставьте существующее имя Certbot
instance и порт. Если меняли пути установки/state, используйте свои фактические
пути и сохраняйте прежний state directory. Node должен оставаться версии 24.

```bash
export CERTBOT_NAME='proxy.example.com'
export PROXY_HOST='proxy.example.com'
export PROXY_PORT='8443'
export SERVICE="dragonet-subscription-proxy@$CERTBOT_NAME.service"
export WATCHER="dragonet-subscription-proxy-certificate-reload@$CERTBOT_NAME.path"
export RELOADER="dragonet-subscription-proxy-certificate-reload@$CERTBOT_NAME.service"
export UPDATE_ID="$(date -u +%Y%m%dT%H%M%SZ)"
export STAGING="/opt/vpn-subscription-proxy.release-$UPDATE_ID"
export PREVIOUS="/opt/vpn-subscription-proxy.previous-$UPDATE_ID"
export STATE_BACKUP="/var/backups/dragonet-subscription-proxy/$UPDATE_ID"

node --version
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

`CERTBOT_NAME` — имя существующего каталога сертификата/instance (иногда
с суффиксом `-0001`), а `PROXY_HOST` — фактическое DNS-имя proxy из SAN.
Они могут различаться; для HTTPS-проверок ниже используется `PROXY_HOST`.

До успешного завершения этих команд работающий сервис не останавливайте.
Зависимости устанавливаются на Linux, чтобы получить подходящий better-sqlite3.

## 3. Остановить, сохранить state и заменить код

Остановите watcher, чтобы обновление сертификата не перезапустило proxy
во время замены каталога. SQLite копируется только после остановки процесса:
вместе с БД сохраняются возможные WAL/SHM и права. Env сохраняется отдельно
в root-only каталоге; его содержимое не выводится в терминал.

```bash
cd /opt
sudo systemctl stop "$WATCHER" "$RELOADER"
sudo systemctl stop "$SERVICE"
sudo install -d -o root -g root -m 0700 "$STATE_BACKUP"
sudo cp -a /var/lib/dragonet-subscription-proxy "$STATE_BACKUP/state"
sudo cp -a /etc/dragonet-subscription-proxy.env "$STATE_BACKUP/environment.env"

sudo mv /opt/vpn-subscription-proxy "$PREVIOUS"
sudo mv "$STAGING" /opt/vpn-subscription-proxy
sudo install -o root -g root -m 0644 \
  /opt/vpn-subscription-proxy/deploy/dragonet-subscription-proxy@.service \
  /etc/systemd/system/dragonet-subscription-proxy@.service
sudo systemctl daemon-reload
sudo systemctl start "$SERVICE"
sudo systemctl start "$WATCHER"
sudo systemctl status "$SERVICE" --no-pager
```

Не запускайте установку «с нуля» с заменой EnvironmentFile. Новых обязательных
env-переменных нет, Token, inbound ID, HMAC и state path остаются прежними.
Новый unit явно направляет stdout/stderr в journal; LoadCredential и защита
файловой системы сохранены. Миграция SQLite выполняется до открытия listener.

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
обнуляются. При ошибке discovery проверяйте DNS, исходный сертификат и
Certbot по [основной инструкции](README.md), не отключая TLS-проверки.

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
Полные header/body, IP/device, clientName, Token, UUID/password и demoSubURL
не записываются. Сообщение явного отказа панели ограничено 512 символами,
из него удаляются известные секреты и URL; неструктурированные сетевые ошибки
представлены только безопасной категорией/кодом.

## Откат

При неудачном запуске остановите watcher и service. Верните прежний код и unit;
БД оставьте текущей: старый код понимает добавочную колонку. Восстановление
старого snapshot потеряло бы выдачи, сделанные после обновления.

```bash
sudo systemctl stop "$WATCHER" "$RELOADER" "$SERVICE"
export FAILED="/opt/vpn-subscription-proxy.failed-$UPDATE_ID"
sudo mv /opt/vpn-subscription-proxy "$FAILED"
sudo mv "$PREVIOUS" /opt/vpn-subscription-proxy
sudo install -o root -g root -m 0644 \
  /opt/vpn-subscription-proxy/deploy/dragonet-subscription-proxy@.service \
  /etc/systemd/system/dragonet-subscription-proxy@.service
sudo systemctl daemon-reload
sudo systemctl start "$SERVICE" "$WATCHER"
sudo systemctl status "$SERVICE" --no-pager
```

Прежняя версия снова будет выдавать новые cooldown по своей месячной политике;
уже сокращённые сроки не восстанавливаются автоматически. Резервная копия state
предназначена для отдельного восстановления при повреждении БД, после сверки
фактически созданных клиентов, а не для обычного отката кода.

# vpn-subscription-proxy

Автономный HTTPS-сервис для MpeiApp и DragoNet. Он принимает только два
запроса на `PROXY_REQUEST_PATH`:

- `verify` получает статус клиента через `GET /apiv2/clients` панели S-UI;
- `demo` создаёт нового S-UI клиента через form-data `POST /apiv2/save` и
  возвращает разовую ссылку подписки.

Сервис не является частью React Native-проекта. Панельный Token, TLS-ключи,
данные клиентов, исходные IP и идентификаторы устройств не входят в Git и не
передаются в MpeiApp. SQLite содержит только HMAC IP/device, время выдачи,
окончание cooldown и состояние reservation/issued.

`demo` создаёт клиента с лимитом **2 GiB** и `expiry` ровно через **3 суток**.
Повторная выдача блокируется на один календарный месяц по Москве как по IP,
так и по устройству. Неопределённый результат панели сохраняет reservation,
чтобы после сбоя не выдать второй demo-доступ.

## Что проверяется на старте

До открытия публичного listener сервис:

1. Запрашивает IPv4 у `api.ipify.org`, `ifconfig.me/ip` и `icanhazip.com`.
   Нужны как минимум два одинаковых глобальных IPv4.
2. Ищет пары `fullchain.pem` + `privkey.pem` в
   `/etc/letsencrypt/live/*/`, раскрывает symlink и проверяет чтение,
   соответствие сертификата ключу, срок действия и SAN/CN.
3. При отсутствии подходящей пары ограниченно проверяет `/etc/ssl`,
   `/etc/nginx/ssl`, `/opt/*/ssl`, `/root/{fullchain.pem,privkey.pem}`,
   `/root/{cert.pem,key.pem}` и один уровень `/root/.acme.sh`.
4. Принимает только конкретное DNS-имя из сертификата, чей единственный A
   record совпадает с IPv4 из голосования. Wildcard сам по себе не подходит.

При любой неудаче listener не открывается. Сервис сам завершает TLS и
сверяет SNI и Host с обнаруженным именем; обычный Nginx с TLS termination
перед ним использовать нельзя.

## Развёртывание на Debian 11/12

Команды ниже выполняются на VPS от пользователя с `sudo`. Заменяйте только
явные примеры `proxy.example.com`, имена сертификатов и значения env-файла.

### 1. Подготовить DNS, Node и сервисного пользователя

Создайте отдельное имя, например `proxy.example.com`. Его единственная
A-запись должна указывать на публичный IPv4 VPS. Порт 443 уже занят, поэтому
proxy ниже слушает `8443`; DNS от номера порта не зависит.

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg build-essential python3
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node --version
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin dragonet-proxy
```

`node --version` должен вывести версию 24.x. `build-essential` нужен на
случай, если `better-sqlite3` будет собран из исходного кода для архитектуры
VPS.

### 2. Подготовить сертификат, доступный сервису

Нужен действующий сертификат именно для `proxy.example.com`. Если Certbot уже
выпускает такой сертификат, используйте его. Для нового сертификата выберите
подходящий для инфраструктуры способ Certbot (HTTP-01 требует доступного
порта 80, DNS-01 его не требует).

Закрытый ключ Let’s Encrypt обычно читает только root. Сделайте ограниченную
копию в разрешённом discovery-каталоге `/etc/ssl`; она читается только root и
группой proxy:

```bash
export CERTBOT_NAME='proxy.example.com'
sudo install -d -o root -g dragonet-proxy -m 0750 /etc/ssl/dragonet-subscription-proxy
sudo install -o root -g dragonet-proxy -m 0640 \
  "/etc/letsencrypt/live/$CERTBOT_NAME/fullchain.pem" \
  /etc/ssl/dragonet-subscription-proxy/fullchain.pem
sudo install -o root -g dragonet-proxy -m 0640 \
  "/etc/letsencrypt/live/$CERTBOT_NAME/privkey.pem" \
  /etc/ssl/dragonet-subscription-proxy/privkey.pem
sudo -u dragonet-proxy test -r /etc/ssl/dragonet-subscription-proxy/fullchain.pem
sudo -u dragonet-proxy test -r /etc/ssl/dragonet-subscription-proxy/privkey.pem
```

Создайте deploy-hook Certbot, чтобы при продлении обновлялась копия и сервис
заново проходил discovery. В скрипте замените `proxy.example.com` на своё
имя:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/dragonet-subscription-proxy.sh >/dev/null <<'EOF'
#!/bin/sh
set -eu

case " ${RENEWED_DOMAINS:-} " in
  *" proxy.example.com "*) ;;
  *) exit 0 ;;
esac

install -o root -g dragonet-proxy -m 0640 \
  "$RENEWED_LINEAGE/fullchain.pem" \
  /etc/ssl/dragonet-subscription-proxy/fullchain.pem
install -o root -g dragonet-proxy -m 0640 \
  "$RENEWED_LINEAGE/privkey.pem" \
  /etc/ssl/dragonet-subscription-proxy/privkey.pem
systemctl try-restart dragonet-subscription-proxy.service
EOF
sudo chmod 0750 /etc/letsencrypt/renewal-hooks/deploy/dragonet-subscription-proxy.sh
```

Не добавляйте пути к сертификату в env: startup discovery специально не
принимает произвольные пути.

### 3. Установить код и зависимости

Скопируйте каталог `vpn-subscription-proxy` из этого репозитория на VPS. С
текущего Windows-ноутбука это можно сделать встроенным OpenSSH-клиентом:

```powershell
scp -r .\vpn-subscription-proxy <ssh-user>@<vps-address>:/tmp/
```

Затем на VPS соберите именно этот самостоятельный проект:

```bash
sudo install -d -o root -g root -m 0755 /opt/vpn-subscription-proxy
sudo rsync -a --delete /tmp/vpn-subscription-proxy/ /opt/vpn-subscription-proxy/
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

```bash
sudo install -o root -g root -m 0600 /dev/null /etc/dragonet-subscription-proxy.env
sudoedit /etc/dragonet-subscription-proxy.env
```

Перенесите значения из [`.env.example`](.env.example), заменив все
placeholder. Минимально важные строки выглядят так:

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

Задайте ключ безопасно, не записывая его в shell history:

```bash
openssl rand -hex 32
```

`VPN_DEMO_INBOUNDS` должен содержать только существующие активные demo
inbound ID панели. `VPN_SUBSCRIPTION_PORT` и `VPN_SUBSCRIPTION_PATH_PREFIX`
относятся к S-UI subscription URL, а `PROXY_LISTEN_PORT` — к этому HTTPS
proxy. Это разные порты.

### 5. Включить systemd и firewall

```bash
sudo install -o root -g root -m 0644 \
  /opt/vpn-subscription-proxy/deploy/dragonet-subscription-proxy.service \
  /etc/systemd/system/dragonet-subscription-proxy.service
sudo systemctl daemon-reload
sudo systemctl enable --now dragonet-subscription-proxy.service
sudo systemctl status dragonet-subscription-proxy.service --no-pager
sudo ss -ltnp '( sport = :8443 )'
sudo ufw allow 8443/tcp
```

Также откройте TCP 8443 в firewall провайдера VPS. Если выбран другой
`PROXY_LISTEN_PORT`, последняя команда и проверка `ss` должны использовать
его. `CAP_NET_BIND_SERVICE` в unit позволяет при необходимости использовать
и порт ниже 1024, но не освобождает уже занятый 443.

Панель S-UI и `/apiv2/*` не должны быть доступны извне. Открывается только
выбранный порт proxy.

### 6. Проверить service на VPS

Проверка health разрешена только с loopback. Она должна использовать домен
сертификата, чтобы пройти проверку SNI:

```bash
export PROXY_HOST='proxy.example.com'
export PROXY_PORT='8443'
curl --fail --silent --show-error \
  --resolve "$PROXY_HOST:$PROXY_PORT:127.0.0.1" \
  "https://$PROXY_HOST:$PROXY_PORT/healthz"
sudo journalctl -u dragonet-subscription-proxy.service -n 50 --no-pager
```

Ожидаемый ответ: `{"status":"ok"}`. При ошибке запуска не ослабляйте
проверки discovery: проверьте A-запись, сертификат и права на его копию.
Журнал намеренно содержит только общий текст запуска, без body, Token,
клиентских имён, IP, device и TLS-путей.

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
{"reqStatus":"success","isClientFound":true,"isClientActive":true}
{"reqStatus":"success","isClientFound":true,"isClientActive":false}
{"reqStatus":"success","isClientFound":false,"isClientActive":false}
```

### Demo

Этот запрос **действительно создаёт** одно demo-подключение на 2 GiB и 3
суток, а затем блокирует совпадающие публичный IP или device ID на календарный
месяц. Используйте его только при осознанном приёмочном тесте и при
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

Перед обновлением сохраните предыдущий каталог или release-архив. Затем
повторите установку из шага 3, перезапустите service и выполните loopback,
`verify` и `demo` проверки выше. Если новый процесс не проходит discovery,
верните предыдущий каталог, выполните `sudo systemctl restart
dragonet-subscription-proxy.service` и не меняйте state directory: SQLite
reservation должна сохраниться.

`PROXY_LISTEN_PORT` нужно будет отдельно перенести в публичную константу
`DRAGONET_PROXY_PORT` в `src/config/Secrets.ts` на следующей части этапа 5,
когда будет подключаться MpeiApp.

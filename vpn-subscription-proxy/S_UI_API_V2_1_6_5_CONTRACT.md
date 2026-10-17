# S-UI 1.6.5: контракт demo-config для proxy

Выжимка из предоставленного отчёта `S_UI_API_V2_1_6_5_CONTRACT.md` с результатами
проверки панели 16.10.2026. Ниже описан используемый proxy вариант полного config.
При подготовке этой доработки реальные запросы к панели не выполнялись:
контракт проверяется локально по сериализованным данным `POST /apiv2/save`.

## Создание клиента

`POST /apiv2/save` принимает `application/x-www-form-urlencoded`, заголовок
`Token` и поля формы `object=clients`, `action=new`, `data=<JSON клиента>`.
`client.config` внутри этого JSON — объект. Для нового клиента передаются
`links: []` и числовые ID из `VPN_DEMO_INBOUNDS`. Нужно проверять `success`
в JSON-ответе: HTTP 200 сам по себе не подтверждает создание.

Полный config содержит все 15 секций, даже если некоторые не используются
выбранными inbounds. Фактический набор подключений определяется inbounds;
не все секции являются отдельными типами inbound.

## Поля 15 секций

Все значения `name`/`username` равны верхнему `client.name`.

| Секция | Поле идентичности | Остальные передаваемые поля |
| --- | --- | --- |
| `mixed` | `username` | `password`: общий пароль |
| `socks` | `username` | `password`: общий пароль |
| `http` | `username` | `password`: общий пароль |
| `shadowsocks` | `name` | `password`: base64 от 32 случайных байт |
| `shadowsocks16` | `name` | `password`: base64 от 16 случайных байт |
| `shadowtls` | `name` | `password`: тот же 32-байтовый base64-ключ, что у shadowsocks |
| `vmess` | `name` | `uuid`: общий UUID; `alterId`: число `0` |
| `vless` | `name` | `uuid`: общий UUID; `flow`: значение `DEMO_VLESS_FLOW` |
| `anytls` | `name` | `password`: общий пароль |
| `trojan` | `name` | `password`: общий пароль |
| `naive` | `username` | `password`: общий пароль; поле `name` запрещено |
| `hysteria` | `name` | `auth_str`: общий пароль |
| `snell` | `name` | `userkey`: 32 случайных символа A–Z/a–z/0–9 |
| `tuic` | `name` | `uuid`: общий UUID; `password`: общий пароль |
| `hysteria2` | `name` | `password`: общий пароль |

Credentials генерируются один раз при создании нового demo. Общий пароль
и UUID согласованы между соответствующими секциями одного клиента; у разных
клиентов они новые. Ключи Shadowsocks и Snell также генерируются криптографически
случайно. Ключи Shadowsocks кодируются обычным base64 с padding, а не base64url.
`shadowsocks16` используется панелью для `2022-blake3-aes-128-gcm`,
для остальных методов выбирается `shadowsocks`. `shadowtls` с пользователями
относится к inbound версии 3.

Ошибка `users[11].name: json: unknown field "name"` вызвана передачей
`naive.name`. Для HTTP/SOCKS/Naive требуется `username`; у Snell остаётся `name`.
В пользовательские секции не добавляются inbound-параметры PSK, TLS,
listen-port, cipher или transport. Полный config не изменяет действующие demo.

## Проверка и известное ограничение панели

Полный config проверяется через `GET /apiv2/clients?id=<ID>`: запрос списка
без `id` возвращает краткие данные без config/links.

В предоставленном отчёте отдельно воспроизведён дефект hot-reload Naive:
`close inbound/naive[...]: ... use of closed network connection`.
Он может возникнуть и с правильным config: транзакция БД откатывается,
но состояние runtime listener может остаться изменённым. Устранение ошибки
поля `name` не исправляет этот дефект S-UI/core. Состояние затронутого Naive
нужно проверять отдельно; автоматический повтор POST в proxy не добавлен.

Локальные тесты проверяют строгое соответствие полей всех 15 секций, типы,
форматы ключей/UUID, согласованность credentials и отсутствие секретов в journal
при явном отказе панели. Проверка создания и подключений на VPS остаётся ручной.

# Xcode Cloud: MpeiApp 2.6.0

Workflow собирают **один существующий продукт MpeiApp** с bundle ID
`ru.NoobDragons.MpeiApp` в текущем аккаунте получателя. Workspace —
`ios/MpeiApp.xcworkspace`, shared scheme — `MpeiApp`, Archive — **Release**.
Действия участников — в [этапе 11](../../docs/v2.6.0-stage-11-xcode-cloud.md).
Для разовой настройки Account Holder — [краткая инструкция владельцу](../../docs/v2.6.0-xcode-cloud-owner.md).

## Текущее состояние: экспорт Archive и новые теги (07.11.2026)

Исправление minimum iOS из `8946f03` сработало: пользователь подтвердил успешную
сборку. Первоначальный workflow выполнял только Build; для появления бинарного
файла в App Store Connect требуется Archive с подготовкой распространения.
Владелец добавил Archive и сообщил новые триггеры: **`release-*` — App Store
Connect, `testflight-*` — публичный TestFlight**. Реальную доставку определяют
настройки Archive/post-actions в Cloud, а не имя тега в скрипте.

Проверены последние коммиты и GitHub CI: `4f4c5be`/`5440614` — пробные изменения,
`a5dac77` — отключение source guard. На `a5dac77` проверки GitHub Actions
[ветки dev](https://github.com/TheKeeroll/MpeiApp-Public/actions/runs/42362146324)
и [release-тега](https://github.com/TheKeeroll/MpeiApp-Public/actions/runs/42362163682)
успешны. Xcode Cloud Release Build тоже успешен, но
[Release Archive](https://appstoreconnect.apple.com/teams/48da0c81-5889-4932-bfe1-94c6d282a45b/apps/1618910681/ci/builds/4ddb923c-e515-42af-8dd3-4c9e096eaa44/action/3576656b-12fa-4136-bb4c-d18a2f2730d8)
сообщает `Exporting for App Store Distribution failed`.
На скриншотах сборки 12 `xcodebuild archive` успешен; `-exportArchive` для
App Store/development/ad hoc завершается **70**. Это не ошибка компиляции.
Полная папка сборки 12 проверена: **38 файлов** — archive, три export-лога,
30 distribution/provisioning/service logs и четыре лога подготовки/hooks.
Причина установлена: Cloud не может зарегистрировать App ID виджета и настроить
App Groups у основного приложения. Эти ошибки повторяются во всех трёх режимах
экспорта; сообщения `No profiles ... were found` сопровождают те же блокеры.

| Сообщение в export/provisioning logs | Что исправить |
| --- | --- |
| `Automatic signing cannot register bundle identifier "ru.NoobDragons.MpeiApp.ScheduleWidget"` | Владелец регистрирует explicit App ID виджета в текущей Team |
| `Automatic signing cannot update bundle identifier "ru.NoobDragons.MpeiApp"` / `enable App Groups` | Владелец включает App Groups и назначает нужную группу обоим App ID |
| `No profiles for ...` для app/widget | После настройки App ID/группы обновить provisioning через automatic signing; подробности ниже |
| `Unable to authenticate with App Store Connect`, `Failed to find an account with App Store Connect access` | Дополнительная ошибка ASC session proxy; проверить доступ и повторить после настройки идентификаторов, как описано ниже |

Команда архива из логов явно содержит `DEVELOPMENT_TEAM=JGUC7QM6M5`.
В репозитории ещё стояла `58KV3BTJAZ`; теперь Debug/Release app и widget
согласованы с **JGUC7QM6M5**. Cloud уже переопределял Team командной строкой,
поэтому сама замена в проекте **не устранит серверные ошибки регистрации**.
Bundle IDs и App Group сохранены.

`verify-source.sh` снова подключён как **диагностика, всегда exit 0**.
Он распознаёт `release-*`, `testflight-*` и прежние `ios-dev-*`, сравнивает
HEAD/CI_COMMIT, локальные refs и доступную историю. Неожиданные теги/ветки,
PR/manual события, отсутствующие переменные/refs/Git и несовпадения только
предупреждают. Fetch/скачивание истории не выполняются; отсутствующий CI_BRANCH
для tag build допустим. Вызов в post-clone защищён `if ! ...`, поэтому даже
отсутствующий или сломанный helper не останавливает подготовку, Archive и доставку.
Эта диагностика не скрывает реальные ошибки установки зависимостей, сборки,
подписи или экспорта.

### Владелец: исправить Identifiers и App Groups перед следующим экспортом

Действия выполняются в **Apple Developer → Account → Certificates, Identifiers
& Profiles**, в Team **JGUC7QM6M5** из логов, а не в форме создания приложения
App Store Connect. При индивидуальном членстве Admin ASC не получает ресурсы
Developer Program; в текущей ситуации эти шаги выполняет Account Holder.
См. [роли Apple](https://developer.apple.com/help/account/access/roles/).

1. **Identifiers → App Groups:** проверить регистрацию **`group.com.mpeiapp`**
   в этой Team. Если группы нет — создать её через `+ → App Groups`, указав
   этот точный identifier. Если имя осталось у прежней Team после переноса
   приложения, согласовать с прежним владельцем освобождение группы и её
   регистрацию у получателя по [правилам переноса Apple](https://developer.apple.com/help/app-store-connect/transfer-an-app/overview-of-app-transfer/#apps-using-app-groups).
   Код app/bridge/widget использует одно и то же имя, поэтому произвольная
   замена только на портале не подойдёт.
2. **Identifiers → App IDs → `ru.NoobDragons.MpeiApp`:** открыть существующий
   identifier, включить **App Groups**, нажать **Configure**, выбрать
   **`group.com.mpeiapp`**, подтвердить назначение и сохранить изменения.
   Если capability уже включена, проверить именно назначенную группу.
3. **Identifiers → `+` → App IDs → App:** зарегистрировать **Explicit App ID**
   с Bundle ID **`ru.NoobDragons.MpeiApp.ScheduleWidget`** и описанием, например,
   `MpeiApp Schedule Widget`. Для него включить **App Groups** и через Configure
   назначить ту же **`group.com.mpeiapp`**. Если точный ID уже есть в этой Team,
   отредактировать его. Если портал сообщает, что ID занят, передать точную
   ошибку для проверки принадлежности ID. Для виджета нужна регистрация
   identifier; отдельная карточка приложения в App Store Connect не требуется.
4. Повторить Cloud Archive с **automatic signing**, чтобы Cloud повторно
   получил/создал profiles с обновлёнными capabilities **обоих** App ID.
   Для шагов 1–3 достаточно браузера; Mac не обязателен. В актуальном проекте
   обе цели уже используют automatic signing и Team **JGUC7QM6M5**. Если
   проверяется также локальный Xcode, открыть `ios/MpeiApp.xcworkspace` и
   сверить это в Signing & Capabilities **MpeiApp** и **ScheduleWidgetExtension**.
   Если используются созданные вручную профили, после изменения capabilities
   их нужно перегенерировать. Для App Store экспорта необходимы App Store
   profiles приложения и extension; ошибки Development/Ad Hoc диагностируются
   отдельно, если останутся после этой настройки.

Инструкции Apple: [App ID](https://developer.apple.com/help/account/identifiers/register-an-app-id/),
[App Group](https://developer.apple.com/help/account/identifiers/register-an-app-group/),
[назначение App Groups и обновление profiles](https://developer.apple.com/help/account/identifiers/enable-app-capabilities/).
Cloud signing в сборке 12 находил managed certificates; подтверждённой причины
перевыпускать или отзывать сертификаты в этих логах нет.

### Дополнительная ошибка доступа App Store Connect

В двух App Store export attempts в `IDEDistribution.critical.log` и
`DVTITunesSoftwareService.log` есть ошибка **Session Proxy Provider** при
получении store configuration: ответ и configuration — `null`.
`IDEDistribution.standard.log` также сообщает отсутствие аккаунта с доступом
ASC к Team **JGUC7QM6M5**. Из этих логов нельзя установить, временный ли это
сбой Cloud или проблема разрешений/сессии; настройка identifiers сама по себе
не гарантирует устранение этой ошибки.

Владелец проверяет вход своим Apple Account в App Store Connect, доступ к
существующей MpeiApp, активность членства и наличие требующих принятия
соглашений. При сопровождении другим пользователем проверить его доступ
к приложению и [cloud-managed distribution signing](https://developer.apple.com/help/account/certificates/cloud-managed-certificates/)
в рамках доступных его членству разрешений. После исправления identifiers
выполнить один повторный экспорт. Если ошибки идентификаторов исчезли, а
Session Proxy Provider остаётся — передать Apple Developer Support ссылку
на запуск, Team ID и новые distribution/service logs для проверки Cloud-сессии.
Дополнительный API key или изменение клиентских Secrets.ts эту ошибку не исправляют.

### Остальные логи и внесённые изменения

| Область | Результат проверки / изменение |
| --- | --- |
| Dependencies и hooks | Node/Ruby/Yarn/patches/136 Pods установлены; resolve packages успешен. Pre-hook подготовил 2.6.0 (12); post-hook проверил номера и minimum 15.6/17.0. Это проверка metadata, а не успешного экспорта/доставки |
| `xcodebuild archive` | `ARCHIVE SUCCEEDED`, ошибок компиляции нет. `CODE_SIGN_IDENTITY=-` и отсутствие embedded.mobileprovision на этой стадии соответствуют отдельному последующему signing/export в Cloud |
| Project signing | Исправлена старая Team на JGUC7QM6M5 в четырёх конфигурациях app/widget |
| `AppIntent.swift:24` | Предупреждения availability синтезированных setter/_modify у `@Parameter`: intent types переведены с extension-only availability на `@available(iOS 17.0, *)`, согласованную с minimum виджета. Исчезновение предупреждений проверить на Xcode |
| Иконки `crymat`/`crysign` | Удалены ошибочные iPhone-слоты 76×76; корректные iPad-слоты и сами изображения сохранены |
| Xcode UserData/Capabilities | В общем Cloud environment добавлен `mkdir -p` для отсутствующих родителей кеша. Неудача даёт только предупреждение; это не заменяет регистрацию capabilities на портале |
| Внешние SDK | Warnings React headers/nullability, Lottie Sendable, Yandex deprecated APIs, BigoADS `.pcm`, пустые object symbols и peer dependencies не остановили Archive. По этим логам обновлять lockfiles для исправления экспорта не требуется |
| Cloud toolchain | Missing Metal search path и служебные сообщения относятся к образу 27.2; ошибки компиляции/линковки за ними не последовали |

Локально после правок прошли **71 тест в трёх suites** (Cloud/source/widget),
preflight, проверка JSON/ссылок иконок и Bash-синтаксиса. Новый native Archive
и проверка исправленных Swift/asset diagnostics требуют macOS/Xcode и ещё
не выполнялись. Оригинальные distribution logs хранятся отдельно от Git;
в документации сохранены только необходимые диагностические сведения.

### Пользователь: проверка после действий владельца

Для проверки изменений только в Developer Account можно повторить сборку 12
на прежнем SHA: signing использует состояние портала на момент экспорта.
Чтобы проверить также правки репозитория, опубликовать новый коммит в нужной
ветке и новый `release-*` или `testflight-*` тег на нём либо вручную выбрать
этот коммит в Cloud. Повтор старого SHA не получит новые правки файлов.

Проверить App Store export и обработку бинарного файла **2.6.0 (новый номер
CI_BUILD_NUMBER)** в существующей MpeiApp. Далее для публичного TestFlight
проверить внешнюю группу/public link и beta review; для релиза выбрать
принятую сборку и отправить её на App Review. Успешность сборки 12 не означает
успешного экспорта: у неё выгрузка в ASC не состоялась.

## Текущее состояние: Default и Xcode 27.2 (05.11.2026)

История предыдущего исправления; текущие триггеры и состояние экспорта — выше.

По сообщению пользователя, владелец подключил Cloud; состоялись сборки 1–3
ветки dev. Существующий workflow называется `Default`: Admin видит сборки и
использование shared variables, но сам workflow не отображается, а сохранение
нового завершается `User does not exist`. Причина ограничения доступа пока
не установлена. Для исправления deployment target создавать или редактировать
workflow не требуется: hooks не зависят от его имени.

Выбранный образ, по обзору пользователя: **Xcode 27.2 (27B52)** и
**macOS Golden Gate 27.2 (26B123)**. Post-clone выводит `xcodebuild -version`
и `sw_vers`, чтобы следующий запуск зафиксировал фактические версии.
Скрипты используют выбранный Cloud Xcode без подмены `DEVELOPER_DIR` или
`xcode-select`; совместимость с ранее проверенным Xcode 26.4 сохраняется.

Последняя сборка сообщила о 26 Pod-целях с `IPHONEOS_DEPLOYMENT_TARGET = 13.0`,
включая AppMetrica, KSCrash, BigoADS и Lottie privacy bundles. `platform :ios`
сам по себе не задаёт минимум всем генерируемым целям. В `post_install` после
React Native теперь поднимаются до **15.6** все более низкие/незаданные минимумы
Pod-целей во всех конфигурациях, включая resource/privacy bundles. Более высокие
требования зависимостей сохраняются; minimum приложения/виджета — **15.6/17.0**.
Это соответствует диапазону deployment targets
[Xcode 26/27](https://developer.apple.com/xcode/system-requirements/) и выполняется
через стандартный [CocoaPods post_install](https://guides.cocoapods.org/syntax/podfile#post_install).

`Podfile.lock` обновляется только в части SHA-1 Podfile с LF; версии SDK и gems
сохраняются. `pod install --deployment` в post-clone применяет исправление
перед xcodebuild. Для следующей проверки нужен **новый запуск на коммите
с исправлением**; повтор старой сборки на старом SHA его не получит.
На 05.11 триггеры `Default` по скриншотам не были подтверждены.
Ограничивавшая события проверка источника заменена предупреждениями 07.11.

Локальная проверка исправления: preflight и **32 Cloud-теста** успешны;
Bash-синтаксис hooks проверен. Ruby 3.3 выполнил настоящий `post_install` из
Podfile с подменёнными входными объектами CocoaPods/RN: **10 целей / 20 Debug/Release
конфигураций**, включая незаданные/старые минимумы и сохранение 15.10/16/17/27.2.
SHA-1 сверён алгоритмом CocoaPods. Это проверка hook, а не нативная сборка:
новый `pod install` и Archive на macOS/Xcode здесь не выполнялись.

## Проверенные lockfiles и установка на Mac

Gemfile и lockfiles согласованы: CocoaPods **1.17.0**, xcodeproj **1.28.1**,
Bundler **2.4.10**. Resolver выполнен пользователем на Mac и сохранён в
`049ad61` от 23.10.2026; приложение собрано и запущено в Simulator с
**Xcode 26.4 (17E192)**, preflight успешен.

После получения актуальной dev и обычных локальных Secrets.ts/Swift initializer
закрытым каналом установить зависимости по lockfiles. Полный набор команд,
включая Node/Yarn/Ruby и выбор Xcode, — в инструкции владельцу. Ключевые команды
из корня с уже настроенными Node 24 / Ruby 3.3 / Bundler 2.4.10 / Yarn 1.22.22:

```bash
export BUNDLE_FROZEN=true
bundle _2.4.10_ install
yarn install --frozen-lockfile --non-interactive --production=false
bundle _2.4.10_ exec pod --version
cd ios
bundle _2.4.10_ exec pod install --deployment
cd ..
node scripts/xcode-cloud.cjs preflight
```

Повторный resolver, `bundle update` и полный `pod update` для onboarding не
нужны. Cloud устанавливает Bundler из `BUNDLED WITH`. Его Ruby — **3.3.x**,
Node — **24.x**, Yarn — **1.22.22**; Homebrew устанавливает их при необходимости.
Ruby metadata 3.2.2p53 в lockfile не ограничивают runtime ровно этой версией:
Gemfile допускает Ruby >= 3.2 и < 3.5. [Ruby 3.3](https://formulae.brew.sh/formula/ruby@3.3),
[Node 24](https://formulae.brew.sh/formula/node@24).

SDK медиации сохранены; устаревший bitcode_strip для отсутствующих
LogRocket/старых путей Hermes удалён, React Native post_install сохранён.
Simulator-проверка успешна; подписанный Cloud Archive ещё предстоит проверить.
Первое подключение выполнено владельцем; доступ Admin к workflow пока ограничен,
как описано выше.

## Настройки распространения и запуска

| Параметр | App Store Connect | Публичный TestFlight |
| --- | --- | --- |
| Start condition, по сообщению владельца 07.11 | Tag Changes, префикс `release-` | Tag Changes, префикс `testflight-` |
| Проверка источника | Только предупреждения | Только предупреждения |
| Scheme / action | MpeiApp / один Release iOS Archive | MpeiApp / один Release iOS Archive |
| Deployment Preparation | **TestFlight and App Store** | **TestFlight and App Store** |
| Restrict Editing | **Включить** | **Включить** |
| Clean | Включить для workflow распространения | Включить для workflow распространения |
| Доставка | Проверить обработку сборки в App Store Connect; отправка на App Review — отдельный шаг | TestFlight External Testing, нужная внешняя группа/public link; beta review по правилам Apple |
| Другие события | Запуск определяется workflow; скрипт не блокирует | Запуск определяется workflow; скрипт не блокирует |

Ветка, которую собирает Cloud, должна содержать эти hooks и обновлённые
lockfiles. Прежнее соглашение `ios-dev-*`/push v2 не является обязательным
условием скриптов; по тегу не требуется доказывать принадлежность конкретной ветке.

Режим **Internal Testing Only не использовать ни в одном workflow**:
такую сборку нельзя выбрать для App Review. Возможность обычного релиза
определяет режим Archive, независимо от того, внутренней или внешней группе
отправляется TestFlight-сборка. Внешнему тестированию требуется beta review.
См. [Archive и Deployment Preparation](https://developer.apple.com/documentation/xcode/configuring-your-xcode-cloud-workflow-s-actions).

Пример запуска публичного TestFlight после push исправления в `dev`:

```bash
git tag testflight-2.6.0-beta.1
git push origin testflight-2.6.0-beta.1
```

Для App Store использовать новый `release-*` тег на нужном коммите.
Тег сам не меняет marketing version: версия берётся из package.json/native
проекта, build number — из CI_BUILD_NUMBER. Не переиспользовать старый тег
для проверки нового кода. Любой другой тег или ручной/PR/branch запуск,
разрешённый workflow, также проходит source diagnostics с предупреждениями.

## Общий Build Number и публикация проверенного бинарного файла

Оба workflow должны находиться в Cloud-разделе **одной MpeiApp**, а не в разных
продуктах/аккаунтах. Используется назначенный Apple **CI_BUILD_NUMBER**.
Временная копия проекта перед xcodebuild получает этот номер во всех
CURRENT_PROJECT_VERSION app, extension и tests. MARKETING_VERSION берётся из
репозитория и согласован с package.json; счётчиков в ветках и auto-commit нет.

Например, при неизменной версии 2.6.0: dev получает `(120)`, v2 — `(121)`,
следующий dev — `(122)`. Не сбрасывать общий Next Build Number при смене
ветки/workflow/marketing version. До первого запуска Admin проверяет уже
загруженные 2.6.0 и при необходимости ставит Next Build Number выше занятого
максимума: MpeiApp → Xcode Cloud → Settings → Build Number. Пропуски номеров
после неудачных/отменённых запусков допустимы. Отдельный API key не нужен.
См. [нумерацию Cloud](https://developer.apple.com/documentation/xcode/setting-the-next-build-number-for-xcode-cloud-builds/)
и [CI_BUILD_NUMBER](https://developer.apple.com/documentation/xcode/environment-variable-reference).

После успешного Archive hook проверяет marketing/build numbers обеих целей,
bundle IDs и minimum OS **15.6 для app / 17.0 для виджета**. Нарушение делает
проверку неуспешной. На первой облачной приёмке отдельно сверить номера
реальных dev/v2 сборок в одном продукте и TestFlight. Проверку v2 выполнить
при первом запланированном push; дополнительная сборка для самого выпуска
принятого dev-кандидата не требуется.

Если тестеры приняли **2.6.0 (120) из dev**, выбрать **именно (120)** в разделе
Build версии 2.6.0 App Store Connect и отправить на App Review. Для этого не
нужны Rebuild, изменение версии или push v2. Бинарный файл остаётся тем же.
Синхронизация `v2` — отдельная операция: её push по согласованному правилу
запустит новый Archive, но его не требуется выбирать вместо проверенного.
Сохранить соответствие release → version/build/commit и скачать archive/dSYM.

## Cloud Secret variables

Создать в Environment первого workflow перед Start Build; затем применить
shared variables к обоим workflow. Значения вводит Admin/владелец из уже
имеющейся клиентской конфигурации. Для каждого поля включить **Secret**;
**Only the Account Holder** оставить выключенным для сопровождения Admin.
GitHub repository secrets и дополнительные приватные репозитории не нужны.

Обязательные общие значения:

| Переменная | Поле Secrets.ts |
| --- | --- |
| MPEIAPP_YANDEX_MAPS_API_KEY | YANDEX_MAPS_API_KEY; то же значение для Swift |
| MPEIAPP_DRAGONET_PROXY_DOMAIN | DRAGONET_PROXY_DOMAIN, только hostname |
| MPEIAPP_DRAGONET_PROXY_PATH | DRAGONET_PROXY_PATH, путь с `/` |
| MPEIAPP_DRAGONET_TELEGRAM_URL | DRAGONET_TELEGRAM_URL, HTTPS-ссылка на бота |

Обязательные iOS placements, со значениями из `YANDEX_AD_UNIT_IDS.ios`:

```text
MPEIAPP_YANDEX_AD_IOS_INLINE_BANNER_MARKS
MPEIAPP_YANDEX_AD_IOS_INLINE_BANNER_DRAWER
MPEIAPP_YANDEX_AD_IOS_INLINE_BANNER_SCHEDULE_TODAY
MPEIAPP_YANDEX_AD_IOS_INLINE_BANNER_GUEST_SCHEDULE_EMPTY
MPEIAPP_YANDEX_AD_IOS_STICKY_BANNER_LOADING
MPEIAPP_YANDEX_AD_IOS_STICKY_BANNER_SKIPPED_CLASSES
MPEIAPP_YANDEX_AD_IOS_STICKY_BANNER_DETAILED_MARKS
MPEIAPP_YANDEX_AD_IOS_STICKY_BANNER_RECORD_BOOK
MPEIAPP_YANDEX_AD_IOS_STICKY_BANNER_STIPENDS
MPEIAPP_YANDEX_AD_IOS_REWARDED
```

Необязательные: MPEIAPP_DRAGONET_PROXY_PORT (8443),
MPEIAPP_DRAGONET_SUBSCRIPTION_PORT (443),
MPEIAPP_DRAGONET_SUBSCRIPTION_PATH_PREFIX (`/sub`). Если текущая конфигурация
отличается, задать её значения явно. Android placements можно передать
аналогичными переменными с `ANDROID` вместо `IOS`; для iOS Archive они не
требуются. Незаданные Android IDs остаются пустыми, не заменяются demo-рекламой.

Полный список имён/defaults без чтения значений:

```bash
node scripts/xcode-cloud.cjs variables
```

Пустые обязательные значения, неверные URL/порты/пути и demo ad IDs приводят
к остановке. В сообщении перечисляются только имена переменных. Генерируются
игнорируемые Secrets.ts, YandexMapsInitializer.swift и .xcode.env.local с
абсолютным Node path. Они не добавляются в Git; для локальной сборки сохранён
прежний способ конфигурации. CLI отказывается менять файлы вне Cloud checkout.

## Диагностика и границы локальной проверки

Hooks подписывают стадии source/tools/Bundler/Yarn/Pods и не выводят значения.
В браузере: MpeiApp → Xcode Cloud → Builds → запуск → действие → Logs.
`preflight` сообщает о старом lockfile до установки gems; ошибка генератора —
о незаполненных/невалидных переменных; после Archive проверяются native metadata.

Локально выполняются typecheck, Jest-проверки генерации/редактирования metadata,
Bash syntax и реальный Git со временным локальным remote (без Apple/GitHub).
Они не подтверждают подпись или работу Apple-сервиса. Resolver и Simulator
пользователь подтвердил 23.10; onboarding владельца, облачные номера и
возможность выбрать dev-сборку для App Review проверяются в Xcode/App Store
Connect. Фактические результаты записываются
в основной отчёт; один Archive на событие, включённая квота — 25 часов/месяц.

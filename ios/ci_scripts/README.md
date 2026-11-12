# Xcode Cloud: сопровождение MpeiApp

**Релиз 2.6.0 завершён 11.11.2026.** Пользователь подтвердил успешную новую
Cloud Build/Archive/export, внешнее TestFlight-тестирование, работу приложения,
настроек персонализации и виджета, затем публикацию в App Store.
[Итоги релиза](../../docs/v2.6.0-release.md),
[архитектура и результат](../../docs/v2.6.0-stage-11-xcode-cloud.md),
[роли владельца/Admin](../../docs/v2.6.0-xcode-cloud-owner.md).

## Продукт и идентификаторы

Workflow собирают один существующий продукт MpeiApp в текущей Team получателя.
Workspace — `ios/MpeiApp.xcworkspace`, shared scheme — `MpeiApp`, Archive — Release.

| Назначение | Значение |
| --- | --- |
| Основное приложение | ru.NoobDragons.MpeiApp |
| Виджет | ru.NoobDragons.MpeiApp.ScheduleWidgets |
| Общий контейнер | group.org.mpeiapp |
| Team | JGUC7QM6M5 |
| Minimum OS | app 15.6 / widget 17.0 |

Entitlements, App IDs в Developer Account, общий ScheduleWidgetContract
и verify-archive согласованы. Виджет использует те же widgetKey/widgetKeyDay
и формат расписания. Старые widget/App Group ID остались у прежней Team
после transfer и не используются.

## Контракт hooks

- ci_post_clone устанавливает Node 24, Yarn 1.22.22, Ruby 3.3/Bundler,
  зависимости из frozen lockfiles и запускает `pod install --deployment`.
- Генератор создаёт локальные Secrets.ts/Swift initializer и Node env из Cloud
  Secret variables; сообщения не содержат значений.
- verify-source диагностирует CI event/branch/tag и доступную локальную историю.
  Это предупреждения, без fetch и без запрета разрешённых workflow событий.
- Перед xcodebuild общий CI_BUILD_NUMBER записывается в app/extension/tests;
  после Archive сверяются IDs, marketing/build versions и minimum OS.
- Hooks используют выбранный Xcode workflow image без подмены DEVELOPER_DIR,
  выводят `xcodebuild -version` и `sw_vers` для воспроизводимой диагностики.

Podfile post_install после React Native поднимает до 15.6 более низкие или
незаданные минимумы всех Pod-целей, включая privacy/resource bundles.
Более высокие минимумы сохраняются. Старый bitcode_strip отсутствующих библиотек
удалён; native SDK медиации закреплены в Podfile.lock.

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
Simulator и подписанный Cloud Archive проверены; итоговая сборка прошла
внешнее тестирование и опубликована. При проблемах доступа используйте
инструкцию владельца, не повторяя onboarding для обычной сборки.

## Настройки распространения и запуска

| Параметр | App Store Connect | Публичный TestFlight |
| --- | --- | --- |
| Start condition | Tag Changes, префикс `release-` | Tag Changes, префикс `testflight-` |
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
проверку неуспешной. Дополнительная сборка для самого выпуска
принятого dev-кандидата не требуется; фактическое соответствие build/commit
сохраняется при выборе релизного бинарного файла.

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

## Диагностика

Hooks подписывают стадии source/tools/Bundler/Yarn/Pods и не выводят значения.
В браузере: MpeiApp → Xcode Cloud → Builds → запуск → действие → Logs.
`preflight` сообщает о старом lockfile до установки gems; ошибка генератора —
о незаполненных/невалидных переменных; после Archive проверяются native metadata.

Локально выполняются typecheck, Jest-проверки генерации/редактирования metadata,
Bash syntax и реальный Git со временным локальным remote (без Apple/GitHub).
Сами по себе они не проверяют подпись Apple-сервиса; успешные Cloud Archive,
внешний TestFlight и выпуск 2.6.0 подтверждены пользователем отдельно.
Настроен один Archive на событие, использован включённый бюджет 25 часов/месяц.
При сбое экспорта проверяются capabilities/profiles обеих целей текущей Team,
App Group и доступ App Store Connect; успешная компиляция archive ещё не
означает успешный export. При повторной проверке изменений выбирается коммит
с этими изменениями, а не старый SHA предыдущего запуска.

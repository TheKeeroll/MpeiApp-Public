# Xcode Cloud: MpeiApp 2.6.0

Оба workflow собирают **один существующий продукт MpeiApp** с bundle ID
`ru.NoobDragons.MpeiApp` в текущем аккаунте получателя. Workspace —
`ios/MpeiApp.xcworkspace`, shared scheme — `MpeiApp`, Archive — **Release**.
Действия участников — в [этапе 11](../../docs/v2.6.0-stage-11-xcode-cloud.md).

## Сначала получить lockfiles на Mac

Gemfile закрепляет CocoaPods **1.17.0** / xcodeproj **1.28.1**. Старые
Gemfile.lock и Podfile.lock ещё требуют настоящего resolver на Mac. До этого
Cloud preflight намеренно останавливается с понятным сообщением.

На Mac, в корне проверяемого среза, после получения обычных локальных
Secrets.ts/Swift initializer существующим закрытым каналом:

```bash
brew install node@24 ruby@3.3
export PATH="$(brew --prefix node@24)/bin:$(brew --prefix ruby@3.3)/bin:$PATH"
gem install bundler --version 2.4.10 --user-install --no-document
export PATH="$(ruby -e 'print Gem.user_dir')/bin:$PATH"

bundle _2.4.10_ update cocoapods xcodeproj
bundle _2.4.10_ update --ruby
bundle _2.4.10_ exec pod --version
cd ios
bundle _2.4.10_ exec pod install
cd ..
node scripts/xcode-cloud.cjs preflight
```

Bundler 2.4.10 — текущий `BUNDLED WITH`; при отдельном согласованном обновлении
Bundler использовать новую совместимую версию во всех этих командах и сохранить
её в lockfile. Cloud устанавливает именно версию из `BUNDLED WITH`.
Ruby Cloud — **3.3.x**, Node — **24.x**, Yarn — **1.22.22**; Homebrew устанавливает
их при необходимости. [Ruby 3.3](https://formulae.brew.sh/formula/ruby@3.3),
[Node 24](https://formulae.brew.sh/formula/node@24).

Проверить изменения Gemfile.lock/Podfile.lock и native-проекта, выполнить Swift
tests/Simulator smoke по этапу 11.B и сохранить результаты в Git до Cloud.
SDK медиации остаются ранее проверенными; полный `pod update` не нужен.
Удалён старый post_install, запускавший bitcode_strip для LogRocket/старых
путей Hermes; текущий React Native post_install сохранён. Проверка Archive на
Mac/Cloud подтвердит native-совместимость.

## Обязательные настройки двух workflow

| Параметр | dev | v2 |
| --- | --- | --- |
| Start condition | Tag Changes, префикс `ios-dev-` | Branch Changes, ровно `v2` |
| Дополнительная проверка | Commit тега входит в `origin/dev` | Commit входит в `origin/v2` |
| Scheme / action | MpeiApp / один Release iOS Archive | MpeiApp / один Release iOS Archive |
| Deployment Preparation | **TestFlight and App Store** | **TestFlight and App Store** |
| Restrict Editing | **Включить** | **Включить** |
| Clean | Включить для workflow распространения | Включить для workflow распространения |
| Post-action | TestFlight, нужная группа тестеров | TestFlight, нужная группа тестеров |
| File/PR filters | Без PR; обычный push dev не запускается | Без фильтров файлов и PR |
| Auto-cancel | По желаемой политике тестовых тегов | Выключить для обработки каждого push |

Ветка, которую собирает Cloud, должна содержать эти hooks и обновлённые
lockfiles. Workflow v2 можно подготовить заранее и активировать после
переноса подготовленного среза; публикация успешной dev-сборки этого не требует.

Режим **Internal Testing Only не использовать ни в одном workflow**:
такую сборку нельзя выбрать для App Review. Возможность обычного релиза
определяет режим Archive, независимо от того, внутренней или внешней группе
отправляется TestFlight-сборка. Внешнему тестированию требуется beta review.
См. [Archive и Deployment Preparation](https://developer.apple.com/documentation/xcode/configuring-your-xcode-cloud-workflow-s-actions).

Пример запуска dev после push коммита в `dev`:

```bash
git tag ios-dev-2.6.0-beta.1
git push origin ios-dev-2.6.0-beta.1
```

Первоначальный ручной запуск из мастера Xcode допускает ветку dev без тега.
Автоматический обычный push dev, PR, чужой тег и тег вне истории dev
отклоняются. Проверка выполняется до установки зависимостей; поддерживаются
annotated tags и shallow checkout, наличие CI_BRANCH у тега не предполагается.
Для коммита на вершине ветки достаточно shallow fetch; полная история
запрашивается только для проверки более раннего коммита.

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
Они не подтверждают resolver CocoaPods, подпись или работу Apple-сервиса.
Части 11.B–E, облачные номера и возможность выбрать dev-сборку для App Review
подтверждаются на Mac и в App Store Connect. Фактические результаты записываются
в основной отчёт; один Archive на событие, включённая квота — 25 часов/месяц.

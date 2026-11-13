# Рекламная медиация

Текущая конфигурация использует Yandex Mobile Ads **8.6.0**, BIGO Ads и VK Рекламу.
Chartboost SDK, оба его адаптера, Android-репозиторий JFrog и отдельная зависимость
ExoPlayer Core 2.18.7 удалены. История опубликованной 2.6.0, где Chartboost ещё
присутствовал, сохранена в [отчёте того выпуска](v2.6.0-ios-mediation.md).

## Версии и установка

| Компонент | Android | iOS |
| --- | --- | --- |
| RN-плагин `yandex-mobile-ads` | 8.6.0 | 8.6.0 |
| Нативный Yandex SDK | 8.6.0, `strictly` | 8.6.0 через podspec RN-плагина |
| Адаптер BIGO | `mobileads-bigoads:6.1.0.0` | `BigoADSYandexMobileAdsAdapters:5.0.6.6` |
| Адаптер VK | `mobileads-mytarget:5.51.2.2` | `MyTargetYandexMobileAdsAdapters:5.45.0.0` |
| SDK BIGO | Разрешён Gradle в 6.1.0 | Podspec требует `BigoADS ~> 5.0.6` |
| SDK VK | Разрешён Gradle в 5.51.2 | Podspec требует `myTargetSDK ~> 5.45.0` |

Версии сверены с [Maven POM BIGO](https://repo.maven.apache.org/maven2/com/yandex/ads/mediation/mobileads-bigoads/6.1.0.0/mobileads-bigoads-6.1.0.0.pom),
[Maven POM VK](https://repo.maven.apache.org/maven2/com/yandex/ads/mediation/mobileads-mytarget/5.51.2.2/mobileads-mytarget-5.51.2.2.pom),
[podspec BIGO](https://raw.githubusercontent.com/CocoaPods/Specs/master/Specs/e/5/f/BigoADSYandexMobileAdsAdapters/5.0.6.6/BigoADSYandexMobileAdsAdapters.podspec.json)
и [podspec VK](https://raw.githubusercontent.com/CocoaPods/Specs/master/Specs/d/b/f/MyTargetYandexMobileAdsAdapters/5.45.0.0/MyTargetYandexMobileAdsAdapters.podspec.json).
Android-адаптеры требуют Yandex `[8.6.0,8.7.0)`, iOS — `~> 8.6.0`.
Более новые iOS-адаптеры BIGO 6.1.0.0 / VK 5.46.0.0 требуют уже Yandex 8.7.x.

JS-зависимости устанавливаются через `yarn install --frozen-lockfile` с обязательным
`patch-package`. iOS использует CocoaPods и minimum OS 15.6; рекламные pods подключены
только к основному приложению. Переход с прежнего Podfile.lock и получение точного
результата resolver описаны в [Cloud hooks](../ios/ci_scripts/README.md).

## Патч и данные пользователя

[Патч 8.6.0](../patches/yandex-mobile-ads+8.6.0.patch) сохраняет Android-защиты
баннера при Fabric mount/unmount, clipping/reattach, отложенной загрузке и событиях
после уничтожения view. Исходный `YandexBannerView.kt` в npm-пакетах 8.5.0 и 8.6.0
совпадает; upstream-обработка жестов сохранена.

На iOS upstream перенёс `LocationFactory` в `ios/Sources/Swift/Utils/Factory/`
и уже использует `RCTConvert.double`, поэтому прежний обход `clLocationDegrees`
удалён из патча. Перед созданием `Location` приложение проверяет конечность обеих
координат и диапазоны широты/долготы в [AdTargeting](../src/Ads/AdTargeting.ts)
и [MapRegion](../src/Common/MapRegion.ts).

Список сетей в окне персонализации — Yandex, BIGO и VK. Прежние ограничения
согласия, совершеннолетия, ATT и отдельного разрешения передачи геолокации
сохранены; см. [реализацию настроек](v2.6.0-stage-12-ad-privacy.md).
Удаление SDK из приложения и конфигурация медиации в рекламном кабинете —
отдельные действия: состояние кабинета проверяет владелец.

## SKAdNetwork

Проверено 13.11.2026: 228 уникальных ID из [инструкции Яндекса](https://ads.yandex.com/helpcenter/ru/dev/ios/skadnetwork)
и 109 из [официальной инструкции BIGO](https://www.bigossp.com/guide/sdk/ios/document)
дают **231 уникальный ID**. BIGO публикует исходный список в
[Markdown своей документации](https://d2id3bjxkfvtsj.cloudfront.net/bigo-ads-doc-external/ios/docs_integration.md).
ID VK `n9x2a789qt` и `r26jy69rpl` из [инструкции RN-плагина](https://github.com/yandexmobile/yandex-ads-react-native-plugin)
уже входят в список Яндекса.

Из прежних 244 записей удалены 13, отсутствующие в этих списках. Сохранены
`6rd35atwn8`, `qwpu75vrh2`, `z959bm4gru`, необходимые BIGO сверх списка Яндекса.
`f38h382jlk.skadnetwork` также сохранён: он присутствует у оставшихся сетей;
запись атрибуции не означает наличие Chartboost SDK в приложении.
Остальные настройки Info.plist, включая scene manifest и ATS, сохранены.

## Проверки

На Windows прошли typecheck, **50 suites / 562 tests**, production JS-бандл iOS
и применение нового патча к установленному npm-пакету 8.6.0. В Android
`releaseRuntimeClasspath` разрешены целевые SDK/адаптеры; Chartboost и legacy
`exoplayer-core` отсутствуют. Полный Android Release/R8 собран для всех четырёх ABI;
APK имеет версию 2.6.1 (83), Chartboost отсутствует и в R8 mapping.
Нативные CocoaPods/Swift compile и поведение рекламы
на устройствах проверяются отдельно: JS-бандл и Jest не заменяют эти проверки.

Для приёмки на обеих платформах: integration debugger и тестовые блоки BIGO/VK,
inline/sticky/rewarded, закрытие, фон/foreground, unmount и повторные показы;
отказ/согласие, ATT и запрет координат без полного набора разрешений.
Тестовые unit ID не должны попадать в production-конфигурацию.

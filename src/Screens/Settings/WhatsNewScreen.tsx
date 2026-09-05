import React, {Fragment} from "react";
import {useTheme} from "react-native-paper";
import {ScrollView, View} from "react-native";
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NavigationHeader} from "../CommonComponents/DrawerHeader";
import {WhatsNewChange, WhatsNewLogo} from "./Components";
import {CustomTheme} from "../../Themes/Themes"



const WhatsNewScreen: React.FC<{navigation: any, route: any}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const insets = useSafeAreaInsets();
    return (
      // <SafeAreaView edges={['left', 'right', 'bottom']} style={{flex:1, justifyContent: 'flex-start', backgroundColor: colors.backdrop}}>
      <Fragment>
            <NavigationHeader {...props} backable title={'Что нового ?'}/>
            <View style={[{ alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}]}>
                <ScrollView style={{width: '90%'}} contentContainerStyle={{paddingBottom: Math.max(24, insets.bottom + 12)}}>
                    <WhatsNewLogo title={'Поддержка продолжается'} version={'2.4.0'}/>
                    <WhatsNewChange title={'Улучшения 2ФА: добавлены поддержка TOTP, оптимальный порядок перебора и сообщение, откуда брать код'}/>
                    <WhatsNewChange title={'Поиск расписаний теперь доступен всегда, в том числе во время каникул и без входа в БАРС'}/>
                    <WhatsNewChange title={'Добавлены реклама и токены для открытия кастомизаций - чтобы поддерживать существование проекта'}/>
                    <WhatsNewChange title={'Обновлены ключевые зависимости, исправлен ряд визуальных и технических проблем'}/>

                    <WhatsNewLogo title={'Второй фактор и места, где он обитает'} version={'2.3.1'}/>
                    <WhatsNewChange title={'Восстановлен вход с 2ФА: добавлены задержки перед запросами кода через следующих провайдеров при провале отправки'}/>
                    <WhatsNewChange title={'Восстановлена авторегистрация при сканировании QR-кодов БАРС для аккаунтов с 2ФА'}/>
                    <WhatsNewChange title={'Использование ввода пользователя в качестве названия запрошенного расписания при его отсутствии'}/>

                    <WhatsNewLogo title={'Новые реалии'} version={'2.3.0'}/>
                    <WhatsNewChange title={'Восстановление сессии при открытии приложения - больше не нужно вводить код каждый раз!'}/>
                    <WhatsNewChange title={'Добавлена поддержка временных кодов подтверждения!'}/>
                    <WhatsNewChange title={'Изменён приоритет провайдеров 2ФА - код будет приходить через ВК чаще, чем через MAX(если ВК привязан)'}/>
                    <WhatsNewChange title={'Добавлен раздел помощи(кнопка "?") на экран ввода кода с описанием возможных проблем и путей их решения'}/>
                    <WhatsNewChange title={'Актуализированы сообщения при неуспешных попытках входа и иные тексты'}/>
                    <WhatsNewChange title={'Исправлен слишком маленький отступ сверху, нарушавший доступность бокового меню на iOS'}/>
                    <WhatsNewChange title={'Восстановлен показ учебной недели и стипендий, повышена устойчивость к их изменениям'}/>
                    <WhatsNewChange title={'Актуализированы точки на карте'}/>
                    <WhatsNewChange title={'Мелкие исправления и улучшения'}/>

                    <WhatsNewLogo title={'Второй фактор'} version={'2.2.0'}/>
                    <WhatsNewChange title={'Поддержка входа с включённой 2ФА с любым провайдером!'}/>
                    <WhatsNewChange title={'Восстановлено отображение приказов и анкет'}/>
                    <WhatsNewChange title={'Исправлены чрезмерные отступы сверху на свежих iOS и Android и иные визуальные недочёты'}/>
                    <WhatsNewChange title={'Актуализация зависимостей во избежание проблем'}/>

                    <WhatsNewLogo title={'Осенняя адаптация'} version={'2.1.0'}/>
                    <WhatsNewChange title={'Восстановлено отображение пропусков занятий'}/>
                    <WhatsNewChange title={'Исправления расписания(как в самом приложении, так и в виджете)'}/>
                    <WhatsNewChange title={'Улучшены описания проблем при неудачных попытках входа'}/>
                    <WhatsNewChange title={'Запрос расписания аудитории по нажатию на неё(вместо бесполезного показа корпуса)'}/>
                    <WhatsNewChange title={'Заключительный этап обновления зависимостей и кода проекта в целом'}/>

                    <WhatsNewLogo title={'Новое начало'} version={'2.0.0'}/>
                    <WhatsNewChange title={'Масштабное обновление всех зависимостей => полноценная поддержка свежих версий iOS и Android!'}/>
                    <WhatsNewChange title={'Карта: построение маршрутов в любую точку по долгому нажатию, в том числе и на iOS, другие улучшения'}/>
                    <WhatsNewChange title={'QR-Сканер: возможность зума'}/>
                    <WhatsNewChange title={'Доступ к разделу настроек для не выполнивших вход пользователей'}/>
                    <WhatsNewChange title={'Новый вариант получения техподдержки'}/>
                    <WhatsNewChange title={'Огромное кол-во технических и визуальных правок'}/>

                    <WhatsNewLogo title={'Сюрприз на ДР'} version={'1.4.1'}/>
                    <WhatsNewChange title={'Хотфикс получения группы => расписания после изменений в БАРС'}/>
                    <WhatsNewChange title={'Добавлен просмотр расписания по аудитории!'}/>

                    <WhatsNewLogo title={'Первомайское обновление'} version={'1.4.0'}/>
                    <WhatsNewChange title={'Реализован показ кол-ва новых писем в ОСЭП с кнопкой перехода в почту при их наличии!'}/>
                    <WhatsNewChange title={'Решены проблемы со входом для ряда редких ситуаций в аккаунтах БАРС'}/>
                    <WhatsNewChange title={'Улучшения расписания - теперь доступен для просмотра весь семестр целиком!'}/>
                    <WhatsNewChange title={'Переработан блок информации о студенте'}/>
                    <WhatsNewChange title={'Множество небольших технических и визуальных улучшений'}/>

                    <WhatsNewLogo title={'Переход в рабочий режим'} version={'1.3.1'}/>
                    <WhatsNewChange title={'Доработан QR-Сканер с учётом отличий в регистрации присутствия для разных аккаунтов БАРС'}/>
                    <WhatsNewChange title={'Добавление кнопок перехода в соответствующий раздел сайта БАРС когда от студента там ожидаются действия'}/>
                    <WhatsNewChange title={'Восстановлен показ типов пропущенных занятий'}/>
                    <WhatsNewChange title={'Различные мелкие правки'}/>

                    <WhatsNewLogo title={'Сканирование нового семестра'} version={'1.3.0'}/>
                    <WhatsNewChange title={'Исправлена проблема со входом у некоторых типов аккаунтов после новых изменений в БАРС!'}/>
                    <WhatsNewChange title={'Реализован сканер QR-кодов - с быстрой регистрацией присутствия на паре и кастомизацией!'}/>
                    <WhatsNewChange title={'Очередная актуализация маркеров на карте'}/>
                    <WhatsNewChange title={'Исправления более мелких проблем и визуальные улучшения'}/>

                    <WhatsNewLogo title={'Предновогодняя суета'} version={'1.2.0'}/>
                    <WhatsNewChange title={'Хотфикс входа - адаптация к изменениям авторизации в БАРС'}/>
                    <WhatsNewChange title={'Реализован новый раздел БАРС - Книги!'}/>
                    <WhatsNewChange title={'Восстановлено отображение последней оффлайн-копии расписания в случае его отсутствия на сайте'}/>
                    <WhatsNewChange title={'Небольшие правки на основе фидбека'}/>

                    <WhatsNewLogo title={'Сентябрь горит'} version={'1.1.2'}/>
                    <WhatsNewChange title={'Решены проблемы в виджете'}/>
                    <WhatsNewChange title={'Реализован показ заявлений на стипендии'}/>
                    <WhatsNewChange title={'Актуализация точек на карте'}/>
                    <WhatsNewChange title={'Новые альтернативные иконки'}/>
                    <WhatsNewChange title={'Различные правки на основе фидбека, в том числе авторизации'}/>

                    <WhatsNewLogo title={'Готовность № 1'} version={'1.1.1'}/>
                    <WhatsNewChange title={'Хотфикс `долгов` при отсутствии `Сдать до` у дисциплины в БАРС в период смены семестров'}/>
                    <WhatsNewChange title={'Хотфиксы виджета расписания для его корректной работы'}/>

                    <WhatsNewLogo title={'На низком старте'} version={'1.1.0'}/>
                    <WhatsNewChange title={'Виджет расписания под iOS и Android!'}/>
                    <WhatsNewChange title={'Улучшение и добавление состояний для дисциплин после закрытия БАРС'}/>
                    <WhatsNewChange title={'Корректная авторизация в случае нестандартной страницы входа в БАРС'}/>
                    <WhatsNewChange title={'Обновление зависимостей, другие технические и визуальные улучшения'}/>

                    <WhatsNewLogo title={'Финальные расчёты'} version={'1.0.7'}/>
                    <WhatsNewChange title={'Добавлен анализ и предупреждение о доступности оценки ПА за `добросовестность`!'}/>
                    <WhatsNewChange title={'Реализованы счётчики важных вещей для каждого подходящего раздела'}/>
                    <WhatsNewChange title={'Небольшие технические и визуальные правки'}/>

                    <WhatsNewLogo title={'Весеннее обострение(не опять, а снова)'} version={'1.0.6'}/>
                    <WhatsNewChange title={'Хотфикс входа - адаптация под изменения в БАРС!'}/>
                    <WhatsNewChange title={'Добавлен показ группы для пар в расписании преподавателей'}/>

                    <WhatsNewLogo title={'Нам нужно больше правок!'} version={'1.0.5'}/>
                    <WhatsNewChange title={'Отдельные таймауты для операций получения данных - минимизированы случаи бесконечной загрузки!'}/>
                    <WhatsNewChange title={'Удалены дубли пар в расписании преподавателей'}/>
                    <WhatsNewChange title={'Корректный показ Обеда во всех случаях'}/>
                    <WhatsNewChange title={'Очередные изменения на карте'}/>
                    <WhatsNewChange title={'Снижение размера приложения(png -> webp)'}/>

                    <WhatsNewLogo title={'Небольшие, но важные правки'} version={'1.0.4'}/>
                    <WhatsNewChange title={'Исправлено неверное получение группы при наличии в ФИО 4 и более слов'}/>
                    <WhatsNewChange title={'Добавление маркеров на карту, в т.ч. недостающих корпусов'}/>

                    <WhatsNewLogo title={'Первые хотфиксы релиза'} version={'1.0.1 - 1.0.3'}/>
                    <WhatsNewChange title={'Исправлена некорректная начальная прокрутка расписания'}/>
                    <WhatsNewChange title={'Адаптация получения данных для случая отсутствия отчества у студента'}/>
                    <WhatsNewChange title={'Коррекция авторизации для редкого состояния личных кабинетов'}/>
                    <WhatsNewChange title={'Реализован показ веса каждого КМ'}/>

                    <WhatsNewLogo title={'Долгожданный релиз!'} version={'1.0.0'}/>
                    <WhatsNewChange title={'Приложение полноценно выпущено в Google Play и App Store!'}/>
                    <WhatsNewChange title={'Технические и визуальные улучшения'}/>
                    <WhatsNewChange title={'Актуализация маркеров на карте'}/>
                    <WhatsNewChange title={'Теперь Open Source - проект на GitHub стал публичным'}/>
                    <WhatsNewChange title={'В честь релиза ниже доступна вся история изменений!'}/>

                    <WhatsNewLogo title={'Год начинается с исправлений...'} version={'0.8.2-beta'}/>
                    <WhatsNewChange title={"Очередные правки календаря, связанные с сессией"}/>
                    <WhatsNewChange title={"Расширен диапазон показа расписания"}/>
                    <WhatsNewChange title={'Всем удачи на экзаменах!'}/>

                    <WhatsNewLogo title={'Закрывающие год фиксы!'} version={'0.8.1-beta'}/>
                    <WhatsNewChange title={"'Сдать до', анализ КМ и др. адаптировано под изменения в БАРС"}/>
                    <WhatsNewChange title={'Исправлен механизм показа названий дней недели'}/>
                    <WhatsNewChange title={'Мелкие изменения'}/>
                    <WhatsNewChange title={'С Новым 2024 Годом!'}/>

                    <WhatsNewLogo title={'Beta: сессия близко'} version={'0.8.0-beta'}/>
                    <WhatsNewChange title={'Добавлен просмотр расписания любой группы/преподавателя по запросу!'}/>
                    <WhatsNewChange title={'Добавлены фильтры категорий точек на карте!'}/>
                    <WhatsNewChange title={'Исправлен периодический вылет в расписании на IOS'}/>
                    <WhatsNewChange title={'Другие технические и визуальные правки'}/>

                    <WhatsNewLogo title={'Beta: дизайн и улучшения на основе фидбека'} version={'0.7.2-beta'}/>
                    <WhatsNewChange title={'Новый, адекватный дизайн светлой темы!'}/>
                    <WhatsNewChange title={'Исправлена проблема со входом для редких вариантов аккаунта'}/>
                    <WhatsNewChange title={'Корректная надпись вместо ошибки при отсутствии пропусков'}/>
                    <WhatsNewChange title={'Добавление и уточнение мест на карте'}/>
                    <WhatsNewChange title={'Обновление зависимостей, другие технические и визуальные улучшения'}/>

                    <WhatsNewLogo title={'А вот и Beta-версия!'} version={'0.7.0-beta'}/>
                    <WhatsNewChange title={'Реализованы разделы БАРС: Задания, Стипендии, Приказы, Анкеты!'}/>
                    <WhatsNewChange title={'Отображение Зачётной недели, Сессии, её завершения на экране оценок'}/>
                    <WhatsNewChange title={'Ускорена загрузка данных!'}/>
                    <WhatsNewChange title={'Исправлено множество ошибок'}/>
                    <WhatsNewChange title={'Различные визуальные улучшения'}/>

                    <WhatsNewLogo title={'Майские праздники? Нет, обновления.'} version={'0.5.0-alpha - 0.5.1-alpha'}/>
                    <WhatsNewChange title={'Реализовано расписание преподавателей (по нажатию на ФИО)!'}/>
                    <WhatsNewChange title={'Реализован показ преподавателей на экране оценок'}/>
                    <WhatsNewChange title={'Немного визуальных и много технических изменений'}/>
                    <WhatsNewChange title={'Первомай - Мир, Труд, Wi-Fi!'}/>
                    <WhatsNewChange title={'С Днём Победы!'}/>

                    <WhatsNewLogo title={'Весенние обострения... и обновления)'} version={'0.4.6-alpha - 0.4.8-alpha'}/>
                    <WhatsNewChange title={'Переход в оффлайн-режим при плохой сети - опробован и доработан таймаут'}/>
                    <WhatsNewChange title={'Исправление получения и показа пропущенных занятий'}/>
                    <WhatsNewChange title={'Хотфикс входа в обновлённый в очередной раз БАРС!'}/>
                    <WhatsNewChange title={'Повышение устойчивости приложения к изменениям в БАРСе'}/>

                    <WhatsNewLogo title={'Новый семестр - новая версия.'} version={'0.4.5-alpha'}/>
                    <WhatsNewChange title={'Показ загруженного расписания при его отсутствии в БАРС'}/>
                    <WhatsNewChange title={'Корректная демонстрация чисел и дней недели в расписании'}/>
                    <WhatsNewChange title={'Исправление вылета при повторном открытии карты на Android'}/>
                    <WhatsNewChange title={'Визуальные и другие улучшения'}/>

                    <WhatsNewLogo title={'Что, первые фиксы года прямо на сессии?! Да!'} version={'0.4.3-alpha - 0.4.4-alpha'}/>
                    <WhatsNewChange title={'Корректное отображение БАРС почти у всех пользователей!'}/>
                    <WhatsNewChange title={'Мелкие исправления и улучшения'}/>

                    <WhatsNewLogo title={'Новогоднее обновление!'} version={'0.4.2-alpha'} />
                    <WhatsNewChange title={'Анализ КМ после закрытия БАРС!("Все КМ сданы"/"Долг !")'}/>
                    <WhatsNewChange title={'Исправление получения текущей учебной недели (снова)'}/>
                    <WhatsNewChange title={'Долгожданный выпуск большинства последних изменений под IOS!'}/>
                    <WhatsNewChange title={'Всех с наступающим (или уже с наступившем) !'}/>

                    <WhatsNewLogo title={'Фикс с добавкой в честь начала зимы!)'} version={'0.4.1-alpha'}/>
                    <WhatsNewChange title={'Исправление вылета в расписании'}/>
                    <WhatsNewChange title={'Добавление новой иконки'}/>

                    <WhatsNewLogo title={'Alpha: долгожданное обновление!'} version={'0.4.0-alpha'}/>
                    <WhatsNewChange title={'Автофокусировка на текущем дне при открытии расписания'}/>
                    <WhatsNewChange title={'Множество исправлений самых разных ошибок и проблем'}/>
                    <WhatsNewChange title={'Замена "Спортзал" на "Стадион" в расписании'}/>
                    <WhatsNewChange title={'Грамматически верная демонстрация буквы ё'}/>
                    <WhatsNewChange title={'Цветовая дифференциация типов пар, дисциплин, рейтинга, статуса обучения'}/>
                    <WhatsNewChange title={'Улучшение цветовой гаммы обоих тем'}/>
                    <WhatsNewChange title={'Карта: буквы корпусов, правки мест, новые цвета маршрутов'}/>

                    <WhatsNewLogo title={'Alpha: исправления и улучшения на основе первичного фидбека'} version={'0.3.3-alpha'}/>
                    <WhatsNewChange title={'Расширение диапазона дат расписания, включая просмотр прошедших дней'}/>
                    <WhatsNewChange title={'Фикс демонстрации отчётов'}/>
                    <WhatsNewChange title={'Карта: небольшие исправления и добавление мест'}/>
                    <WhatsNewChange title={'Добавлены две новые альтернативные иконки (android)'}/>

                    <WhatsNewLogo title={'Патч первого дня'} version={'0.3.1-alpha'}/>
                    <WhatsNewChange title={'Фикс входа в аккаунт (ЭР-02-19, ТФ-11м-20 ИГ-02-19)'}/>
                    <WhatsNewChange title={'Фикс парсера зачетной книжки (ТФ-11м-20)'}/>
                    <WhatsNewChange title={'Фикс автозаполнения пароля'}/>
                    <WhatsNewChange title={'Добавлена кнопка поддержки на экран авторизации'}/>

                    <WhatsNewLogo title={'Alpha наконец-то здесь!'} version={'0.3.0-alpha'}/>
                    <WhatsNewChange title={'Реализован раздел расписания'}/>
                    <WhatsNewChange title={'Реализован раздел БАРС\'а, включая 4 подраздела'}/>
                    <WhatsNewChange title={'Реализован раздел карты'}/>
                    <WhatsNewChange title={'Реализован предварительный вид раздела почты (только для IOS)'}/>
                    <WhatsNewChange title={'Исправлено большое количество различных ошибок'}/>

                </ScrollView>
            </View>
      </Fragment>
     // </SafeAreaView>
    )
}

export default WhatsNewScreen

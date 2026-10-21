import type {GratitudeCategory} from './GratitudeSection';

const unknownAvatar = require('../../../assets/images/Gratitudies/unknown.webp');

export const GRATITUDE_CATEGORIES: readonly GratitudeCategory[] = [
  {
    id: 'pre-alpha',
    title: 'Тестеры версий pre-alpha',
    people: [
      {title: 'Гэсэр Петрунин', links: ['https://t.me/gpetrunin', 'https://vk.ru/g.petrunin'], image: require('../../../assets/images/Gratitudies/GAS.webp')},
      {title: 'Александр Ерёмичев', links: ['https://vk.ru/micke259'], image: require('../../../assets/images/Gratitudies/San.webp')},
      {title: 'Сергей Выскиль', links: ['https://vk.ru/seeeergey'], image: require('../../../assets/images/Gratitudies/Sergey.webp')},
      {title: 'Егор Гаврилов', links: ['https://vk.ru/nxce16'], image: require('../../../assets/images/Gratitudies/Egor.webp')},
    ],
  },
  {
    id: 'donations',
    title: 'Оказали финансовую поддержку',
    people: [
      {title: 'Егор Клишин', links: ['https://vk.ru/astralcheak'], image: require('../../../assets/images/Gratitudies/Klishin.webp')},
      {title: 'Вы тоже можете поддержать проект!', links: ['https://vk.ru/dragonsava'], image: unknownAvatar, isCallToAction: true},
    ],
  },
  {
    id: '2fa',
    title: 'Помощь с реализацией поддержки временных кодов 2ФА',
    people: [
      {title: 'Максим Агафошин', links: ['https://vk.ru/inclydeahaha'], image: require('../../../assets/images/Gratitudies/MaxAgafoshin.webp')},
    ],
  },
  {
    id: 'login',
    title: 'Помощь с актуализацией поведения для входа в аккаунт',
    people: [
      {title: 'Макс Горячев', links: ['https://vk.ru/kreozi'], image: require('../../../assets/images/Gratitudies/MaxHot.webp')},
    ],
  },
  {
    id: 'accounts',
    title: 'Предоставили доступ к аккаунту БАРС',
    people: [
      {title: 'Злата Винарская', links: ['https://t.me/Vinarskaya_Zlata', 'https://vk.ru/zlatavina'], image: require('../../../assets/images/Gratitudies/ZlataV.webp')},
      {title: 'Соня Головина', links: ['https://t.me/missonyx', 'https://vk.ru/soflairy'], image: require('../../../assets/images/Gratitudies/SonyaGo.webp')},
      {title: 'Просто Чел', links: ['https://vk.ru/id756474512'], image: require('../../../assets/images/Gratitudies/JustHaritonenko.webp')},
      {title: 'Вы тоже можете помочь!', links: ['https://vk.ru/dragonsava'], image: unknownAvatar, isCallToAction: true},
    ],
  },
  {
    id: 'accounts-before-2fa',
    title: 'Предоставили аккаунт БАРС (до введения 2ФА)',
    people: [
      {title: 'Николай', links: ['https://vk.ru/naavdeev'], image: require('../../../assets/images/Gratitudies/Nick.webp')},
      {title: 'Иван', links: ['https://vk.ru/iva_derevo'], image: require('../../../assets/images/Gratitudies/Ivan.webp')},
      {title: 'Алиса', links: ['https://vk.ru/space_cat_1'], image: require('../../../assets/images/Gratitudies/Alisa.webp')},
      {title: 'Максим', links: ['https://vk.ru/m.nistratov'], image: require('../../../assets/images/Gratitudies/Maksim.webp')},
      {title: 'Анастасия', links: ['https://vk.ru/nikelkatalizator'], image: require('../../../assets/images/Gratitudies/Anastasia.webp')},
      {title: 'Екатерина', links: ['https://vk.ru/s_kat27'], image: require('../../../assets/images/Gratitudies/Katya.webp')},
      {title: 'Степан', links: ['https://vk.ru/vvvizg'], image: require('../../../assets/images/Gratitudies/Adam.webp')},
      {title: 'Александр', links: ['https://vk.ru/morbiuse'], image: require('../../../assets/images/Gratitudies/shabanin.webp')},
      {title: 'Богдан Потапкин', links: ['https://vk.ru/bodyapotapkin'], image: require('../../../assets/images/Gratitudies/BogdanPotapkin.webp')},
      {title: 'Андрей Кошеваров', links: ['https://vk.ru/drewshiiiiish'], image: require('../../../assets/images/Gratitudies/AndreyKoshevarov.webp')},
      {title: 'Лилияна Рожница', links: ['https://vk.ru/lovlycherry'], image: require('../../../assets/images/Gratitudies/Lilia.webp')},
      {title: 'Артём Темнышев', links: ['https://vk.ru/begun1ok'], image: require('../../../assets/images/Gratitudies/ArtemTemn.webp')},
      {title: 'Джалал Гусейнов', links: ['https://vk.ru/jjjall'], image: require('../../../assets/images/Gratitudies/jjjall.webp')},
      {title: 'Сергей Мелихов', links: ['https://vk.ru/sergeymelikhov'], image: require('../../../assets/images/Gratitudies/SergeyMelihov.webp')},
      {title: 'Никита Помогалов', links: ['https://t.me/KOSTERCHIK', 'https://vk.ru/disokily'], image: require('../../../assets/images/Gratitudies/NickPomogalov.webp')},
      {title: 'Максим Андреев', links: ['https://vk.ru/id520560547'], image: require('../../../assets/images/Gratitudies/MaxAndreev.webp')},
      {title: 'Екатерина Филязова', links: ['https://vk.ru/katriiiiinnnnnnn'], image: require('../../../assets/images/Gratitudies/KatrinFeel.webp')},
      {title: 'Рания Шабанова', links: ['https://vk.ru/qwrssq'], image: require('../../../assets/images/Gratitudies/RaniaShab.webp')},
      {title: 'Кирилл Рожков', links: ['https://vk.ru/idkiryhaa'], image: require('../../../assets/images/Gratitudies/KirillRozhkov.webp')},
      {title: 'Дмитрий Гущин', links: ['https://vk.ru/gudimlol'], image: require('../../../assets/images/Gratitudies/GushchinDV.webp')},
      {title: 'Максим Аванесов', links: ['https://vk.ru/inspektor_skelet'], image: require('../../../assets/images/Gratitudies/MaxAvanesov.webp')},
      {title: 'Егор Афанасьев', links: ['https://vk.ru/egoraffonya'], image: require('../../../assets/images/Gratitudies/EgorAfanasyev.webp')},
      {title: 'Никита Тимофеев', links: ['https://vk.ru/no_mercy_or_forgiveness'], image: require('../../../assets/images/Gratitudies/NickTimofeev.webp')},
      {title: 'Яша Рубинова', links: ['https://vk.ru/trancqiue'], image: require('../../../assets/images/Gratitudies/YashaRuby.webp')},
      {title: 'Кирилл Дедов', links: ['https://vk.ru/dedov_k'], image: require('../../../assets/images/Gratitudies/KirillDed.webp')},
    ],
  },
  {
    id: 'map',
    title: 'Наполнение/уточнение карты',
    people: [
      {title: 'Денис', links: ['https://vk.ru/aokich0'], image: require('../../../assets/images/Gratitudies/Den.webp')},
      {title: 'Анна', links: ['https://vk.ru/minina0803'], image: require('../../../assets/images/Gratitudies/Anna.webp')},
      {title: 'Даниил Подзюбан', links: ['https://vk.ru/danko3264'], image: require('../../../assets/images/Gratitudies/DanylPodzuban.webp')},
      {title: 'Анастасия Карабанова', links: ['https://vk.ru/rastvorilas'], image: require('../../../assets/images/Gratitudies/AK.webp')},
      {title: 'Вы тоже можете помочь с картой!', links: ['https://vk.ru/dragonsava'], image: unknownAvatar, isCallToAction: true},
    ],
  },
  {
    id: 'design',
    title: 'Дизайн',
    people: [
      {title: 'Максим Крайнов', links: ['https://vk.ru/id240979343'], image: require('../../../assets/images/Gratitudies/MaxKryanov.webp')},
    ],
  },
  {
    id: 'ui',
    title: 'Выявление проблем с адаптивностью UI',
    people: [
      {title: 'Чокопай', links: ['https://t.me/fallfor_w', 'https://vk.ru/kamila137'], image: require('../../../assets/images/Gratitudies/ChocoKamila.webp')},
    ],
  },
  {
    id: 'icons',
    title: 'Альтернативные иконки',
    people: [
      {title: "Алиса 'Alnijen' Балашова", links: ['https://vk.ru/alnijen'], image: require('../../../assets/images/Gratitudies/alnijen.webp')},
      {title: 'Даниил Шеремет', links: ['https://vk.ru/sheremetvideo'], image: require('../../../assets/images/Gratitudies/Sheremet.webp')},
      {title: 'Вы тоже можете предложить свою иконку!', links: ['https://vk.ru/dragonsava'], image: unknownAvatar, isCallToAction: true},
    ],
  },
];

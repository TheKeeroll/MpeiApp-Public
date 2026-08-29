import {Gender, Location, type AdTargetingParams} from 'yandex-mobile-ads';
import BARSAPI from '../Common/Globals';
import {INITIAL_MAP_REGION, isValidMapCoordinates, type MapCoordinates} from '../Common/MapRegion';

const DEFAULT_AGE = 19;

const FEMALE_FIRST_NAMES = new Set([
  'агата', 'агния', 'ада', 'алевтина', 'александра', 'алена', 'алина', 'алиса', 'алла', 'альбина',
  'амалия', 'анастасия', 'ангелина', 'анжела', 'анна', 'антонина', 'валентина', 'валерия', 'варвара',
  'василиса', 'вера', 'вероника', 'виктория', 'галина', 'дарина', 'дарья', 'диана', 'евгения', 'екатерина',
  'елена', 'елизавета', 'жанна', 'злата', 'зоя', 'инна', 'ирина', 'карина', 'кира', 'кристина', 'ксения',
  'лада', 'лариса', 'лидия', 'любовь', 'людмила', 'майя', 'маргарита', 'марина', 'мария', 'милана',
  'надежда', 'наталья', 'нина', 'оксана', 'олеся', 'ольга', 'полина', 'раиса', 'регина', 'светлана',
  'серафима', 'снежана', 'софия', 'таисия', 'тамара', 'татьяна', 'ульяна', 'юлия', 'яна', 'элина', 'эльвира',
]);

const normalizeFirstName = (name?: string): string => (
  name
    ?.trim()
    .split(/[\s-]+/)[0]
    ?.toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    ?? ''
);

export const getAdmissionYearFromGroup = (group?: string): number | undefined => {
  const lastNumber = group?.match(/(\d{2,4})(?!.*\d)/)?.[1];
  if (!lastNumber) {
    return undefined;
  }

  return lastNumber.length === 2 ? 2000 + Number(lastNumber) : Number(lastNumber);
};

export const getTargetedAge = (group?: string, currentYear = new Date().getFullYear()): number => {
  const admissionYear = getAdmissionYearFromGroup(group);
  if (!admissionYear || admissionYear < 2000 || admissionYear > currentYear) {
    return DEFAULT_AGE;
  }

  return 18 + (currentYear - admissionYear);
};

export const getTargetedGender = (firstName?: string): Gender => (
  FEMALE_FIRST_NAMES.has(normalizeFirstName(firstName)) ? Gender.Female : Gender.Male
);

/**
 * contextQuery/contextTags intentionally stay empty: MpeiApp has no user-entered
 * ad-search query, and study subjects or BARS data are not ad-context signals.
 */
export const createAdsTargeting = (sessionLocation?: MapCoordinates | null): AdTargetingParams => {
  const student = BARSAPI.mCurrentData.student;
  const location = sessionLocation && isValidMapCoordinates(sessionLocation)
    ? sessionLocation
    : INITIAL_MAP_REGION;

  return {
    age: String(getTargetedAge(student?.group)),
    gender: getTargetedGender(student?.name),
    location: new Location(location.lat, location.lon),
  };
};

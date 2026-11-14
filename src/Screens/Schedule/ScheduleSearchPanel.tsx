import React, {useEffect, useRef, useState} from 'react';
import {Animated, ScrollView, Text, TouchableOpacity, useWindowDimensions, View} from 'react-native';
import {TextInput, useTheme} from 'react-native-paper';
// @ts-expect-error The bundled icon package has no type declarations.
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {withOpacity, type CustomTheme} from '../../Themes/Themes';
import DailyUsageBadge from '../../Loyalty/DailyUsageBadge';
import {isValidScheduleQuery} from '../../API/Parsers/ScheduleDiscoveryParser';
import type {ScheduleRequestType} from '../../API/DataTypes';
import {compactScheduleName, SCHEDULE_LIST_LIMIT, type SavedSchedule} from '../../Schedule/ScheduleSearchLibrary';
import {useScheduleSearchLibrary} from '../../Schedule/useScheduleSearchLibrary';

type ScheduleSearchPanelProps = {
  onSearch: (query: string, type?: ScheduleRequestType) => void;
  onQueryChange?: (normalizedQuery: string) => void;
};

const ScheduleSearchPanel: React.FC<ScheduleSearchPanelProps> = ({onSearch, onQueryChange}) => {
  const {colors} = useTheme<CustomTheme>();
  const {height} = useWindowDimensions();
  const {store, recent, favorites} = useScheduleSearchLibrary();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const submitted = useRef(false);
  const formOpacity = useRef(new Animated.Value(0)).current;
  const normalizedQuery = query.trim();
  const canSearch = isValidScheduleQuery(query);

  useEffect(() => {
    formOpacity.setValue(0);
    if (!isExpanded) return;
    const animation = Animated.timing(formOpacity, {toValue: 1, duration: 180, useNativeDriver: true});
    animation.start();
    return () => animation.stop();
  }, [formOpacity, isExpanded]);

  const submitQuery = (value: string, type?: ScheduleRequestType) => {
    if (submitted.current || !isValidScheduleQuery(value)) return;
    submitted.current = true;
    onSearch(value.trim(), type);
    setQuery('');
    onQueryChange?.('');
    setIsExpanded(false);
  };
  const submit = () => submitQuery(normalizedQuery);
  const handleQueryChange = (value: string) => {
    setQuery(value);
    onQueryChange?.(value.trim());
  };

  const shortcutList = (items: readonly SavedSchedule[], favorite: boolean) => (
    <View style={{flex: 1, minWidth: 0}}>
      <View accessible accessibilityRole="header" accessibilityLabel={favorite ? 'Избранные расписания' : 'Последние расписания'}
        style={{alignItems: 'center', paddingVertical: 6}}>
        <Icon name={favorite ? 'bookmark-multiple' : 'history'} size={22} color={colors.textUnderline}/>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{maxHeight: Math.max(100, Math.min(300, height * 0.3))}}>
        {items.length === 0 && <Text accessibilityLabel={favorite ? 'Нет избранных расписаний' : 'Нет последних расписаний'}
          style={{textAlign: 'center', color: withOpacity(colors.text, 50), padding: 10}}>—</Text>}
        {items.map(entry => (
          <View key={`${entry.type}:${entry.id}`} style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5, borderRadius: 6, backgroundColor: colors.background}}>
            <TouchableOpacity onPress={() => submitQuery(entry.name, entry.type)} accessibilityRole="button"
              accessibilityLabel={`Найти расписание: ${entry.name}`} style={{flex: 1, minWidth: 0, minHeight: 42, paddingVertical: 6, paddingHorizontal: 6, justifyContent: 'center'}}>
              <Text style={{fontSize: 13, color: colors.textUnderline}}>{compactScheduleName(entry)}</Text>
            </TouchableOpacity>
            {!favorite && favorites.length < SCHEDULE_LIST_LIMIT && (
              <TouchableOpacity onPress={() => store.addFavorite(entry)} disabled={store.isFavorite(entry)} accessibilityRole="button"
                accessibilityLabel={`В избранное: ${entry.name}`} accessibilityState={{disabled: store.isFavorite(entry)}}
                style={{minHeight: 42, width: 30, alignItems: 'center', justifyContent: 'center', opacity: store.isFavorite(entry) ? 0.3 : 1}}>
                <Icon name="bookmark-plus-outline" size={20} color={colors.textUnderline}/>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => favorite ? store.removeFavorite(entry) : store.removeRecent(entry)} accessibilityRole="button"
              accessibilityLabel={`Удалить из ${favorite ? 'избранного' : 'последних'}: ${entry.name}`}
              style={{minHeight: 42, width: 30, alignItems: 'center', justifyContent: 'center'}}>
              <Icon name="delete-outline" size={19} color={withOpacity(colors.text, 65)}/>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{width: '90%', alignSelf: 'center', marginTop: 14, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface}}>
      <TouchableOpacity onPress={() => { if (!isExpanded) submitted.current = false; setIsExpanded(previous => !previous); }} accessibilityRole="button"
        accessibilityState={{expanded: isExpanded}} style={{minHeight: 42, paddingHorizontal: 10, justifyContent: 'center'}}>
        <Text style={{color: colors.textUnderline, fontSize: 16}}>Другая группа/препод./ауд.</Text>
      </TouchableOpacity>
      {isExpanded && (
        <Animated.View style={{padding: 10, paddingTop: 0, opacity: formOpacity}}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TextInput onChangeText={handleQueryChange} value={query} onSubmitEditing={submit}
              accessibilityLabel="Группа, преподаватель или аудитория" textColor={colors.text} placeholder="Не менее 3 символов"
              textContentType="name" returnKeyType="search" placeholderTextColor={withOpacity(colors.text, 40)}
              underlineColor={colors.text} activeUnderlineColor={colors.textUnderline}
              style={{flex: 1, minHeight: 48, borderRadius: 5, justifyContent: 'center', backgroundColor: colors.background}} theme={{colors}}/>
            <View style={{width: 96, marginLeft: 8, alignItems: 'center'}}>
              <TouchableOpacity disabled={!canSearch} onPress={submit} accessibilityRole="button" accessibilityState={{disabled: !canSearch}}
                style={{width: '100%', minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', opacity: canSearch ? 1 : 0.45, backgroundColor: colors.background}}>
                <Text style={{fontSize: 16, fontWeight: 'bold', color: colors.textUnderline}}>Найти</Text>
              </TouchableOpacity>
              <DailyUsageBadge feature="scheduleSearch" style={{marginTop: 5}}/>
            </View>
          </View>
          <View style={{flexDirection: 'row', columnGap: 8, marginTop: 8}}>
            {shortcutList(recent, false)}
            {shortcutList(favorites, true)}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default ScheduleSearchPanel;

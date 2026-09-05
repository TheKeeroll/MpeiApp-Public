import React, {useState} from 'react';
import {LayoutAnimation, Text, TouchableOpacity, View} from 'react-native';
import {TextInput, useTheme} from 'react-native-paper';
import {withOpacity, type CustomTheme} from '../../Themes/Themes';
import DailyUsageBadge from '../../Loyalty/DailyUsageBadge';

type ScheduleSearchPanelProps = {
  onSearch: (query: string) => void;
  onQueryChange?: (normalizedQuery: string) => void;
};

const ScheduleSearchPanel: React.FC<ScheduleSearchPanelProps> = ({onSearch, onQueryChange}) => {
  const {colors} = useTheme<CustomTheme>();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim();

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(previous => !previous);
  };

  const submit = () => {
    if (!normalizedQuery) {
      return;
    }

    onSearch(normalizedQuery);
    setQuery('');
    setIsExpanded(false);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    onQueryChange?.(value.trim());
  };

  return (
    <View
      style={{
        width: '90%',
        alignSelf: 'center',
        marginTop: 14,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: colors.surface,
      }}
    >
      <TouchableOpacity
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityState={{expanded: isExpanded}}
        style={{minHeight: 42, paddingHorizontal: 10, justifyContent: 'center'}}
      >
        <Text style={{color: colors.textUnderline, fontSize: 16}}>
          Другая группа/препод./ауд.
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={{padding: 10, paddingTop: 0, flexDirection: 'row', alignItems: 'center'}}>
          <TextInput
            onChangeText={handleQueryChange}
            value={query}
            onSubmitEditing={submit}
            textColor={colors.text}
            placeholder="Укажите искомое"
            textContentType="name"
            returnKeyType="search"
            placeholderTextColor={withOpacity(colors.text, 40)}
            underlineColor={colors.text}
            activeUnderlineColor={colors.textUnderline}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 5,
              justifyContent: 'center',
              backgroundColor: colors.background,
            }}
            theme={{colors}}
          />
          <View style={{width: 96, marginLeft: 8, alignItems: 'center'}}>
            <TouchableOpacity
              disabled={!normalizedQuery}
              onPress={submit}
              accessibilityRole="button"
              style={{
                width: '100%',
                minHeight: 42,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: normalizedQuery ? 1 : 0.45,
                backgroundColor: colors.background,
              }}
            >
              <Text style={{fontSize: 16, fontWeight: 'bold', color: colors.textUnderline}}>Найти</Text>
            </TouchableOpacity>
            <DailyUsageBadge feature="scheduleSearch" style={{marginTop: 5}}/>
          </View>
        </View>
      )}
    </View>
  );
};

export default ScheduleSearchPanel;

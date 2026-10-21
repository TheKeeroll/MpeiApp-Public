import React from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from 'react-native-paper';
// @ts-expect-error The existing vector-icons package has no local declarations.
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {type CustomTheme, withOpacity} from '../../Themes/Themes';
import {ListAvatarItem, type ListAvatarItemProps} from './Components';
import {GratitudeAvatarStrip} from './GratitudeAvatarStrip';

export interface GratitudePerson extends Pick<ListAvatarItemProps, 'title' | 'image'> {
  links: readonly string[];
  isCallToAction?: boolean;
}
export interface GratitudeCategory {
  id: string;
  title: string;
  people: readonly GratitudePerson[];
}

export const GratitudeSection: React.FC<{category: GratitudeCategory; maxHeight: number; active: boolean}> = ({category, maxHeight, active}) => {
  const {colors} = useTheme<CustomTheme>();
  const participants = category.people.filter(person => !person.isCallToAction);
  const [expanded, setExpanded] = React.useState(participants.length < 3);
  const [headerHeight, setHeaderHeight] = React.useState(64);
  const [footerHeight, setFooterHeight] = React.useState(44);
  const [contentHeight, setContentHeight] = React.useState(0);
  const listHeight = Math.max(0, maxHeight - headerHeight - footerHeight);

  return (
    <View style={{width: '100%', marginTop: 14, borderRadius: 10, backgroundColor: colors.surface, overflow: 'hidden', ...(expanded ? {maxHeight} : {})}}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={category.title}
        accessibilityState={{expanded}} accessibilityHint={expanded ? 'Свернуть список' : 'Показать участников'}
        onPress={() => setExpanded(value => !value)}
        onLayout={event => { if (expanded) setHeaderHeight(event.nativeEvent.layout.height); }}
        style={{padding: 12, flexShrink: 0}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
          <Text style={{flex: 1, color: colors.text, fontSize: 16, fontWeight: '600'}}>{category.title}</Text>
          <Text style={{color: withOpacity(colors.text, 65), fontSize: 12}}>{participants.length}</Text>
          <MaterialIcons name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={24} color={colors.text}/>
        </View>
        {!expanded && <GratitudeAvatarStrip people={participants} active={active}/>}
      </TouchableOpacity>

      {expanded && <>
        <ScrollView nestedScrollEnabled bounces={false} showsVerticalScrollIndicator
          scrollEnabled={contentHeight > listHeight + 1}
          onContentSizeChange={(_width, height) => setContentHeight(height)}
          style={{maxHeight: listHeight, flexGrow: 0, flexShrink: 1}}
          contentContainerStyle={{paddingHorizontal: 8, paddingBottom: 8}}>
          {category.people.map((person, index) => (
            <ListAvatarItem key={`${person.title}-${index}`} title={person.title} links={person.links}
              image={person.image} multilineTitle={!person.isCallToAction}/>
          ))}
        </ScrollView>
        <TouchableOpacity onPress={() => setExpanded(false)} accessibilityRole="button"
          accessibilityLabel={`Свернуть: ${category.title}`} onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}
          style={{minHeight: 40, padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
          <MaterialIcons name="keyboard-arrow-up" size={22} color={colors.text}/>
          <Text style={{fontSize: 13, color: colors.text}}>Свернуть</Text>
        </TouchableOpacity>
      </>}
    </View>
  );
};

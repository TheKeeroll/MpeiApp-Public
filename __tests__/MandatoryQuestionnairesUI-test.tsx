import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Alert, DeviceEventEmitter, Linking, Switch, Text, TouchableOpacity} from 'react-native';
import {emptyMandatoryQuestionnairesSnapshot, MANDATORY_QUESTIONNAIRES_EVENT, type MandatoryQuestionnairesSnapshot} from '../src/Questionnaires/MandatoryQuestionnairesState';

let mockSnapshot: MandatoryQuestionnairesSnapshot;
const mockAPI = {
  get MandatoryQuestionnairesSnapshot() { return mockSnapshot; },
  mCredentials: {login: 'public\\TestStudent', password: 'fixture'},
  SetAutomaticQuestionnaireFilling: jest.fn((enabled: boolean) => {
    mockSnapshot = {...mockSnapshot, enabled};
    DeviceEventEmitter.emit(MANDATORY_QUESTIONNAIRES_EVENT);
  }),
  PrepareMandatoryQuestionnaires: jest.fn(async () => undefined),
  AutoFillMandatoryQuestionnaires: jest.fn(async () => undefined),
  RetryMandatoryQuestionnaires: jest.fn(async () => undefined),
  CancelQuestionnaireFilling: jest.fn(),
  Logout: jest.fn(),
};
jest.mock('../src/Common/Globals', () => ({__esModule: true, default: mockAPI}));
jest.mock('react-native-paper', () => ({useTheme: () => ({colors: {background: '#111111', primary: '#222222', text: '#ffffff', textUnderline: '#00ffff', warning: '#ffcc00'}})}));
jest.mock('react-native-safe-area-context', () => ({SafeAreaView: ({children}: {children: React.ReactNode}) => <>{children}</>}));
const AutomaticQuestionnairesSwitch = require('../src/Questionnaires/AutomaticQuestionnairesSwitch').default;
const MandatoryQuestionnairesScreen = require('../src/Screens/Login/MandatoryQuestionnairesScreen').default;

describe('mandatory questionnaire controls', () => {
  let alert: jest.SpyInstance;
  let tree: ReactTestRenderer.ReactTestRenderer;
  beforeEach(() => {
    mockSnapshot = {...emptyMandatoryQuestionnairesSnapshot(false), generation: 1, listComplete: true};
    jest.clearAllMocks();
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    if (tree) await ReactTestRenderer.act(() => tree.unmount());
    jest.restoreAllMocks();
  });
  const actionButton = (label: string) => tree.root.findAllByType(TouchableOpacity).find(node => node.findAllByType(Text).some(text => typeof text.props.children === 'string' && text.props.children.includes(label)))!;

  it('keeps duplicate switches synchronized and enables only after explicit Alert confirmation', async () => {
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<><AutomaticQuestionnairesSwitch/><AutomaticQuestionnairesSwitch/></>); });
    await ReactTestRenderer.act(() => tree.root.findAllByType(Switch)[0]!.props.onValueChange(true));
    expect(mockAPI.SetAutomaticQuestionnaireFilling).not.toHaveBeenCalled();
    expect(alert.mock.calls[0]![1]).toContain('случайным');
    await ReactTestRenderer.act(() => alert.mock.calls[0]![2][0].onPress());
    expect(tree.root.findAllByType(Switch).map(node => node.props.value)).toEqual([false, false]);
    await ReactTestRenderer.act(() => tree.root.findAllByType(Switch)[0]!.props.onValueChange(true));
    await ReactTestRenderer.act(() => alert.mock.calls[1]![2][1].onPress());
    expect(tree.root.findAllByType(Switch).map(node => node.props.value)).toEqual([true, true]);
    await ReactTestRenderer.act(() => tree.root.findAllByType(Switch)[1]!.props.onValueChange(false));
    expect(tree.root.findAllByType(Switch).map(node => node.props.value)).toEqual([false, false]);
    expect(alert).toHaveBeenCalledTimes(2);
  });

  it('opens only the encoded account URL and discards manual confirmation after the session changes', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<MandatoryQuestionnairesScreen/>); });
    await ReactTestRenderer.act(() => actionButton('Перейти на сайт').props.onPress());
    expect(open).toHaveBeenCalledWith('https://bars.mpei.ru/bars_web/US_Q/QuestionnaireAnswer/ListQuestionnaireAnswer?ac=public%5CTestStudent');
    await ReactTestRenderer.act(() => actionButton('Заполнить анкеты случайными').props.onPress());
    expect(mockAPI.AutoFillMandatoryQuestionnaires).not.toHaveBeenCalled();
    mockSnapshot = {...mockSnapshot, generation: 2};
    await ReactTestRenderer.act(() => alert.mock.calls[0]![2][1].onPress());
    expect(mockAPI.AutoFillMandatoryQuestionnaires).not.toHaveBeenCalled();
  });

  it('offers cancellation during filling and disables a parallel retry', async () => {
    mockSnapshot = {...mockSnapshot, status: 'filling'};
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<MandatoryQuestionnairesScreen/>); });
    expect(actionButton('Проверить снова').props.disabled).toBe(true);
    expect(actionButton('Остановить заполнение').props.disabled).toBe(false);
    await ReactTestRenderer.act(() => actionButton('Остановить заполнение').props.onPress());
    expect(mockAPI.CancelQuestionnaireFilling).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tree.toJSON())).toContain('Экспериментально');
  });
});

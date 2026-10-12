import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {View} from 'react-native';

let mockFocused = true;
let mockContentAccess = false;
let mockAdsRemoval = false;
let mockSelected = true;
jest.mock('@react-navigation/native', () => ({useIsFocused: () => mockFocused}));
jest.mock('../src/Loyalty/LoyaltyProvider', () => ({useLoyalty: () => ({effectiveContentAccess: mockContentAccess, adsRemovalUnlocked: mockAdsRemoval})}));
jest.mock('../src/Vpn/DragoNetPromoBanner', () => {
  const React = require('react');
  return (props: Record<string, unknown>) => React.createElement('DragoNetPromoMock', props);
});
const {useDragoNetPromo} = require('../src/Vpn/useDragoNetPromo');
const {dragoNetPromoService} = require('../src/Vpn/DragoNetPromoService');

const Harness: React.FC<{visitKey?: string; eligible?: boolean; mounted?: boolean}> = ({visitKey = 'tasks', eligible = true, mounted = true}) => {
  const promo = useDragoNetPromo(visitKey, eligible);
  return <View>{mounted && promo.banner}</View>;
};

describe('DragoNet promotion visits', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  let choose: jest.SpyInstance;
  beforeEach(() => {
    mockFocused = true; mockContentAccess = false; mockAdsRemoval = false; mockSelected = true;
    choose = jest.spyOn(dragoNetPromoService, 'createOpportunity').mockImplementation(() => ({selected: mockSelected, counted: false}));
  });
  afterEach(async () => {
    if (tree) await ReactTestRenderer.act(() => tree.unmount());
    jest.restoreAllMocks();
  });
  const banners = () => tree.root.findAll(node => typeof node.type === 'string' && Boolean(node.props.opportunity));

  it('chooses once per visit and retains the decision and impression across footer remounts', async () => {
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<Harness/>); });
    const opportunity = banners()[0]!.props.opportunity;
    dragoNetPromoService.recordImpression(opportunity);
    await ReactTestRenderer.act(() => tree.update(<Harness mounted={false}/>));
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    expect(choose).toHaveBeenCalledTimes(1);
    expect(banners()[0]!.props.opportunity).toBe(opportunity);
    expect(dragoNetPromoService.recordImpression(opportunity)).toBe(false);
    mockFocused = false;
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    expect(banners()).toHaveLength(0);
    mockFocused = true;
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    expect(choose).toHaveBeenCalledTimes(2);
    await ReactTestRenderer.act(() => tree.update(<Harness visitKey="tomorrow"/>));
    expect(choose).toHaveBeenCalledTimes(3);
  });

  it('does not retry a failed probability choice on rerender or temporary eligibility changes', async () => {
    mockSelected = false;
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<Harness/>); });
    mockSelected = true;
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    await ReactTestRenderer.act(() => tree.update(<Harness eligible={false}/>));
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    expect(choose).toHaveBeenCalledTimes(1);
    expect(banners()).toHaveLength(0);
  });

  it('waits for ready data and focus, independent of Yandex SDK initialization', async () => {
    mockFocused = false;
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<Harness eligible={false}/>); });
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    expect(choose).not.toHaveBeenCalled();
    mockFocused = true;
    await ReactTestRenderer.act(() => tree.update(<Harness eligible={false}/>));
    expect(choose).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    expect(choose).toHaveBeenCalledTimes(1);
    expect(banners()).toHaveLength(1);
  });

  it('hides existing banners immediately for subscription/ad removal and restores the same decision', async () => {
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<Harness/>); });
    const opportunity = banners()[0]!.props.opportunity;
    mockContentAccess = true;
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    expect(banners()).toHaveLength(0);
    mockContentAccess = false; mockAdsRemoval = true;
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    expect(banners()).toHaveLength(0);
    mockAdsRemoval = false;
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    expect(banners()[0]!.props.opportunity).toBe(opportunity);
    expect(choose).toHaveBeenCalledTimes(1);
  });
});

import React, { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';

interface TabItem {
  key: string;
  text: string;
  icon: string;
  path: string;
}

const TABS: TabItem[] = [
  { key: 'index', text: '首页', icon: '🏠', path: '/pages/index/index' },
  { key: 'library', text: '知识库', icon: '📚', path: '/pages/library/index' },
  { key: 'capture', text: '速记', icon: '✍️', path: '/pages/capture/index' },
  { key: 'mine', text: '我的', icon: '👤', path: '/pages/mine/index' }
];

function resolvePageKey(route: string): string {
  // route 形如 /pages/library/index
  const parts = route.split('?')[0].split('/').filter(Boolean);
  return parts[1] || '';
}

const Dock: React.FC = () => {
  const [selected, setSelected] = useState(0);
  const [canBack, setCanBack] = useState(false);

  useDidShow(() => {
    try {
      const page = Taro.getCurrentInstance().page as { route?: string } | undefined;
      const route = page?.route || '';
      const key = resolvePageKey(route);
      const idx = TABS.findIndex((t) => t.key === key);
      setSelected(idx >= 0 ? idx : 0);
      // 页面栈大于 1 说明是从其他页面进入（二级页面），显示返回按钮
      setCanBack(Taro.getCurrentPages().length > 1);
    } catch (err) {
      console.error('[Dock] get current page failed:', err);
    }
  });

  const handleSwitch = (item: TabItem) => {
    Taro.switchTab({ url: item.path });
  };

  const handleBack = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
    }
  };

  return (
    <View className={classnames(styles.dockBar, !canBack && styles.noBack)}>
      <View className={styles.backWrap}>
        {canBack && (
          <View className={styles.backBtn} onClick={handleBack}>
            <Text className={styles.backIcon}>‹</Text>
          </View>
        )}
      </View>
      {TABS.map((item, idx) => {
        const active = idx === selected;
        return (
          <View
            key={item.key}
            className={classnames(styles.dockItem, active && styles.dockItemActive)}
            onClick={() => handleSwitch(item)}
          >
            <View className={classnames(styles.iconWrap, active && styles.iconWrapActive)}>
              <Text className={styles.icon}>{item.icon}</Text>
            </View>
            <Text className={classnames(styles.label, active && styles.labelActive)}>{item.text}</Text>
          </View>
        );
      })}
    </View>
  );
};

export default Dock;
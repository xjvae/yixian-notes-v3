import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import EmptyState from '@/components/EmptyState';
import Dock from '@/components/Dock';
import styles from './index.module.scss';

const SettingsPage: React.FC = () => {
  const handleCell = (label: string) => {
    Taro.showToast({ title: `${label} · 开发中`, icon: 'none' });
  };

  const handleClearCache = () => {
    Taro.showModal({
      title: '清理缓存',
      content: '确定要清理本地缓存吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorageSync();
          Taro.showToast({ title: '已清理', icon: 'success' });
        }
      }
    });
  };

  const rows = [
    { label: '通知设置', go: () => handleCell('通知设置') },
    { label: '隐私设置', go: () => handleCell('隐私设置') },
    { label: '账号与安全', go: () => handleCell('账号与安全') }
  ];

  const rows2 = [
    { label: '关于我们', value: 'v1.0.0', go: () => handleCell('关于我们') }
  ];

  return (
    <View className={styles.container}>
      <View className={styles.card}>
        {rows.map((r) => (
          <View className={styles.cell} key={r.label} onClick={r.go}>
            <Text className={styles.cellLabel}>{r.label}</Text>
            <Text className={styles.cellArrow}>›</Text>
          </View>
        ))}
      </View>

      <View className={styles.card} style={{ marginTop: '16rpx' }}>
        <View className={styles.cell} onClick={handleClearCache}>
          <Text className={styles.cellLabel}>清理缓存</Text>
          <Text className={styles.cellArrow}>›</Text>
        </View>
      </View>

      <View className={styles.card} style={{ marginTop: '16rpx' }}>
        {rows2.map((r) => (
          <View className={styles.cell} key={r.label} onClick={r.go}>
            <Text className={styles.cellLabel}>{r.label}</Text>
            {r.value ? <Text className={styles.cellValue}>{r.value}</Text> : null}
            <Text className={styles.cellArrow}>›</Text>
          </View>
        ))}
      </View>

      <EmptyState icon="🌿" text="一闲笔记 · 让灵感随手可得" />
      <Dock />
    </View>
  );
};

export default SettingsPage;
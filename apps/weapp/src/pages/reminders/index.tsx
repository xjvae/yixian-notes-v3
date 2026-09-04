import React, { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import { getReminders } from '@/services/reminder';
import type { ReminderItem } from '@/types/reminder';
import EmptyState from '@/components/EmptyState';
import Dock from '@/components/Dock';
import styles from './index.module.scss';

const RemindersPage: React.FC = () => {
  const [list, setList] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    load();
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await getReminders();
      setList(data);
    } catch (err) {
      console.error('[Reminders] getReminders failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (loading) {
    return (
      <View className={styles.loading}>
        加载中...
        <Dock />
      </View>
    );
  }

  return (
    <View className={styles.container}>
      {list.length === 0 ? (
        <EmptyState icon="⏰" text="暂无提醒" />
      ) : (
        list.map((r) => (
          <View key={r.id} className={classnames(styles.item, r.done && styles.done)}>
            <View className={styles.icon}>
              <Text>⏰</Text>
            </View>
            <View className={styles.info}>
              <Text className={styles.title}>{r.title}</Text>
              <Text className={styles.time}>{formatTime(r.remindAt)}</Text>
            </View>
            <Text className={styles.status}>{r.done ? '已处理' : '进行中'}</Text>
          </View>
        ))
      )}
      <Dock />
    </View>
  );
};

export default RemindersPage;
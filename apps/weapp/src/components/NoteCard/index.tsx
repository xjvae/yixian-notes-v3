import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { NoteItem } from '@/types/note';
import styles from './index.module.scss';

interface NoteCardProps {
  item: NoteItem;
  onLongPress?: (item: NoteItem) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ item, onLongPress }) => {
  const handleClick = () => {
    Taro.navigateTo({ url: `/pages/note-detail/index?id=${item.id}` });
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}-${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <View className={styles.card} onClick={handleClick} onLongPress={() => onLongPress?.(item)}>
      <View className={styles.titleRow}>
        <Text className={styles.title}>{item.title}</Text>
        {item.pinned && <Text className={styles.pin}>置顶</Text>}
      </View>
      <Text className={styles.summary}>{item.summary}</Text>
      <View className={styles.metaRow}>
        {item.notebookName ? <Text className={styles.notebook}>{item.notebookName}</Text> : null}
        <Text className={styles.time}>{formatTime(item.updateTime)}</Text>
      </View>
    </View>
  );
};

export default NoteCard;
import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { Notebook } from '@/types/notebook';
import styles from './index.module.scss';

interface NotebookCardProps {
  item: Notebook;
}

const emojis = ['📗', '📙', '📘', '📓', '📔'];

const NotebookCard: React.FC<NotebookCardProps> = ({ item }) => {
  const handleClick = () => {
    Taro.navigateTo({ url: `/pages/notebook-detail/index?id=${item._id}&name=${encodeURIComponent(item.name)}` });
  };

  const idx = Math.abs(item._id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % emojis.length;

  return (
    <View className={styles.card} onClick={handleClick}>
      <View className={styles.cover}>
        <Text>{emojis[idx]}</Text>
      </View>
      <View className={styles.info}>
        <Text className={styles.name}>{item.name}</Text>
        <Text className={styles.count}>{item.noteCount} 篇笔记</Text>
      </View>
      <Text className={styles.arrow}>›</Text>
    </View>
  );
};

export default NotebookCard;
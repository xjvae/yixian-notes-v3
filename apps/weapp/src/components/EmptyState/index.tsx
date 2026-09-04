import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';

interface EmptyStateProps {
  icon?: string;
  text?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon = '📝', text = '暂无内容' }) => {
  return (
    <View className={styles.empty}>
      <View className={styles.icon}>
        <Text>{icon}</Text>
      </View>
      <Text className={styles.text}>{text}</Text>
    </View>
  );
};

export default EmptyState;
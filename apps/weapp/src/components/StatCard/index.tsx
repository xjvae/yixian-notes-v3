import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';

interface StatCardProps {
  value: number | string;
  label: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ value, label, onClick }) => {
  return (
    <View className={styles.statCard} onClick={onClick}>
      <Text className={styles.value}>{value}</Text>
      <Text className={styles.label}>{label}</Text>
    </View>
  );
};

export default StatCard;
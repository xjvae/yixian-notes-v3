import React, { useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { getNoteDetail } from '@/services/note';
import type { NoteDetail } from '@/types/note';
import Dock from '@/components/Dock';
import styles from './index.module.scss';

const NoteDetailPage: React.FC = () => {
  const router = useRouter();
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await getNoteDetail(id);
      setDetail(data);
      Taro.setNavigationBarTitle({ title: data.title || '笔记详情' });
    } catch (err) {
      console.error('[NoteDetail] getNoteDetail failed:', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    const id = router.params.id;
    if (id) load(id);
  });

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      <View className={styles.card}>
        <Text className={styles.title}>{detail?.title}</Text>
        <View className={styles.meta}>
          {detail?.notebookName ? <Text className={styles.notebookTag}>{detail.notebookName}</Text> : null}
          <Text className={styles.time}>{formatTime(detail?.createTime ?? Date.now())}</Text>
        </View>
        <Text className={styles.content}>{detail?.content}</Text>
      </View>
      <Dock />
    </View>
  );
};

export default NoteDetailPage;
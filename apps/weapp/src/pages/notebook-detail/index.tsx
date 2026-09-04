import React, { useState, useCallback, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow, useReachBottom } from '@tarojs/taro';
import { getNotes } from '@/services/note';
import type { NoteItem } from '@/types/note';
import NoteCard from '@/components/NoteCard';
import EmptyState from '@/components/EmptyState';
import Dock from '@/components/Dock';
import styles from './index.module.scss';

const NotebookDetailPage: React.FC = () => {
  const router = useRouter();
  const [list, setList] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const [name, setName] = useState('');

  const load = useCallback(async (page: number, append = false) => {
    const notebookId = router.params.id;
    setLoading(append ? false : true);
    try {
      const res = await getNotes({ notebookId, pageNo: page, pageSize: 10 });
      setList((prev) => (append ? [...prev, ...res.list] : res.list));
      setHasMore(res.hasMore);
      pageRef.current = page;
    } catch (err) {
      console.error('[NotebookDetail] getNotes failed:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [router.params.id]);

  useDidShow(() => {
    const n = router.params.name ? decodeURIComponent(router.params.name) : '';
    setName(n);
    if (router.params.id) {
      load(1, false);
    }
  });

  useReachBottom(() => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(pageRef.current + 1, true);
  });

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <Text className={styles.name}>{name}</Text>
        <Text className={styles.count}>共 {list.length} 篇笔记</Text>
      </View>
      {loading ? (
        <View className={styles.loading}>加载中...</View>
      ) : list.length === 0 ? (
        <EmptyState icon="📝" text="笔记本还是空的" />
      ) : (
        <>
          {list.map((n) => (
            <NoteCard key={n.id} item={n} />
          ))}
          {loadingMore && <View className={styles.loadMore}>加载中...</View>}
          {!hasMore && list.length > 0 && <View className={styles.loadMore}>— 已到底了 —</View>}
        </>
      )}
      <Dock />
    </View>
  );
};

export default NotebookDetailPage;
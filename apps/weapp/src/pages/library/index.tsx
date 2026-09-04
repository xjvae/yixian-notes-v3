import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import classnames from 'classnames';
import { getNotebooks, createNotebook } from '@/services/notebook';
import { getNotes } from '@/services/note';
import type { Notebook } from '@/types/notebook';
import type { NoteItem } from '@/types/note';
import NotebookCard from '@/components/NotebookCard';
import NoteCard from '@/components/NoteCard';
import EmptyState from '@/components/EmptyState';
import Dock from '@/components/Dock';
import styles from './index.module.scss';

type TabKey = 'notebooks' | 'notes';

const LibraryPage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('notebooks');
  const [keyword, setKeyword] = useState('');
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);

  const loadNotebooks = async () => {
    try {
      const list = await getNotebooks();
      setNotebooks(list);
    } catch (err) {
      console.error('[Library] loadNotebooks failed:', err);
    }
  };

  const loadNotes = async (page: number, keyword?: string, append = false) => {
    setLoading(append ? false : true);
    try {
      const res = await getNotes({ pageNo: page, pageSize: 10, keyword });
      setNotes((prev) => (append ? [...prev, ...res.list] : res.list));
      setHasMore(res.hasMore);
      pageRef.current = page;
    } catch (err) {
      console.error('[Library] loadNotes failed:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useDidShow(() => {
    loadNotebooks();
    loadNotes(1, '');
  });

  usePullDownRefresh(() => {
    Promise.all([loadNotebooks(), loadNotes(1, '')]).finally(() => Taro.stopPullDownRefresh());
  });

  useReachBottom(() => {
    if (tab !== 'notes' || loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadNotes(pageRef.current + 1, keyword, true);
  });

  const handleSearch = (value: string) => {
    setKeyword(value);
    loadNotes(1, value);
  };

  const switchTab = (key: TabKey) => {
    setTab(key);
    if (key === 'notebooks') loadNotebooks();
  };

  const handleCreateNotebook = () => {
    Taro.showModal({
      title: '新建笔记本',
      editable: true,
      placeholderText: '输入笔记本名称',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            await createNotebook(res.content);
            await loadNotebooks();
            Taro.showToast({ title: '创建成功', icon: 'success' });
          } catch (err) {
            console.error('[Library] createNotebook failed:', err);
            Taro.showToast({ title: '创建失败', icon: 'none' });
          }
        }
      }
    });
  };

  return (
    <View className={styles.container}>
      <View className={styles.searchBar}>
        <View className={styles.searchBox}>
          <Text className={styles.searchIcon}>🔍</Text>
          <Input
            className={styles.searchInput}
            placeholder="搜索笔记"
            value={keyword}
            onInput={(e) => handleSearch(e.detail.value)}
          />
        </View>
      </View>

      <View className={styles.tabs}>
        <View className={classnames(styles.tab, tab === 'notebooks' && styles.tabActive)} onClick={() => switchTab('notebooks')}>
          <Text>笔记本</Text>
        </View>
        <View className={classnames(styles.tab, tab === 'notes' && styles.tabActive)} onClick={() => switchTab('notes')}>
          <Text>全部笔记</Text>
        </View>
      </View>

      {tab === 'notebooks' ? (
        <View className={styles.notebookList}>
          {notebooks.length === 0 ? (
            <EmptyState icon="📚" text="还没有笔记本，点击右下角创建" />
          ) : (
            notebooks.map((nb) => <NotebookCard key={nb._id} item={nb} />)
          )}
        </View>
      ) : (
        <View className={styles.noteList}>
          {loading ? (
            <View className={styles.loading}>加载中...</View>
          ) : notes.length === 0 ? (
            <EmptyState icon="📝" text="没有找到相关笔记" />
          ) : (
            <>
              {notes.map((n) => (
                <NoteCard key={n.id} item={n} />
              ))}
              {loadingMore && <View className={styles.loadMore}>加载中...</View>}
              {!hasMore && notes.length > 0 && <View className={styles.loadMore}>— 已到底了 —</View>}
            </>
          )}
        </View>
      )}

      {tab === 'notebooks' && (
        <View className={styles.newNotebook} onClick={handleCreateNotebook}>
          <Text>+</Text>
        </View>
      )}
      <Dock />
    </View>
  );
};

export default LibraryPage;
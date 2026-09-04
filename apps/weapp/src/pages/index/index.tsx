import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { getStats } from '@/services/notebook';
import { getNotes } from '@/services/note';
import { getTodos, toggleTodo } from '@/services/todo';
import type { NoteItem } from '@/types/note';
import type { TodoItem } from '@/types/todo';
import NoteCard from '@/components/NoteCard';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import Dock from '@/components/Dock';
import styles from './index.module.scss';

interface Stats {
  noteCount: number;
  notebookCount: number;
  todoCount: number;
  reminderCount: number;
}

const defaultStats: Stats = { noteCount: 0, notebookCount: 0, todoCount: 0, reminderCount: 0 };

const gridMetas = [
  { label: '知识库', icon: '📚', bg: '#e6f4ee', go: '/pages/library/index' },
  { label: '速记', icon: '✍️', bg: '#fdeee6', go: '/pages/capture/index' },
  { label: '待办', icon: '✅', bg: '#e8f3ea', go: '/pages/todos/index' },
  { label: '提醒', icon: '⏰', bg: '#eef2fb', go: '/pages/reminders/index' }
];

const HomePage: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const login = useAppStore((s) => s.login);
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [recentNotes, setRecentNotes] = useState<NoteItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);

  const loadStats = useCallback(async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error('[Home] getStats failed:', err);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const res = await getNotes({ pageNo: 1, pageSize: 3 });
      setRecentNotes(res.list);
    } catch (err) {
      console.error('[HomePage] loadRecent failed:', err);
    }
  }, []);

  const loadTodos = useCallback(async () => {
    try {
      const list = await getTodos();
      setTodos(list.filter((t) => !t.completed).slice(0, 3));
    } catch (err) {
      console.error('[HomePage] loadTodos failed:', err);
    }
  }, []);

  useDidShow(() => {
    loadStats();
    loadRecent();
    loadTodos();
  });

  usePullDownRefresh(() => {
    Promise.all([loadStats(), loadRecent(), loadTodos()]).finally(() => {
      Taro.stopPullDownRefresh();
    });
  });

  useEffect(() => {
    // 未登录时自动以游客身份登录获取展示数据
    if (!useAppStore.getState().isLoggedIn) {
      login().catch((err) => console.error('[HomePage] auto login failed:', err));
    }
  }, [login]);

  const handleToggleTodo = async (item: TodoItem) => {
    const done = !item.completed;
    // 乐观更新
    setTodos((prev) => prev.filter((t) => t.id !== item.id));
    try {
      await toggleTodo(item.id, done);
      Taro.showToast({ title: done ? '已完成' : '已恢复', icon: 'none' });
    } catch (err) {
      console.error('[HomePage] toggleTodo failed:', err);
      setTodos((prev) => [item, ...prev]);
    }
  };

  const jump = (url: string) => {
    if (url.startsWith('/pages/')) {
      Taro.switchTab({ url });
    } else {
      Taro.navigateTo({ url });
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
  const nickname = user?.nickname || '随手记';

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <View className={styles.userRow}>
          <View className={styles.avatar}>
            {user?.avatar ? (
              <Image src={user.avatar} className={styles.avatar} mode="aspectFill" style="width:100%;height:100%;border-radius:999rpx" />
            ) : (
              <Text>{nickname.slice(0, 1)}</Text>
            )}
          </View>
          <View>
            <Text className={styles.greeting}>{greeting}，{nickname}。</Text>
            <Text className={styles.sub}>让灵感随手可得</Text>
          </View>
        </View>
        <View className={styles.quickCapture} onClick={() => Taro.switchTab({ url: '/pages/capture/index' })}>
          <Text className={styles.quickCaptureText}>＋ 快速记一笔</Text>
        </View>
      </View>

      <View className={styles.body}>
        <View className={styles.statsCard}>
          <StatCard value={stats.noteCount} label="笔记" onClick={() => Taro.switchTab({ url: '/pages/library/index' })} />
          <StatCard value={stats.notebookCount} label="笔记本" onClick={() => Taro.switchTab({ url: '/pages/library/index' })} />
          <StatCard value={stats.todoCount} label="待办" onClick={() => Taro.navigateTo({ url: '/pages/todos/index' })} />
          <StatCard value={stats.reminderCount} label="提醒" onClick={() => Taro.navigateTo({ url: '/pages/reminders/index' })} />
        </View>

        <View className={styles.gridCard}>
          <View className={styles.grid}>
            {gridMetas.map((g) => (
              <View className={styles.gridItem} key={g.label} onClick={() => jump(g.go)}>
                <View className={styles.gridIcon} style={{ background: g.bg }}>
                  <Text>{g.icon}</Text>
                </View>
                <Text className={styles.gridLabel}>{g.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className={styles.sectionTitle}>
          <Text className={styles.sectionTitleText}>最近笔记</Text>
          <Text className={styles.sectionMore} onClick={() => Taro.switchTab({ url: '/pages/library/index' })}>查看全部 ›</Text>
        </View>
        {recentNotes.map((n) => (
          <NoteCard key={n.id} item={n} />
        ))}

        <View className={styles.sectionTitle}>
          <Text className={styles.sectionTitleText}>今日待办</Text>
          <Text className={styles.sectionMore} onClick={() => Taro.navigateTo({ url: '/pages/todos/index' })}>全部 ›</Text>
        </View>
        {todos.length === 0 ? (
          <EmptyState icon="🎉" text="今天没有待办事项" />
        ) : (
          todos.map((t) => (
            <View key={t.id} className={styles.todoItem} onClick={() => handleToggleTodo(t)}>
              <View className={classnames(styles.todoCheck, t.completed && styles.todoCheckDone)}>
                {t.completed ? <Text>✓</Text> : null}
              </View>
              <Text className={classnames(styles.todoTitle, t.completed && styles.todoTitleDone)}>{t.title}</Text>
              {t.dueText ? <Text className={styles.todoDue}>{t.dueText}</Text> : null}
            </View>
          ))
        )}
      </View>
      <Dock />
    </View>
  );
};

export default HomePage;
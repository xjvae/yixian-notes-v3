import React, { useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import { getTodos, toggleTodo } from '@/services/todo';
import type { TodoItem } from '@/types/todo';
import EmptyState from '@/components/EmptyState';
import Dock from '@/components/Dock';
import styles from './index.module.scss';

type Filter = 'all' | 'active' | 'done';

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '未完成' },
  { key: 'done', label: '已完成' }
];

const TodosPage: React.FC = () => {
  const [list, setList] = useState<TodoItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const data = await getTodos(f === 'all' ? '' : f);
      setList(data);
    } catch (err) {
      console.error('[Todos] getTodos failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    load(filter);
  });

  const switchFilter = (f: Filter) => {
    setFilter(f);
    load(f);
  };

  const handleToggle = async (item: TodoItem) => {
    const done = !item.completed;
    const next = { ...item, completed: done };
    setList((prev) => prev.map((t) => (t.id === item.id ? next : t)));
    // 若在过滤视图下操作，需移除不匹配项
    try {
      await toggleTodo(item.id, done);
      Taro.showToast({ title: done ? '已完成' : '已恢复', icon: 'none' });
      if (filter !== 'all') {
        setList((prev) => prev.filter((t) => t.id !== item.id));
      }
    } catch (err) {
      console.error('[Todos] toggleTodo failed:', err);
    }
  };

  const visible = filter === 'all' ? list : list;

  return (
    <View className={styles.container}>
      <View className={styles.tabs}>
        {filters.map((f) => (
          <View
            key={f.key}
            className={classnames(styles.tab, filter === f.key && styles.tabActive)}
            onClick={() => switchFilter(f.key)}
          >
            <Text>{f.label}</Text>
          </View>
        ))}
      </View>

      <View className={styles.list}>
        {loading ? (
          <View className={styles.loading}>加载中...</View>
        ) : visible.length === 0 ? (
          <EmptyState icon="🎉" text="暂无待办" />
        ) : (
          visible.map((t) => (
            <View key={t.id} className={styles.todoItem} onClick={() => handleToggle(t)}>
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

export default TodosPage;
import React, { useState, useCallback } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useAppStore } from '@/store';
import { getStats } from '@/services/notebook';
import StatCard from '@/components/StatCard';
import Dock from '@/components/Dock';
import styles from './index.module.scss';

interface Stats {
  noteCount: number;
  notebookCount: number;
  todoCount: number;
  reminderCount: number;
}

const MinePage: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const login = useAppStore((s) => s.login);
  const logout = useAppStore((s) => s.logout);
  const [stats, setStats] = useState({
    noteCount: 0,
    notebookCount: 0,
    todoCount: 0,
    reminderCount: 0
  });

  const loadStats = useCallback(async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error('[Mine] getStats failed:', err);
    }
  }, []);

  useDidShow(() => {
    loadStats();
  });

  const handleLogin = async () => {
    if (isLoggedIn) return;
    const ok = await login();
    if (ok) {
      Taro.showToast({ title: '登录成功', icon: 'success' });
    }
  };

  const handleLogout = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout();
          Taro.showToast({ title: '已退出', icon: 'none' });
        }
      }
    });
  };

  const nickname = user?.nickname || '点击登录';
  const avatarText = (nickname || '一').slice(0, 1);

  const cells = [
    { label: '我的笔记', icon: '📝', bg: '#e6f4ee', go: () => Taro.switchTab({ url: '/pages/library/index' }) },
    { label: '待办清单', icon: '✅', bg: '#e8f3ea', go: () => Taro.navigateTo({ url: '/pages/todos/index' }) },
    { label: '提醒中心', icon: '⏰', bg: '#eef2fb', go: () => Taro.navigateTo({ url: '/pages/reminders/index' }) },
    { label: '隐私与安全', icon: '🔒', bg: '#fdeee6', go: () => Taro.showToast({ title: '开发中', icon: 'none' }) },
    { label: '设置', icon: '⚙️', bg: '#f0f0f0', go: () => Taro.navigateTo({ url: '/pages/settings/index' }) },
    { label: '关于一闲笔记', icon: 'ℹ️', bg: '#f0eefb', go: () => Taro.showToast({ title: '一闲笔记 v1.0.0', icon: 'none' }) }
  ];

  return (
    <View className={styles.container}>
      <View className={styles.userCard} onClick={handleLogin}>
        <View className={styles.userInfo}>
          <View className={styles.avatar}>
            {user?.avatar ? (
              <Image src={user.avatar} style="width:100%;height:100%;border-radius:999rpx" mode="aspectFill" />
            ) : (
              <Text>{avatarText}</Text>
            )}
          </View>
          <View>
            <Text className={styles.nickname}>{isLoggedIn ? nickname : '登录后同步笔记'}</Text>
            <Text className={styles.loginTip}>{isLoggedIn ? '一闲用户' : '点击头像授权登录'}</Text>
          </View>
        </View>
      </View>

      <View className={styles.dataPanel}>
        <StatCard value={stats.noteCount} label="笔记" onClick={() => Taro.switchTab({ url: '/pages/library/index' })} />
        <StatCard value={stats.notebookCount} label="笔记本" onClick={() => Taro.switchTab({ url: '/pages/library/index' })} />
        <StatCard value={stats.todoCount} label="待办" onClick={() => Taro.navigateTo({ url: '/pages/todos/index' })} />
        <StatCard value={stats.reminderCount} label="提醒" onClick={() => Taro.navigateTo({ url: '/pages/reminders/index' })} />
      </View>

      <View className={styles.plainCard}>
        {cells.map((c) => (
          <View className={styles.cell} key={c.label} onClick={c.go}>
            <View className={styles.cellIcon} style={{ background: c.bg }}>
              <Text>{c.icon}</Text>
            </View>
            <Text className={styles.cellLabel}>{c.label}</Text>
            <Text className={styles.cellArrow}>›</Text>
          </View>
        ))}
      </View>

      {isLoggedIn && (
        <View className={styles.logoutBtn} onClick={handleLogout}>
          <Text>退出登录</Text>
        </View>
      )}
      <Dock />
    </View>
  );
};

export default MinePage;
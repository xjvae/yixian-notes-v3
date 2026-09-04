import React, { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import { restoreSession } from '@/store';
import './app.scss';

// 平台判断：微信环境初始化云开发
const isWeapp = process.env.TARO_ENV === 'weapp';

function App(props) {
  useEffect(() => {
    // 应用启动：初始化云开发并恢复登录态
    if (isWeapp) {
      Taro.cloud.init({ env: '', traceUser: true }).catch((err) => {
        console.error('[App] cloud init failed:', err);
      });
    }
    restoreSession().catch((err) => {
      console.error('[App] restore session failed:', err);
    });
  }, []);

  useDidShow(() => {});

  useDidHide(() => {});

  return props.children;
}

export default App;
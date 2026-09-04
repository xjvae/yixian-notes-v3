import React, { useState, useCallback } from 'react';
import { View, Text, Input, Textarea } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import { getNotebooks } from '@/services/notebook';
import { createNote } from '@/services/note';
import type { Notebook } from '@/types/notebook';
import Dock from '@/components/Dock';
import styles from './index.module.scss';

const CapturePage: React.FC = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notebookId, setNotebookId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useDidShow(() => {
    loadNotebooks();
  });

  const loadNotebooks = async () => {
    try {
      const list = await getNotebooks();
      setNotebooks(list);
      if (list.length > 0 && !notebookId) {
        setNotebookId(list[0]._id);
      }
    } catch (err) {
      console.error('[Capture] loadNotebooks failed:', err);
    }
  };

  const handleSelectNotebook = () => {
    if (notebooks.length === 0) return;
    const items = notebooks.map((n) => n.name);
    Taro.showActionSheet({
      itemList: items,
      success: (res) => {
        setNotebookId(notebooks[res.tapIndex]._id);
      }
    });
  };

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!title.trim() && !content.trim()) {
      Taro.showToast({ title: '记录点什么吧', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await createNote({
        title: title.trim(),
        content: content.trim(),
        notebookId: notebookId || undefined
      });
      Taro.showToast({ title: '保存成功', icon: 'success' });
      setTitle('');
      setContent('');
    } catch (err) {
      console.error('[Capture] createNote failed:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [title, content, notebookId, submitting]);

  const currentNotebook = notebooks.find((n) => n._id === notebookId);

  return (
    <View className={styles.container}>
      <View className={styles.notebookSelect} onClick={handleSelectNotebook}>
        <Text className={styles.notebookSelectText}>
          📁 {currentNotebook ? currentNotebook.name : '选择笔记本'} ▾
        </Text>
      </View>

      <View className={styles.editorCard}>
        <Input
          className={styles.titleInput}
          placeholder="请输入标题（选填）"
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
        />
        <Textarea
          className={styles.contentInput}
          placeholder="随手记录此刻的想法..."
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          maxlength={5000}
        />
        <Text className={styles.wordCount}>{content.length} 字</Text>
      </View>

      <View className={styles.submitBar}>
        <View
          className={classnames(styles.submitBtn, submitting && styles.submitBtnDisabled)}
          onClick={handleSubmit}
        >
          <Text>{submitting ? '保存中...' : '保存笔记'}</Text>
        </View>
      </View>

      <Dock />
    </View>
  );
};

export default CapturePage;
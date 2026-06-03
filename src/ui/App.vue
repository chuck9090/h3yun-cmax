<template>
  <div id="app">
    <ProgressView
      :title="state.title"
      :current-message="state.currentMessage"
      :progress="state.progress"
      :messages="state.messages"
      :is-complete="state.isComplete"
      :complete-status="state.completeStatus"
      :complete-title="state.completeTitle"
      :complete-description="state.completeDescription"
    />
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import ProgressView from './components/ProgressView.vue';

interface Message {
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

interface AppState {
  title: string;
  currentMessage: string;
  progress: number;
  messages: Message[];
  isComplete: boolean;
  completeStatus: 'success' | 'error';
  completeTitle: string;
  completeDescription: string;
}

const state = reactive<AppState>({
  title: '氚云代码同步',
  currentMessage: '准备中...',
  progress: 0,
  messages: [],
  isComplete: false,
  completeStatus: 'success',
  completeTitle: '',
  completeDescription: ''
});

// 添加消息
function addMessage(text: string, type: Message['type'] = 'info') {
  state.messages.push({
    text,
    type,
    timestamp: Date.now()
  });
}

// 更新进度
function updateProgress(message: string, progress: number) {
  state.currentMessage = message;
  state.progress = progress;
  addMessage(message, 'info');
}

// 完成任务
function complete(success: boolean, title: string, description: string) {
  state.isComplete = true;
  state.completeStatus = success ? 'success' : 'error';
  state.completeTitle = title;
  state.completeDescription = description;
}

// 暴露方法给外部调用
(window as any).updateProgress = updateProgress;
(window as any).addMessage = addMessage;
(window as any).complete = complete;
</script>

<style lang="scss">
#app {
  width: 100%;
  height: 100%;
}
</style>

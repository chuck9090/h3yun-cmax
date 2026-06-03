<template>
  <div class="progress-container">
    <!-- 进度头部 -->
    <div class="progress-header">
      <h2>{{ title }}</h2>
      <div class="status-text">{{ currentMessage }}</div>
    </div>

    <!-- 进度条 -->
    <div v-if="!isComplete" class="progress-bar-wrapper">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div class="progress-text">{{ Math.round(progress) }}%</div>
    </div>

    <!-- 消息列表 -->
    <div v-if="messages.length > 0" class="message-list">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message-item', msg.type]"
      >
        <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
        <span class="message-content">{{ msg.text }}</span>
      </div>
    </div>

    <!-- 完成状态 -->
    <div v-if="isComplete" class="complete-state">
      <div :class="['icon', completeStatus]">
        {{ completeStatus === 'success' ? '✓' : '✗' }}
      </div>
      <div class="title">{{ completeTitle }}</div>
      <div class="description">{{ completeDescription }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Message {
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

const props = defineProps<{
  title: string;
  currentMessage: string;
  progress: number;
  messages: Message[];
  isComplete: boolean;
  completeStatus: 'success' | 'error';
  completeTitle: string;
  completeDescription: string;
}>();

// 格式化时间戳为可读时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
</script>

<style scoped lang="scss">
@import '../styles/main.scss';
</style>

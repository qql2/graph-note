# X6 移动端画布缩放问题解决方案

## 问题描述

在 AntV X6 图编辑器中，需要实现移动端双指缩放画布的功能，要求：
1. 支持双指捏合缩放画布
2. 缩放时要以双指中心点为基准
3. 需要考虑与单指拖动的交互冲突
4. 需要限制最大最小缩放比例

## 实现思路

### 1. 监听触摸事件

需要监听以下事件：
- touchstart: 记录初始触摸点
- touchmove: 计算缩放比例
- touchend: 清理状态

### 2. 设置缩放限制

```typescript
const minScale = 0.5;  // 最小缩放比例
const maxScale = 3;    // 最大缩放比例

const graph = new Graph({
  mousewheel: {
    enabled: true,
    minScale: minScale,
    maxScale: maxScale,
  },
  // ... 其他配置
});
```

### 2. 计算缩放

```typescript
// 计算两点之间的距离
const getDistance = (p1: Touch, p2: Touch) => {
  const dx = p1.clientX - p2.clientX;
  const dy = p1.clientY - p2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

// 计算两点的中心点
const getMidPoint = (p1: Touch, p2: Touch) => {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2,
  };
};
```

### 3. 实现缩放逻辑

```typescript
let initialDistance: number;
let initialScale: number;

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length !== 2) return;
  
  const touch1 = e.touches[0];
  const touch2 = e.touches[1];
  
  // 计算当前两指距离
  const distance = getDistance(touch1, touch2);
  
  // 计算缩放比例
  const scale = (distance / initialDistance) * initialScale;
  
  // 限制缩放范围
  const limitedScale = Math.min(Math.max(scale, minScale), maxScale);
  
  // 获取缩放中心点
  const center = getMidPoint(touch1, touch2);
  
  // 应用缩放
  graph.zoom(scale, {
    absolute: true,
    center: {
      x: center.x,
      y: center.y,
    },
  });
};
```

## 注意事项

1. 需要处理好单指拖动和双指缩放的切换
2. 缩放限制需要与鼠标滚轮缩放保持一致
3. 需要防止缩放过程中的抖动
4. 需要正确处理触摸事件的顺序
5. 缩放限制的值要根据实际需求调整

## 相关 API 参考

- [X6 Graph zoom](https://x6.antv.vision/zh/docs/api/graph/transform#zoom)
- [Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events) 
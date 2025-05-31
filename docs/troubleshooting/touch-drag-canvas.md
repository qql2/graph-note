# X6 移动端画布拖动问题解决方案

## 问题描述

在 AntV X6 图编辑器中，需要实现移动端触摸拖动画布的功能，同时要满足以下要求：
1. 只有触摸空白区域时才能拖动画布
2. 触摸节点时不应触发画布拖动
3. 支持单指拖动，忽略多指触摸

## 尝试过程

### 方案一：使用 panning 配置（不可行）

最初尝试使用 X6 的 panning 配置： 
```typescript
const graph = new Graph({
panning: {
enabled: true,
}
});
```

这种方式在移动端效果不理想，无法准确区分节点和画布的触摸。

### 方案二：监听 touchstart 事件（不完美）

尝试直接监听容器的 touchstart 事件：

```typescript
container.addEventListener('touchstart', handleTouchStart);
```

问题：
- touchstart 事件会在任何触摸时触发，包括触摸节点时
- 无法准确判断触摸点是否在空白区域

### 最终方案：结合 X6 事件系统

发现 X6 会将移动端触摸事件映射为鼠标事件，可以利用这一特性：

```typescript
// 监听空白区域的触摸开始
graph.on('blank:mousedown', (e) => {
  isBlankTouch = true;
  
  const touch = e.e as unknown as TouchEvent;
  if(touch.touches.length !== 1) {
    return;
  }
  lastTouchX = touch.touches[0].clientX;
  lastTouchY = touch.touches[0].clientY;
  isDragging = true;
});

// 监听触摸结束
graph.on('blank:mouseup', () => {
  isBlankTouch = false;
});

// 处理移动
const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging || e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  const deltaX = touch.clientX - lastTouchX;
  const deltaY = touch.clientY - lastTouchY;
  
  const currentScale = graph.scale();
  
  requestAnimationFrame(() => {
    graph.translateBy(deltaX / currentScale.sx, deltaY / currentScale.sy);
  });
  
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;
  
  e.preventDefault();
};
```

## 解决方案优点

1. 准确性：利用 X6 的事件系统可以准确识别空白区域的触摸
2. 性能：使用 requestAnimationFrame 优化渲染性能
3. 可维护性：代码结构清晰，易于理解和维护
4. 用户体验：拖动平滑，响应及时

## 注意事项

1. 需要阻止默认的触摸行为：`e.preventDefault()`
2. 需要考虑画布缩放比例：`deltaX / currentScale.sx`
3. 需要正确清理事件监听器
4. 多指触摸时要停止拖动

## 相关 API 参考

- [X6 Graph Events](https://x6.antv.vision/zh/docs/api/graph/graph#事件)
- [X6 Graph Transform](https://x6.antv.vision/zh/docs/api/graph/transform)


import React from 'react';

/**
 * macOS 原生标题拖拽栏：
 * 左上角红黄绿交通灯由系统 titleBarStyle: 'hiddenInset' 原生渲染
 */
export const TitleBar: React.FC = () => {
  return <div className="app-drag h-10 w-full shrink-0 z-30" />;
};

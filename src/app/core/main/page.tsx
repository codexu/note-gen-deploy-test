'use client'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { LeftSidebar } from "./left-sidebar"
import { EditorWrapper } from '../article/editor-wrapper'
import Chat from '../record/chat'
import dynamic from 'next/dynamic'
import { useSidebarStore } from "@/stores/sidebar"
import { useEffect, useState, useRef } from 'react'
import { Store } from '@tauri-apps/plugin-store'
import { ImperativePanelHandle } from 'react-resizable-panels'

function getDefaultLayout(layoutKey: string) {
  const storageKey = `react-resizable-panels:main-layout:${layoutKey}`
  const layout = localStorage.getItem(storageKey);
  
  if (layout) {
    try {
      const parsed = JSON.parse(layout);
      // 验证总和是否为 100
      const sum = parsed.reduce((a: number, b: number) => a + b, 0);
      if (Math.abs(sum - 100) < 0.1) {
        return parsed;
      }
      // 如果总和不是 100，清除这个无效的值
      console.warn(`Invalid layout sum ${sum} for ${layoutKey}, using defaults`);
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error('Failed to parse layout:', e);
    }
  }
  
  // 根据布局组合返回默认值
  switch (layoutKey) {
    case 'left-center-right':
      return [20, 50, 30]
    case 'left-center':
      return [30, 70]
    case 'center-right':
      return [60, 40]
    case 'left-right':
      return [50, 50]
    case 'left':
      return [100]
    case 'center':
      return [100]
    case 'right':
      return [100]
    default:
      return [100]
  }
}

function ResizableWrapper() {
  const { 
    leftSidebarVisible, 
    centerPanelVisible, 
    rightSidebarVisible, 
    initSidebarState,
    toggleLeftSidebar,
    toggleCenterPanel,
    toggleRightSidebar
  } = useSidebarStore()
  
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const centerPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)
  
  const MIN_SIDEBAR_WIDTH_PX = 360
  const MIN_EDITOR_WIDTH_PX = 400
  const [minSidebarSize, setMinSidebarSize] = useState(20)
  const [minEditorSize, setMinEditorSize] = useState(30)
  
  const calculateMinSizes = () => {
    const windowWidth = window.innerWidth
    const minSidebarPercent = Math.max(15, (MIN_SIDEBAR_WIDTH_PX / windowWidth) * 100)
    const minEditorPercent = Math.max(25, (MIN_EDITOR_WIDTH_PX / windowWidth) * 100)
    setMinSidebarSize(Math.min(minSidebarPercent, 40))
    setMinEditorSize(Math.min(minEditorPercent, 50))
  }

  // 初始化侧边栏状态
  useEffect(() => {
    initSidebarState()
    calculateMinSizes()
    
    window.addEventListener('resize', calculateMinSizes)
    return () => window.removeEventListener('resize', calculateMinSizes)
  }, [])

  // 当面板可见性变化时，展开面板到默认大小
  useEffect(() => {
    const timer = setTimeout(() => {
      if (leftSidebarVisible && leftPanelRef.current) {
        leftPanelRef.current.expand()
      }
      if (centerPanelVisible && centerPanelRef.current) {
        centerPanelRef.current.expand()
      }
      if (rightSidebarVisible && rightPanelRef.current) {
        rightPanelRef.current.expand()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [leftSidebarVisible, centerPanelVisible, rightSidebarVisible])

  // 根据面板可见性渲染布局
  // 注意：左侧面板始终渲染，所以 layoutKey 用于存储，但实际布局计算需要考虑左侧始终存在
  const visiblePanels = [
    leftSidebarVisible && 'left',
    centerPanelVisible && 'center',
    rightSidebarVisible && 'right'
  ].filter(Boolean)

  const layoutKey = visiblePanels.join('-')
  
  // 计算实际需要的默认尺寸（左侧始终存在）
  const getActualLayout = () => {
    const savedLayout = getDefaultLayout(layoutKey)
    const result = []
    let savedIndex = 0
    
    // 特殊处理：只有左右两侧显示时，左侧保持保存的宽度，右侧填满剩余空间
    if (!centerPanelVisible && leftSidebarVisible && rightSidebarVisible) {
      const leftSize = savedLayout[savedIndex] // 左右布局时，savedLayout[0] 是左侧的宽度
      const rightSize = 100 - leftSize
      result.push(leftSize)
      result.push(rightSize)
      return result
    }
    
    // 左侧：如果可见使用保存的值，否则为0
    result.push(leftSidebarVisible ? savedLayout[savedIndex++] : 0)
    
    // 中间：如果可见使用保存的值
    if (centerPanelVisible) {
      result.push(savedLayout[savedIndex++])
    }
    
    // 右侧：如果可见使用保存的值
    if (rightSidebarVisible) {
      result.push(savedLayout[savedIndex++])
    }
    
    return result
  }
  
  const actualLayout = getActualLayout()
  
  const onLayout = (sizes: number[]) => {
    // 检测面板是否被折叠（尺寸接近 0）
    let panelIndex = 0
    let hasCollapsed = false
    
    // 左侧面板始终存在，所以始终检查
    const leftSize = sizes[panelIndex++]
    if (leftSidebarVisible && leftSize < 1) {
      hasCollapsed = true
      toggleLeftSidebar()
    }
    
    if (centerPanelVisible) {
      const centerSize = sizes[panelIndex++]
      if (centerSize < 1) {
        hasCollapsed = true
        toggleCenterPanel()
      }
    }
    if (rightSidebarVisible) {
      const rightSize = sizes[panelIndex++]
      if (rightSize < 1) {
        hasCollapsed = true
        toggleRightSidebar()
      }
    }
    
    // 只在没有面板被折叠时才保存布局
    if (!hasCollapsed) {
      // 需要过滤掉隐藏的左侧面板的尺寸
      const sizesToSave = []
      let sizeIndex = 0
      
      // 左侧：只在可见时保存
      if (leftSidebarVisible) {
        sizesToSave.push(sizes[sizeIndex])
      }
      sizeIndex++
      
      // 中间：可见时保存
      if (centerPanelVisible) {
        sizesToSave.push(sizes[sizeIndex])
        sizeIndex++
      }
      
      // 右侧：可见时保存
      if (rightSidebarVisible) {
        sizesToSave.push(sizes[sizeIndex])
      }
      
      const storageKey = `react-resizable-panels:main-layout:${layoutKey}`
      localStorage.setItem(storageKey, JSON.stringify(sizesToSave));
    }
  };

  // 根据可见面板数量动态构建布局
  const renderLayout = () => {
    const panels = []
    let index = 0

    // 左侧面板始终渲染，但通过折叠状态控制显示
    panels.push(
      <ResizablePanel 
        key="left"
        ref={leftPanelRef}
        defaultSize={actualLayout[index++]}
        minSize={minSidebarSize}
        collapsible={true}
        collapsedSize={0}
      >
        <LeftSidebar />
      </ResizablePanel>
    )

    if (leftSidebarVisible && centerPanelVisible) {
      panels.push(<ResizableHandle key="handle-left-center" />)
    }

    if (centerPanelVisible) {
      panels.push(
        <ResizablePanel 
          key="center"
          ref={centerPanelRef}
          defaultSize={actualLayout[index++]}
          minSize={minEditorSize}
          collapsible={true}
          collapsedSize={0}
        >
          <EditorWrapper />
        </ResizablePanel>
      )
    }

    if (leftSidebarVisible && !centerPanelVisible && rightSidebarVisible) {
      panels.push(<ResizableHandle key="handle-left-right" />)
    }

    if (centerPanelVisible && rightSidebarVisible) {
      panels.push(<ResizableHandle key="handle-center-right" />)
    }

    if (rightSidebarVisible) {
      panels.push(
        <ResizablePanel 
          key="right"
          ref={rightPanelRef}
          defaultSize={actualLayout[index++]}
          minSize={minSidebarSize}
          collapsible={true}
          collapsedSize={0}
        >
          <Chat />
        </ResizablePanel>
      )
    }

    return panels
  }

  return (
    <ResizablePanelGroup 
      key={layoutKey}
      direction="horizontal" 
      onLayout={onLayout} 
      className="h-full"
    >
      {renderLayout()}
    </ResizablePanelGroup>
  )
}

function Page() {
  useEffect(() => {
    // 保存当前页面路径
    async function saveCurrentPage() {
      const store = await Store.load('store.json')
      await store.set('currentPage', '/core/main')
      await store.save()
    }
    saveCurrentPage()
  }, [])
  
  return <ResizableWrapper />
}

export default dynamic(() => Promise.resolve(Page), { ssr: false })

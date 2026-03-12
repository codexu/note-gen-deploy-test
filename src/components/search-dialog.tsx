'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { debounce } from 'lodash-es'
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { LocateFixed, SearchX } from 'lucide-react'
import { useTranslations } from 'next-intl'
import useArticleStore from '@/stores/article'
import useMarkStore from '@/stores/mark'
import useTagStore from '@/stores/tag'
import { useSidebarStore } from '@/stores/sidebar'
import { usePathname, useRouter } from 'next/navigation'
import emitter from '@/lib/emitter'
import { EmitterRecordEvents } from '@/config/emitters'
import { search, type SearchableItem } from '@/lib/search-utils'

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface EnhancedSearchResult {
  id: string
  path?: string
  article?: string
  content?: string
  desc?: string
  title: string
  searchType: 'article' | 'record'
  tagId?: number
  tagName?: string
  type?: string
  url?: string
  highlightText: string
  score: number
  firstMatchIndex?: number
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const [searchValue, setSearchValue] = useState('')
  const [searchResult, setSearchResult] = useState<EnhancedSearchResult[]>([])
  const { allArticle, loadAllArticle, setActiveFilePath, setMatchPosition, setCollapsibleList } = useArticleStore()
  const { allMarks, fetchAllMarks } = useMarkStore()
  const { tags, fetchTags, setCurrentTagId } = useTagStore()
  const { setLeftSidebarTab } = useSidebarStore()
  const isMobileRoute = pathname.startsWith('/mobile')
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  function extractTitleFromPath(path: string): string {
    if (!path) return ''
    const parts = path.split(/[\/\\]/)
    const fileName = parts[parts.length - 1]
    return fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName
  }

  // 高亮搜索关键词
  function highlightText(text: string, query: string) {
    if (!query.trim() || !text) return text
    
    const parts: React.ReactNode[] = []
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase().trim()
    
    let lastIndex = 0
    let index = lowerText.indexOf(lowerQuery)
    
    while (index !== -1) {
      // 添加匹配前的文本
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index))
      }
      
      // 添加高亮的匹配文本
      parts.push(
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 text-foreground px-0.5 rounded">
          {text.substring(index, index + lowerQuery.length)}
        </mark>
      )
      
      lastIndex = index + lowerQuery.length
      index = lowerText.indexOf(lowerQuery, lastIndex)
    }
    
    // 添加剩余文本
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }
    
    return <>{parts}</>
  }

  const performSearch = useCallback((value: string) => {
    if (!value.trim()) {
      setSearchResult([])
      return
    }
    
    // 构建文章搜索项
    const articleItems: SearchableItem[] = allArticle.map((item, index) => ({
      id: `article-${index}-${item.path?.replace(/[^a-zA-Z0-9]/g, '-')}`,
      title: extractTitleFromPath(item.path || ''),
      content: item.article || '',
      metadata: {
        path: item.path,
        article: item.article,
        searchType: 'article'
      }
    }))
    
    // 准备记录搜索数据
    const markItems: SearchableItem[] = allMarks.map((item, index) => {
      const tag = tags.find(tag => tag.id === item.tagId)
      return {
        id: `mark-${index}-${item.id}`,
        title: item.desc || item.content?.slice(0, 50) || '',
        content: `${item.content || ''} ${item.desc || ''} ${tag?.name || ''}`,
        metadata: {
          content: item.content,
          desc: item.desc,
          tagName: tag?.name,
          tagId: item.tagId,
          type: item.type,
          url: item.url,
          searchType: 'record'
        }
      }
    })
    
    // 合并所有搜索项
    const allItems = [...articleItems, ...markItems]
    
    // 执行搜索（自动合并精确和模糊结果）
    const searchResults = search(allItems, value, { 
      maxResults: 50 
    })
    
    // 转换为组件需要的格式
    const results: EnhancedSearchResult[] = searchResults.map(result => {
      const metadata = result.item.metadata || {}
      const firstMatch = result.matches[0]
      
      return {
        id: result.item.id,
        title: result.item.title,
        searchType: metadata.searchType as 'article' | 'record',
        highlightText: result.highlightText,
        score: result.score,
        firstMatchIndex: firstMatch?.index,
        // 文章特定字段
        path: metadata.path,
        article: metadata.article,
        // 记录特定字段
        content: metadata.content,
        desc: metadata.desc,
        tagName: metadata.tagName,
        tagId: metadata.tagId,
        type: metadata.type,
        url: metadata.url
      }
    })
    
    setSearchResult(results)
  }, [allArticle, allMarks, tags])

  // 防抖搜索，300ms 延迟
  const debouncedSearch = useMemo(
    () => debounce(performSearch, 300),
    [performSearch]
  )

  async function handleSelect(item: EnhancedSearchResult) {
    // 如果是记录类型，跳转到记录页面并设置对应的 tag
    if (item.searchType === 'record') {
      onOpenChange(false)

      if (item.tagId) {
        await setCurrentTagId(item.tagId)
      }

      if (!isMobileRoute) {
        // PC 端：切换到记录标签页
        await setLeftSidebarTab('notes')
      } else {
        // 移动端：进入记录页
        router.push('/mobile/record')
      }

      emitter.emit(EmitterRecordEvents.refreshMarks)

      return
    }
    
    onOpenChange(false)

    // PC 端切换到笔记标签页；移动端直接跳转写作页
    if (!isMobileRoute) {
      await setLeftSidebarTab('files')
    }
    
    // 如果是文章类型，跳转到文章页面
    if (item.firstMatchIndex !== undefined) {
      setMatchPosition(item.firstMatchIndex)
    }
    
    const filePath = item.path as string
    
    const setupAndNavigate = async () => {
      // 展开文件夹路径
      const pathParts = filePath.split('/')
      pathParts.pop()
      
      let currentPath = ''
      for (const part of pathParts) {
        if (currentPath) {
          currentPath += '/' + part
        } else {
          currentPath = part
        }
        
        if (currentPath) {
          await setCollapsibleList(currentPath, true)
        }
      }
      
      // 设置活动文件路径
      await setActiveFilePath(filePath)
      
      // 读取文件内容
      const { readArticle } = useArticleStore.getState()
      await readArticle(filePath)
      
      // 跳转到对应平台页面
      router.push(isMobileRoute ? '/mobile/writing' : '/core/main')
    }
    
    setupAndNavigate()
  }

  useEffect(() => {
    if (open) {
      loadAllArticle()
      fetchAllMarks()
      fetchTags()
    }
  }, [open])

  useEffect(() => {
    debouncedSearch(searchValue)
  }, [searchValue, debouncedSearch])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      searchInputRef.current?.focus()
    }, 60)
    return () => clearTimeout(timer)
  }, [open, isMobileRoute])

  const searchContent = (
    <>
      <CommandInput 
        ref={searchInputRef}
        autoFocus
        placeholder={t('search.placeholder')} 
        value={searchValue}
        onValueChange={setSearchValue}
      />
      <CommandList className={isMobileRoute ? "h-[64vh] max-h-[64vh]" : "h-[400px] max-h-[400px]"}>
        {!searchValue && (
          <Empty className="border-0">
            <EmptyHeader>
              <SearchX className="size-10 text-muted-foreground" />
              <EmptyTitle>{t('search.placeholder')}</EmptyTitle>
              <EmptyDescription>
                {t('search.tryDifferentKeywords')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {searchResult.length === 0 && searchValue && (
          <Empty className="border-0">
            <EmptyHeader>
              <SearchX className="size-10 text-muted-foreground" />
              <EmptyTitle>{t('search.noResults')}</EmptyTitle>
              <EmptyDescription>
                {t('search.tryDifferentKeywords')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {searchResult.length > 0 && (
          <CommandGroup heading={t('search.results', { count: searchResult.length })}>
            {searchResult.map((item) => {
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.searchType}-${item.title || item.path}`}
                  onSelect={() => handleSelect(item)}
                  className={isMobileRoute ? "flex flex-col items-start gap-1.5 py-2.5" : "flex flex-col items-start gap-1.5 py-2"}
                >
                  {isMobileRoute ? (
                    <div className="w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0">
                          {item.searchType === 'record' ? t('search.item.record') : t('search.item.article')}
                        </Badge>
                        {item.title && (
                          <span className="text-sm font-medium truncate">
                            {highlightText(item.title, searchValue)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground truncate">
                        {item.searchType === 'record' ? (item.tagName || t('search.item.record')) : item.path}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <LocateFixed className="size-3.5 text-cyan-900 dark:text-cyan-400 shrink-0" />
                        <Badge variant="secondary" className="text-xs">
                          {item.searchType === 'record' ? t('search.item.record') : t('search.item.article')}
                        </Badge>
                        {item.title && (
                          <span className="text-sm font-medium truncate">
                            {highlightText(item.title, searchValue)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground/60">
                          {item.score.toFixed(1)}
                        </span>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {item.searchType === 'record' ? (item.tagName || t('search.item.record')) : item.path}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground line-clamp-2 w-full">
                    {highlightText(item.highlightText, searchValue)}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </>
  )

  if (isMobileRoute) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[86vh] rounded-t-2xl p-0">
          <DrawerHeader className="pb-2">
            <DrawerTitle>{t('search.placeholder')}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 px-3 pb-3">
            <Command
              shouldFilter={false}
              className="h-full rounded-xl border bg-background [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-11 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
            >
              {searchContent}
            </Command>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {searchContent}
    </CommandDialog>
  )
}

import { TooltipButton } from "@/components/tooltip-button"
import { insertMark, Mark } from "@/db/marks"
import { useTranslations } from 'next-intl'
import { fetchAiDesc, fetchAiDescByImage } from "@/lib/ai/description"
import ocr from "@/lib/ocr"
import useMarkStore from "@/stores/mark"
import useTagStore from "@/stores/tag"
import { useSidebarStore } from "@/stores/sidebar"
import { BaseDirectory, copyFile, exists, mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs"
import { ImagePlus } from "lucide-react"
import useSettingStore from "@/stores/setting"
import { v4 as uuid } from 'uuid'
import { open } from '@tauri-apps/plugin-dialog';
import { uploadImage } from "@/lib/imageHosting"
import { useRef, useEffect } from 'react'
import { isMobileDevice } from '@/lib/check'
import emitter from '@/lib/emitter'

export function ControlImage() {
  const t = useTranslations();
  const { currentTagId, fetchTags, getCurrentTag } = useTagStore()
  const { primaryModel, primaryImageMethod, enableImageRecognition } = useSettingStore()
  const { fetchMarks, addQueue, setQueue, removeQueue } = useMarkStore()
  const { setLeftSidebarTab } = useSidebarStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isMobile = isMobileDevice()

  useEffect(() => {
    emitter.on('toolbar-shortcut-image', () => {
      selectImages()
    })
    return () => {
      emitter.off('toolbar-shortcut-image')
    }
  }, [])

  async function selectImages() {
    try {
      console.log('selectImages called, isMobile:', isMobile)
      
      // 移动端使用 HTML5 file input
      if (isMobile) {
        console.log('Mobile device detected, triggering file input')
        if (fileInputRef.current) {
          fileInputRef.current.click()
        } else {
          console.error('File input ref is null')
        }
        return
      }

      // PC端使用 Tauri dialog
      console.log('Desktop device, using Tauri dialog')
      const filePaths = await open({
        multiple: true,
        directory: false,
        filters: [{
          name: 'Image',
          extensions: ['png', 'jpeg', 'jpg', 'gif', 'webp','svg', 'bmp', 'ico']
        }]
      });
      if (!filePaths) return
      
      // 切换到记录标签页（在耗时操作之前）
      await setLeftSidebarTab('notes')
      
      filePaths.forEach(async (path) => {
        await upload(path)
      })
    } catch (error) {
      console.error('Error in selectImages:', error)
    }
  }

  // 处理移动端文件选择
  async function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      console.log('handleFileInputChange called')
      const files = event.target.files
      if (!files || files.length === 0) {
        console.log('No files selected')
        return
      }

      console.log(`Selected ${files.length} files`)
      
      // 切换到记录标签页（在耗时操作之前）
      await setLeftSidebarTab('notes')
      
      for (let i = 0; i < files.length; i++) {
        console.log(`Processing file ${i + 1}:`, files[i].name)
        await uploadMobileFile(files[i])
      }
      
      // 重置 input
      event.target.value = ''
    } catch (error) {
      console.error('Error in handleFileInputChange:', error)
    }
  }

  // 移动端文件上传
  async function uploadMobileFile(file: File) {
    const queueId = uuid()
    
    try {
      console.log('uploadMobileFile started for:', file.name)
      addQueue({ queueId, tagId: currentTagId!, progress: t('record.mark.progress.cacheImage'), type: 'image', startTime: Date.now() })
      
      const ext = file.name.substring(file.name.lastIndexOf('.') + 1) || 'jpg'
      console.log('File extension:', ext)
      
      const isImageFolderExists = await exists('image', { baseDir: BaseDirectory.AppData})
      if (!isImageFolderExists) {
        console.log('Creating image folder')
        await mkdir('image', { baseDir: BaseDirectory.AppData})
      }
      
      // 将文件保存到本地
      const filename = `${queueId}.${ext}`
      console.log('Saving file as:', filename)
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      await writeFile(`image/${filename}`, uint8Array, { baseDir: BaseDirectory.AppData })
      console.log('File saved successfully')
      
      let content = ''
      let desc = ''
      
      // Skip image recognition if disabled
      if (!enableImageRecognition) {
        console.log('Image recognition disabled')
        setQueue(queueId, { progress: t('record.mark.progress.save') });
        content = ''
        desc = ''
      } else if (primaryImageMethod === 'vlm') {
        // 使用 VLM 识别图片
        console.log('Using VLM for image recognition')
        setQueue(queueId, { progress: t('record.mark.progress.aiAnalysis') });
        const base64 = await fileToBase64(file)
        content = await fetchAiDescByImage(base64) || 'VLM Error'
        desc = content
      } else {
        // 使用 OCR 识别图片
        console.log('Using OCR for image recognition')
        setQueue(queueId, { progress: t('record.mark.progress.ocr') });
        content = await ocr(`image/${filename}`)
        setQueue(queueId, { progress: t('record.mark.progress.aiAnalysis') });
        if (primaryModel) {
          desc = await fetchAiDesc(content).then(res => res ? res : content) || content
        } else {
          desc = content
        }
      }
      
      const mark: Partial<Mark> = {
        tagId: currentTagId,
        type: 'image',
        content,
        url: filename,
        desc,
      }
      
      // 尝试上传图片到图床（如果配置了图床）
      try {
        console.log('Attempting to upload to image hosting')
        const url = await uploadImage(file)
        if (url) {
          console.log('Image uploaded to hosting:', url)
          setQueue(queueId, { progress: t('record.mark.progress.uploadImage') });
          mark.url = url
        }
      } catch (uploadError) {
        console.error('Failed to upload to image hosting:', uploadError)
        // 继续使用本地文件
      }
      
      console.log('Saving mark to database')
      removeQueue(queueId)
      await insertMark(mark)
      await fetchMarks()
      await fetchTags()
      getCurrentTag()
      
      console.log('Upload completed successfully')
    } catch (error) {
      console.error('Error in uploadMobileFile:', error)
      removeQueue(queueId)
      // 可以选择显示错误提示给用户
    }
  }

  // 将文件转换为 base64
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function upload(path: string) {
    const queueId = uuid()
    addQueue({ queueId, tagId: currentTagId!, progress: t('record.mark.progress.cacheImage'), type: 'image', startTime: Date.now() })
    const ext = path.substring(path.lastIndexOf('.') + 1)
    const isImageFolderExists = await exists('image', { baseDir: BaseDirectory.AppData})
    if (!isImageFolderExists) {
      await mkdir('image', { baseDir: BaseDirectory.AppData})
    }
    await copyFile(path, `image/${queueId}.${ext}`, { toPathBaseDir: BaseDirectory.AppData})
    const fileData = await readFile(path)
    const filename = `${queueId}.${ext}`
    let content = ''
    let desc = ''
    
    // Skip image recognition if disabled
    if (!enableImageRecognition) {
      setQueue(queueId, { progress: t('record.mark.progress.save') });
      content = ''
      desc = ''
    } else if (primaryImageMethod === 'vlm') {
      // 使用 VLM 识别图片
      setQueue(queueId, { progress: t('record.mark.progress.aiAnalysis') });
      const base64 = `data:image/${ext};base64,${Buffer.from(fileData).toString('base64')}`
      content = await fetchAiDescByImage(base64) || 'VLM Error'
      desc = content
    } else {
      // 使用 OCR 识别图片
      setQueue(queueId, { progress: t('record.mark.progress.ocr') });
      content = await ocr(`image/${filename}`)
      setQueue(queueId, { progress: t('record.mark.progress.aiAnalysis') });
      if (primaryModel) {
        desc = await fetchAiDesc(content).then(res => res ? res : content) || content
      } else {
        desc = content
      }
    }
    
    const mark: Partial<Mark> = {
      tagId: currentTagId,
      type: 'image',
      content,
      url: filename,
      desc,
    }
    
    // 尝试上传图片到图床（如果配置了图床）
    const file = new File([new Uint8Array(fileData)], filename, { type: `image/${ext}` })
    const url = await uploadImage(file)
    if (url) {
      setQueue(queueId, { progress: t('record.mark.progress.uploadImage') });
      mark.url = url
    }
    
    removeQueue(queueId)
    await insertMark(mark)
    await fetchMarks()
    await fetchTags()
    getCurrentTag()
  }

  return (
    <>
      {/* 移动端文件选择 */}
      {isMobile && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
      )}
      <TooltipButton icon={<ImagePlus />} tooltipText={t('record.mark.type.image')} onClick={selectImages} />
    </>
  )
}
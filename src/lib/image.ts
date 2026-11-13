const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function isHeic(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.(hei[cf])$/i.test(file.name)
}

/** 將 HEIC/HEIF 轉為 JPEG，讓瀏覽器預覽、Supabase Storage 與去背服務都能處理。 */
export async function toUploadableImage(file: File): Promise<File> {
  if (!isHeic(file)) return file
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`「${file.name}」超過 10 MB，請縮小原圖後再試。`)

  try {
    const { default: heic2any } = await import('heic2any')
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.88 })
    const jpeg = Array.isArray(result) ? result[0] : result
    if (!jpeg || jpeg.size === 0) throw new Error('轉檔結果是空的。')
    if (jpeg.size > MAX_IMAGE_BYTES) throw new Error('轉換後的照片超過 10 MB，請縮小原圖後再試。')

    const baseName = file.name.replace(/\.(hei[cf])$/i, '') || 'photo'
    return new File([jpeg], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('10 MB')) throw error
    throw new Error(`「${file.name}」無法轉成 JPEG，請確認檔案完整後重試。`)
  }
}

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}
const BUCKET = 'closet-images'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function isOriginalPath(path: string, userId: string, itemId: string) {
  const segments = path.split('/')
  return segments.length === 3
    && segments[0] === userId
    && segments[1] === itemId
    && /^original\.(jpe?g|png|webp)$/i.test(segments[2])
}

function isItemPhotoPath(path: string, userId: string, itemId: string) {
  const segments = path.split('/')
  return segments.length === 4
    && segments[0] === userId
    && segments[1] === itemId
    && segments[2] === 'photos'
    && /^[a-z0-9-]+\.(jpe?g|png|webp)$/i.test(segments[3])
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response(405, { error: '只接受 POST 請求。' })

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return response(401, { error: '請先登入後再進行去背。' })

  let itemId: string
  let destination: 'closet' | 'wishlist'
  let photoIndex: number | undefined
  try {
    const body = await request.json() as { itemId?: unknown; wishlistItemId?: unknown; photoIndex?: unknown }
    const closetId = typeof body.itemId === 'string' ? body.itemId : null
    const wishlistId = typeof body.wishlistItemId === 'string' ? body.wishlistItemId : null
    if (Boolean(closetId) === Boolean(wishlistId)) return response(400, { error: '請提供一個衣物或選購項目識別碼。' })
    const id = closetId ?? wishlistId
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return response(400, { error: '衣物識別資料格式不正確。' })
    }
    if (body.photoIndex !== undefined) {
      if (!Number.isInteger(body.photoIndex) || (body.photoIndex as number) < 0 || (body.photoIndex as number) > 7) {
        return response(400, { error: '去背照片索引不正確。' })
      }
      photoIndex = body.photoIndex as number
    }
    itemId = id
    destination = closetId ? 'closet' : 'wishlist'
  } catch {
    return response(400, { error: '請提供有效的 JSON 請求內容。' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const removeBgKey = Deno.env.get('REMOVE_BG_API_KEY')
  if (!supabaseUrl || !anonKey || !removeBgKey) {
    console.error('Missing Supabase or remove.bg function secrets.')
    return response(500, { error: '去背服務尚未完成設定。' })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userResult, error: authError } = await userClient.auth.getUser()
  const user = userResult.user
  if (authError || !user) return response(401, { error: '登入狀態已失效，請重新登入。' })

  const table = destination === 'closet' ? 'items' : 'wishlist_items'
  const { data: item, error: itemError } = await userClient
    .from(table)
    .select('id,owner_id,image_original_path,cutout_status')
    .eq('id', itemId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (itemError) {
    console.error('Could not read item for background removal:', itemError.message)
    return response(500, { error: '讀取衣物資料失敗，請稍後重試。' })
  }
  if (!item) return response(404, { error: '找不到這件衣物，或你沒有存取權限。' })
  if (item.cutout_status === 'processing') return response(409, { error: '這件衣物正在去背中，請稍後再試。' })

  let sourcePath = item.image_original_path as string | null
  if (photoIndex !== undefined) {
    const photoColumn = destination === 'closet' ? 'item_id' : 'wishlist_item_id'
    const { data: photo, error: photoError } = await userClient.from('item_photos')
      .select('storage_path')
      .eq(photoColumn, itemId)
      .eq('sort_order', photoIndex)
      .maybeSingle()
    if (photoError) {
      console.error('Could not read selected source photo:', photoError.message)
      return response(500, { error: '讀取所選照片失敗，請稍後重試。' })
    }
    if (photo?.storage_path) sourcePath = photo.storage_path
    else if (photoIndex !== 0) return response(404, { error: '找不到所選照片，請重新選擇。' })
  }

  if (!sourcePath || !(isOriginalPath(sourcePath, user.id, itemId) || isItemPhotoPath(sourcePath, user.id, itemId))) {
    return response(400, { error: '這件衣物沒有有效的原始圖片路徑。' })
  }

  const { data: original, error: downloadError } = await userClient.storage.from(BUCKET).download(sourcePath)
  if (downloadError || !original) {
    console.error('Could not download original item image:', downloadError?.message)
    return response(404, { error: '找不到原始照片；原衣物資料仍保留。' })
  }
  if (original.size <= 0 || original.size > MAX_IMAGE_BYTES) {
    return response(413, { error: '圖片需小於 10 MB，請縮小圖片後再試。' })
  }
  if (!ALLOWED_MIME.has(original.type.toLowerCase())) {
    return response(415, { error: '目前支援 JPEG、PNG 或 WebP 圖片。' })
  }

  const { error: processingError } = await userClient.from(table).update({ cutout_status: 'processing' }).eq('id', itemId)
  if (processingError) {
    console.error('Could not set cutout status:', processingError.message)
    return response(500, { error: '無法開始去背程序，請稍後重試。' })
  }

  try {
    const form = new FormData()
    form.append('image_file', original, 'original-image')
    form.append('size', 'auto')
    form.append('format', 'png')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60_000)
    let providerResponse: Response
    try {
      providerResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': removeBgKey },
        body: form,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (!providerResponse.ok) {
      const message = (await providerResponse.text()).slice(0, 1000)
      console.error('remove.bg request failed:', providerResponse.status, message)
      throw new Error('去背服務暫時無法處理這張圖片。')
    }

    const cutout = await providerResponse.blob()
    if (cutout.size <= 0 || cutout.size > MAX_IMAGE_BYTES * 2) throw new Error('去背結果大小不符合限制。')

    const outputPath = `${user.id}/${itemId}/cutout.png`
    const { error: uploadError } = await userClient.storage.from(BUCKET).upload(outputPath, cutout, {
      contentType: 'image/png',
      upsert: true,
    })
    if (uploadError) throw new Error('去背完成，但圖片儲存失敗。')

    const { error: updateError } = await userClient.from(table).update({
      image_cutout_path: outputPath,
      cutout_status: 'done',
    }).eq('id', itemId)
    if (updateError) {
      await userClient.storage.from(BUCKET).remove([outputPath])
      throw new Error('去背結果無法更新到衣物資料。')
    }

    return response(200, { itemId, destination, cutoutPath: outputPath, status: 'done' })
  } catch (error) {
    console.error('Background removal failed:', error)
    const { error: statusError } = await userClient.from(table).update({ cutout_status: 'failed' }).eq('id', itemId)
    if (statusError) console.error('Could not record cutout failure:', statusError.message)
    const message = error instanceof Error && error.name === 'AbortError'
      ? '去背處理逾時，原始照片已保留，請稍後重試。'
      : error instanceof Error ? error.message : '去背失敗，原始照片已保留。'
    return response(502, { error: message, status: 'failed' })
  }
})

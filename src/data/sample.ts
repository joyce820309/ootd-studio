import type { ClosetItem, WishlistItem } from '@/types'

/** 示範模式用的衣櫃資料（與設計稿一致） */
export const SAMPLE_ITEMS: ClosetItem[] = [
  { id: 'blazer', name: '炭灰短版西裝外套', categoryId: 'outer', slot: 'outer', colorName: '炭灰', colorHex: '#3D3D3B', brand: 'Zara', size: 'M', status: 'ok', isFavorite: true, shape: 'coat', wearCount: 11 },
  { id: 'camel', name: '駝色羊毛長大衣', categoryId: 'outer', slot: 'outer', colorName: '駝色', colorHex: '#B88A5A', brand: 'Arket', size: 'S', status: 'ok', shape: 'coat', wearCount: 3 },
  { id: 'suede', name: '深咖啡麂皮夾克', categoryId: 'outer', slot: 'outer', colorName: '深咖啡', colorHex: '#5A4031', brand: 'Massimo Dutti', size: 'S', status: 'lent', shape: 'coat', wearCount: 4 },
  { id: 'knit', name: '燕麥色羊毛針織衫', categoryId: 'top', slot: 'top', colorName: '燕麥', colorHex: '#D9CBB3', brand: 'COS', size: 'M', status: 'ok', isFavorite: true, shape: 'knit', wearCount: 14 },
  { id: 'tee', name: '白色厚磅素 T', categoryId: 'top', slot: 'top', colorName: '白', colorHex: '#F4F1EA', brand: 'UNIQLO U', size: 'M', status: 'ok', shape: 'tee', wearCount: 32 },
  { id: 'wine', name: '酒紅羊毛混紡毛衣', categoryId: 'top', slot: 'top', colorName: '酒紅', colorHex: '#6E2E34', brand: 'Arket', size: 'M', status: 'ok', shape: 'knit', wearCount: 6 },
  { id: 'shirt', name: '白色牛津長袖襯衫', categoryId: 'top', slot: 'top', colorName: '白', colorHex: '#F4F1EA', brand: 'UNIQLO', size: 'M', status: 'cleaning', shape: 'shirt', wearCount: 21 },
  { id: 'jeans', name: '淺藍高腰直筒牛仔褲', categoryId: 'bottom', slot: 'bottom', colorName: '淺藍', colorHex: '#8FA3BC', brand: "Levi's", size: 'W26 L30', status: 'ok', isFavorite: true, shape: 'pants', wearCount: 27 },
  { id: 'slacks', name: '深藍打褶西裝褲', categoryId: 'bottom', slot: 'bottom', colorName: '深藍', colorHex: '#2E3A4F', brand: 'Massimo Dutti', size: '36', status: 'ok', shape: 'pants', wearCount: 9 },
  { id: 'skirt', name: '鼠尾草綠百褶中長裙', categoryId: 'bottom', slot: 'bottom', colorName: '鼠尾草綠', colorHex: '#8C9A86', brand: 'MUJI', size: 'M', status: 'ok', shape: 'skirt', wearCount: 5 },
  { id: 'sneaker', name: '米白德訓鞋', categoryId: 'shoes', slot: 'shoes', colorName: '米白', colorHex: '#EDE7DA', brand: 'adidas', size: 'US 6.5', status: 'ok', isFavorite: true, shape: 'shoe', wearCount: 25 },
  { id: 'boots', name: '黑色皮革短靴', categoryId: 'shoes', slot: 'shoes', colorName: '黑', colorHex: '#2A2826', brand: 'Vagabond', size: 'EU 38', status: 'ok', shape: 'boot', wearCount: 8 },
  { id: 'loafer', name: '黑色樂福鞋', categoryId: 'shoes', slot: 'shoes', colorName: '黑', colorHex: '#1F1F1E', brand: 'Clarks', size: 'EU 37.5', status: 'repair', shape: 'shoe', wearCount: 18 },
  { id: 'tote', name: '焦糖皮革托特包', categoryId: 'bag', slot: 'bag', colorName: '焦糖', colorHex: '#9A6B43', brand: 'Charles & Keith', status: 'ok', shape: 'bag', wearCount: 19 },
  { id: 'black-bag', name: '黑色皮革肩背包', categoryId: 'bag', slot: 'bag', colorName: '黑', colorHex: '#2B2826', status: 'ok', shape: 'bag', wearCount: 7 },
  { id: 'scarf', name: '灰色羊毛圍巾', categoryId: 'acc', slot: 'acc', colorName: '灰', colorHex: '#9A9893', brand: 'UNIQLO', status: 'stored', shape: 'scarf', wearCount: 2 },
]

export const SAMPLE_WISHLIST: WishlistItem[] = [
  { id: 'w-navy', name: '海軍藍雙排扣西裝外套', slot: 'outer', colorHex: '#2E3A4F', shop: 'Massimo Dutti', price: 5990, status: 'waiting', shape: 'coat' },
  { id: 'w-cos', name: '羊毛混紡高腰寬褲', slot: 'bottom', colorHex: '#EFE8DA', shop: 'COS 官網', price: 3900, shipping: 0, sizeNote: '36 有貨', status: 'considering', compareGroupId: 'g-pants', shape: 'pants' },
  { id: 'w-uq', name: '寬版九分打褶褲', slot: 'bottom', colorHex: '#E6DCC8', shop: 'UNIQLO 線上', price: 990, shipping: 60, sizeNote: 'M 有貨', status: 'considering', compareGroupId: 'g-pants', shape: 'pants' },
  { id: 'w-shop', name: '奶油白羊毛直筒寬褲', slot: 'bottom', colorHex: '#F2EADB', shop: '選物店・蝦皮', price: 2280, shipping: 60, sizeNote: '只剩 L', status: 'considering', compareGroupId: 'g-pants', shape: 'pants' },
]

import { createBrowserRouter, Link, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProfileLayout } from '@/components/layout/ProfileNav'
import { AuthProvider, RequireAuth } from '@/lib/auth'
import { ClosetPage } from '@/pages/ClosetPage'
import { HomePage } from '@/pages/HomePage'
import { ItemDetailPage } from '@/pages/ItemDetailPage'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { MeasurementHistoryPage } from '@/pages/MeasurementHistoryPage'
import { OutfitPage } from '@/pages/OutfitPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { StudioPage } from '@/pages/StudioPage'
import { AddItemPage } from '@/pages/AddItemPage'
import { BrandsPage } from '@/pages/BrandsPage'
import { DiaryPage } from '@/pages/DiaryPage'
import { ComparePage } from '@/pages/ComparePage'
import { WishlistPage } from '@/pages/WishlistPage'
import { MaterialsPage, ShopsPage } from '@/pages/ManagedListsPage'

function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="m-0 font-hd text-3xl">這一頁不在衣櫃裡</h1>
      <Link to="/home">回首頁</Link>
    </main>
  )
}

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/home', element: <HomePage /> },
      { path: '/closet', element: <ClosetPage /> },
      { path: '/closet/new', element: <AddItemPage /> },
      { path: '/closet/:id', element: <ItemDetailPage /> },
      { path: '/outfit', element: <OutfitPage /> },
      { path: '/studio', element: <StudioPage /> },
      { path: '/diary', element: <DiaryPage /> },
      { path: '/diary/new', element: <DiaryPage /> },
      { path: '/diary/:id', element: <DiaryPage /> },
      { path: '/diary/:id/edit', element: <DiaryPage /> },
      { path: '/wishlist', element: <WishlistPage /> },
      { path: '/wishlist/compare', element: <ComparePage /> },
      {
        // 個人資料：大螢幕共用左側子導覽
        element: <ProfileLayout />,
        children: [
          { path: '/me', element: <ProfilePage /> },
          { path: '/me/measurements', element: <MeasurementHistoryPage /> },
          { path: '/me/measurements/:id', element: <MeasurementHistoryPage /> },
          { path: '/me/brands', element: <BrandsPage /> },
          { path: '/me/shops', element: <ShopsPage /> },
          { path: '/me/materials', element: <MaterialsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

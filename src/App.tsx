import { createBrowserRouter, Link, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthProvider, RequireAuth } from '@/lib/auth'
import { ClosetPage } from '@/pages/ClosetPage'
import { HomePage } from '@/pages/HomePage'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { OutfitPage } from '@/pages/OutfitPage'
import { AddItemPage, ComparePage, DiaryPage, ItemDetailPage, ProfilePage, WishlistPage } from '@/pages/stubs'

function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="m-0 font-hd text-3xl font-bold">這一頁不在衣櫃裡</h1>
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
      { path: '/diary', element: <DiaryPage /> },
      { path: '/wishlist', element: <WishlistPage /> },
      { path: '/wishlist/compare', element: <ComparePage /> },
      { path: '/me', element: <ProfilePage /> },
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

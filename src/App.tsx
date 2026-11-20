import { createBrowserRouter, Link, RouterProvider, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProfileLayout } from "@/components/layout/ProfileNav";
import { WishlistLayout } from "@/components/wishlist/WishlistLayout";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import { ClosetPage } from "@/pages/ClosetPage";
import { HomePage } from "@/pages/HomePage";
import { ItemDetailPage } from "@/pages/ItemDetailPage";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { MeasurementFormPage } from "@/pages/MeasurementFormPage";
import { MeasurementHistoryPage } from "@/pages/MeasurementHistoryPage";
import { OutfitPage } from "@/pages/OutfitPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { StudioPage } from "@/pages/StudioPage";
import { AddItemPage } from "@/pages/AddItemPage";
import { BrandsPage } from "@/pages/BrandsPage";
import { DiaryPage } from "@/pages/DiaryPage";
import { ComparePage } from "@/pages/ComparePage";
import { WishlistPage } from "@/pages/WishlistPage";
import { WishlistItemPage } from "@/pages/WishlistItemPage";
import { MaterialsPage, ShopsPage } from "@/pages/ManagedListsPage";
import { LessonsPage } from "@/pages/LessonsPage";
import { ReviewPage } from "@/pages/ReviewPage";
import { CopyItemPage } from "@/pages/CopyItemPage";
import { FeaturesPage } from "@/pages/FeaturesPage";

/** /closet/new：有 ?from= 時是複製衣物（換貨下一步、複製這件），否則是一般新增 */
function NewItemRoute() {
  const [params] = useSearchParams();
  const from = params.get("from");
  return from ? <CopyItemPage key={from} fromId={from} reason={params.get("reason")} /> : <AddItemPage />;
}

function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="m-0 font-hd text-3xl">這一頁不在衣櫃裡</h1>
      <Link to="/home">回首頁</Link>
    </main>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: "/home", element: <HomePage /> },
      { path: "/closet", element: <ClosetPage /> },
      { path: "/closet/new", element: <NewItemRoute /> },
      { path: "/closet/lessons", element: <LessonsPage /> },
      { path: "/closet/:id", element: <ItemDetailPage /> },
      { path: "/closet/:id/review", element: <ReviewPage /> },
      { path: "/outfit", element: <OutfitPage /> },
      { path: "/studio", element: <StudioPage /> },
      { path: "/diary", element: <DiaryPage /> },
      { path: "/diary/new", element: <DiaryPage /> },
      { path: "/diary/:id", element: <DiaryPage /> },
      { path: "/diary/:id/edit", element: <DiaryPage /> },
      {
        // 清單／比較共用頁首，切換分頁時頁首不重繪
        path: "/wishlist",
        element: <WishlistLayout />,
        children: [
          { index: true, element: <WishlistPage /> },
          { path: "compare", element: <ComparePage /> },
          { path: "compare/:id", element: <ComparePage /> },
        ],
      },
      { path: "/wishlist/:id", element: <WishlistItemPage /> },
      {
        // 個人資料：大螢幕共用左側子導覽
        element: <ProfileLayout />,
        children: [
          { path: "/me", element: <ProfilePage /> },
          { path: "/me/measurements", element: <MeasurementHistoryPage /> },
          { path: "/me/measurements/new", element: <MeasurementFormPage /> },
          { path: "/me/measurements/:id/edit", element: <MeasurementFormPage /> },
          { path: "/me/measurements/:id", element: <MeasurementHistoryPage /> },
          { path: "/me/brands", element: <BrandsPage /> },
          { path: "/me/shops", element: <ShopsPage /> },
          { path: "/me/materials", element: <MaterialsPage /> },
          { path: "/me/features", element: <FeaturesPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

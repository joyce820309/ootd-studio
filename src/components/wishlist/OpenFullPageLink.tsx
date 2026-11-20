/** 「開完整頁面 ↗」：用新分頁打開 /wishlist/:id（B7.3），原頁面不動。手機版只留 ↗ 圖示。 */
export function OpenFullPageLink({ itemId, iconOnly = false, className = '' }: { itemId: string; iconOnly?: boolean; className?: string }) {
  const icon = <svg viewBox="0 0 24 24" aria-hidden="true" className={`${iconOnly ? 'size-5' : 'size-4'} flex-none fill-none stroke-current`} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" /></svg>
  return (
    <a
      href={`/wishlist/${encodeURIComponent(itemId)}`}
      target="_blank"
      rel="noopener"
      aria-label={iconOnly ? '開完整頁面（另開新分頁）' : undefined}
      title={iconOnly ? '開完整頁面' : undefined}
      className={`inline-flex flex-none items-center justify-center gap-1 rounded-btn text-mist-deep no-underline hover:bg-tile ${iconOnly ? 'size-11' : 'h-10 px-2.5 text-[13px]'} ${className}`}
    >
      {iconOnly ? icon : <>開完整頁面<span className="sr-only">（另開新分頁）</span>{icon}</>}
    </a>
  )
}

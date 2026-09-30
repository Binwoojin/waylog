// PlacePinIcon과 같은 규칙을 따르는 북마크 아이콘입니다.
// filled=true(북마크한 상태)면 채워서, 아니면 외곽선만 그립니다.
export default function BookmarkIcon({ size = 18, className = '', filled = false }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// PlacePinIcon과 같은 규칙(currentColor, size/className props)을 따르는 좋아요 아이콘입니다.
// filled=true(좋아요 누른 상태)면 채워서, 아니면 외곽선만 그립니다.
export default function HeartIcon({ size = 18, className = '', filled = false }) {
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
        d="M12 20.5s-7.5-4.6-10-9.3C.6 8 2 4.5 5.4 3.6c2-.5 4 .3 5.1 2 .3.5.9.5 1.2 0 1.1-1.7 3.1-2.5 5.1-2 3.4.9 4.8 4.4 3.4 7.6-2.5 4.7-10 9.3-10 9.3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// PlacePinIcon과 같은 규칙(currentColor, size/className props)을 따르는 여행코스 참조 아이콘입니다.
// 위치 태그(장소 하나)와 여행코스 태그(일자·경유지로 이어지는 경로)는 서로 다른 개념이라
// PlacePinIcon을 그대로 쓰지 않고, 두 지점을 점선 경로로 잇는 모양으로 구분합니다
// (code-review Should Improve — tour-course-feed-linking).
export default function CourseRouteIcon({ size = 16, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4.5 18.5c3-1 2.5-4.5 5.5-5.5s2.5-4.5 5.5-5.5c1.8-.6 3-1.7 3.8-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="0.1 4.2"
      />
      <circle cx="4.5" cy="18.5" r="2.2" fill="currentColor" />
      <circle cx="19.3" cy="4.5" r="2.2" fill="currentColor" />
    </svg>
  )
}

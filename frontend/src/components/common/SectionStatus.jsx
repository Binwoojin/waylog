/**
 * 섹션 상태 안내(표시 컴포넌트): 로딩 · 빈 결과 · 오류
 *
 * 홈 공지, 여행지·즐길거리 미리보기, 축제 목록이 같은 모양과 같은 접근성 속성을 쓰도록 한 곳에 모읍니다.
 * 스타일은 HomeSections.css의 .home-section__status를 씁니다. 현재 Footer.jsx가 이 CSS를 불러오므로 전역으로 적용됩니다.
 * 재시도 버튼은 pages/StatusPage.css의 status-page__button을 씁니다. 이 CSS는 ErrorBoundary.jsx가 import하고,
 * App.jsx가 ErrorBoundary를 정적으로 import하므로 앱 전역에 로드됩니다. StatusPage.css를 옮기거나
 * ErrorBoundary import를 지연 로딩으로 바꾸면 이 버튼의 스타일이 빠질 수 있으니 함께 확인해야 합니다.
 * 이 CSS를 공용 위치로 옮기는 일은 후속 과제입니다.
 *
 * variant:
 * - 'loading': role="status"로 진행 상태를 알립니다.
 * - 'empty'(기본): 역할 없이 문구만 보여 줍니다.
 * - 'error': role="alert"로 알리고, 이 섹션에서만 재시도 버튼을 보여 줍니다. onRetry가 필요합니다.
 */
export default function SectionStatus({ variant = 'empty', message, onRetry }) {
  if (variant === 'error') {
    return (
      <div className="home-section__status home-section__status--error" role="alert">
        <p>{message}</p>
        <button type="button" className="status-page__button status-page__button--primary" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <p className="home-section__status" role={variant === 'loading' ? 'status' : undefined}>
      {message}
    </p>
  )
}

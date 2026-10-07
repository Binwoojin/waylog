import { useEffect, useId, useRef } from 'react'
import { LIST_STATUS_MESSAGES } from './listMessages'
import '../../pages/StatusPage.css'

/**
 * 목록의 조건 없음·빈 결과·오류 안내 블록 (표시 컴포넌트)
 *
 * Design Ref: §5.1 — 오류 화면(NotFound·상세 오류)과 같은 status-page 카드 모양을 목록 영역 안에서 씁니다.
 * 탭·필터 바는 그대로 보이므로 사용자는 조건을 바로 바꿔 복구할 수 있습니다.
 *
 * variant   role     주 버튼
 * no-query  없음     조건 선택하기
 * empty     status   조건 초기화 / 조건 변경
 * invalid   alert    조건 초기화
 * error     alert    다시 시도
 *
 * focusOnMount (error 전용, 이전 기능 SI-2와 같은 규칙)
 * 재시도가 또 실패하면 "다시 시도" 버튼이 스켈레톤으로 바뀌며 사라져 포커스가 body로 떨어집니다.
 * 그때만 제목으로 포커스를 옮깁니다. 첫 실패에는 사용자가 누른 것이 없으므로 role="alert" 안내로 충분합니다.
 *
 * title/description (선택, tour-course-list-integration §7.2)
 * 기본 문구(LIST_STATUS_MESSAGES)는 여행지 목록 전용 표현("여행지가 없어요" 등)입니다.
 * 다른 도메인(여행코스 등)이 재사용할 때 이 두 값만 넘기면 문구를 바꿀 수 있습니다.
 * 넘기지 않으면 기존 호출부(TourListView)와 동작이 완전히 같습니다.
 */
export default function ListStatus({ variant, onAction, actionLabel, focusOnMount = false, title, description }) {
  const titleId = useId()
  const titleRef = useRef(null)
  const message = LIST_STATUS_MESSAGES[variant]
  const isAlert = variant === 'error' || variant === 'invalid'
  const role = isAlert ? 'alert' : variant === 'empty' ? 'status' : undefined

  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus()
  }, [focusOnMount])

  return (
    <div className="tour-list__status">
      <section className="status-page__card" role={role} aria-labelledby={titleId}>
        {message.eyebrow && (
          <p className="status-page__eyebrow status-page__eyebrow--error">{message.eyebrow}</p>
        )}
        <h2 className="status-page__title tour-list__status-title" id={titleId} tabIndex={-1} ref={titleRef}>
          {title ?? message.title}
        </h2>
        <p className="status-page__description">{description ?? message.description}</p>
        {onAction && (
          <div className="status-page__actions">
            <button className="status-page__button status-page__button--primary" type="button" onClick={onAction}>
              {actionLabel ?? message.actionLabel}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

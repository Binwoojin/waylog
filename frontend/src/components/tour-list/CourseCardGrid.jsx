import CourseCard from './CourseCard'

/**
 * 코스 카드 그리드 (표시 컴포넌트)
 *
 * Design Ref: tour-course-list-integration.design.md §2.2 — TourCardGrid와 그리드 레이아웃(CSS 클래스)은
 * 같지만 CourseCard를 매핑해야 해 분리했습니다. busy면 이전 카드를 흐리게 유지합니다(refreshing 중 클릭 방지).
 */
export default function CourseCardGrid({ cards, busy = false }) {
  return (
    <div className={`catalog-grid tour-list__grid${busy ? ' is-busy' : ''}`}>
      {cards.map(card => <CourseCard key={card.id} card={card} />)}
    </div>
  )
}

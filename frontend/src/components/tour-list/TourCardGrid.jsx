import TourCard from './TourCard'

/**
 * 카드 그리드 (표시 컴포넌트)
 *
 * Design Ref: §5.1 refreshing — busy면 이전 카드를 흐리게 유지하고 클릭을 막습니다.
 * 다른 조건의 카드를 눌러 엉뚱한 상세로 가는 일을 막고, 그리드 높이는 그대로 둡니다.
 * aria-busy는 목록 영역 전체(TourListView)가 가집니다.
 */
export default function TourCardGrid({ cards, busy = false }) {
  return (
    <div className={`catalog-grid tour-list__grid${busy ? ' is-busy' : ''}`}>
      {cards.map(card => <TourCard key={card.id} card={card} />)}
    </div>
  )
}

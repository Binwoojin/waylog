import './PageHero.css'

/**
 * 여행지(/destinations)·여행 즐기기(/enjoy) 메인 페이지의 상단 히어로입니다.
 *
 * 두 페이지는 "안내 문구 → 제목 → 설명 → 검색 버튼 → 검색 도움말 + 비주얼"이라는 같은 골격을 쓰지만
 * 페이지마다 마크업과 모바일 CSS를 따로 두면서 모바일에서 정렬·배치 방식이 서로 달라졌습니다.
 * 골격과 모바일 규칙은 이 컴포넌트와 PageHero.css 한곳에서 관리하고,
 * 페이지별 문구·비주얼·데스크톱 세부 치수만 props와 페이지 CSS(className 수정자)로 둡니다.
 *
 * props
 * - className: 페이지 수정자 클래스(예: 'page-hero--destinations'). 데스크톱·태블릿 세부 치수 조정 전용입니다.
 *   · 수정자 규칙(.page-hero--x .page-hero__y, 우선순위 0,2,0)은 모바일 공통 규칙(0,1,0)을 이기므로
 *     페이지 CSS에서 반드시 @media (min-width: 761px) 안에만 둡니다.
 *   · 모바일(760px 이하) 치수는 PageHero.css가 책임집니다. 페이지별 조정이 꼭 필요하면
 *     수정자로 공통 규칙을 덮지 말고 CSS 변수만 덮어씁니다.
 *   · 모바일 비주얼 높이는 --page-hero-visual-h(단위 없는 px 숫자)로 정하며, 비주얼 상자가 이 높이를 갖고
 *     페이지 비주얼은 상자를 채웁니다(축소가 필요하면 calc(var(--page-hero-visual-h) / 원본높이)로 배율 계산).
 * - eyebrow, title, description: 상단 문구. title은 페이지의 유일한 h1입니다.
 * - searchLabel, searchHint, onSearch: 검색 모달을 여는 버튼과 그 아래 도움말.
 * - visual: 오른쪽(모바일에서는 문구 아래) 비주얼. 대체 텍스트는 페이지가 책임집니다.
 */
export default function PageHero({ className = '', eyebrow, title, description, searchLabel, searchHint, onSearch, visual }) {
  return (
    <section className={`page-hero${className ? ` ${className}` : ''}`}>
      <div className="page-hero__inner">
        <div className="page-hero__copy">
          <p className="page-hero__eyebrow">{eyebrow}</p>
          <h1 className="page-hero__title">{title}</h1>
          <p className="page-hero__description">{description}</p>
          <button type="button" className="page-hero__search" onClick={onSearch}>{searchLabel}</button>
          {searchHint && <small className="page-hero__hint">{searchHint}</small>}
        </div>
        <div className="page-hero__visual">{visual}</div>
      </div>
    </section>
  )
}

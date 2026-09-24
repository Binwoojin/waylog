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
 * - className: 페이지 수정자 클래스(예: 'page-hero--destinations'). 데스크톱·태블릿 세부 치수 조정에 사용합니다.
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

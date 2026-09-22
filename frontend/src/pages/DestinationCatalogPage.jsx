import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import { cultureItems, destinationItems, courseItems } from '../data/destinationMocks'
import './DestinationCatalogPage.css'

const configs = {
  attraction: { breadcrumb: '관광지', title: '테마별 관광지', description: '관심 있는 테마를 선택하고 원하는 관광지를 둘러보세요.', tabs: ['전체', '자연', '역사', '문화', '체험', '휴양'], regions: ['서울', '제주'], items: destinationItems },
  culture: { breadcrumb: '문화시설', title: '문화와 역사를 만나는 곳', description: '지역의 역사와 문화를 다양한 공간에서 만나보세요.', tabs: ['전체', '박물관', '미술관', '전시관', '역사 유적', '공연장'], regions: ['서울', '부산'], items: cultureItems },
  course: { breadcrumb: '여행코스', title: '코스를 따라 떠나는 여행', description: '여러 장소를 순서대로 둘러보는 추천 코스를 확인해 보세요.', tabs: ['전체', '당일치기', '1박 2일', '2박 이상'], regions: ['대전', '부산', '제주'], items: courseItems },
}

export default function DestinationCatalogPage({ kind }) {
  const pageSize = 9
  const config = configs[kind]
  const gridRef = useRef(null)
  const [activeTab, setActiveTab] = useState('전체')
  const [bookmarkedCards, setBookmarkedCards] = useState(() => new Set())
  const [selectedRegion, setSelectedRegion] = useState('전체 지역')
  const [sortOrder, setSortOrder] = useState('기본')
  const [currentPage, setCurrentPage] = useState(1)
  const visibleItems = activeTab === '전체' ? config.items : config.items.filter(item => item.tag === activeTab || item.meta === activeTab)
  const regionItems = selectedRegion !== '전체 지역' ? visibleItems.filter(item => item.address.startsWith(selectedRegion)) : visibleItems
  const sortedItems = [...regionItems].sort((a, b) => {
    if (sortOrder === '이름순') return a.title.localeCompare(b.title, 'ko')
    if (sortOrder === '지역순') return a.address.localeCompare(b.address, 'ko')
    if (sortOrder === '최근 수정순') return config.items.indexOf(b) - config.items.indexOf(a)
    return config.items.indexOf(a) - config.items.indexOf(b)
  })
  const allCards = sortedItems.length ? Array.from({ length: 45 }, (_, index) => sortedItems[index % sortedItems.length]) : []
  const totalPages = Math.max(1, Math.ceil(allCards.length / pageSize))
  const cards = allCards.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const goToPage = page => {
    const nextPage = Math.min(totalPages, Math.max(1, page))
    if (nextPage === currentPage) return
    setCurrentPage(nextPage)
    window.requestAnimationFrame(() => window.scrollTo({ top: Math.max(0, gridRef.current?.offsetTop - 110), behavior: 'smooth' }))
  }

  const toggleBookmark = cardKey => {
    setBookmarkedCards(current => {
      const next = new Set(current)
      next.has(cardKey) ? next.delete(cardKey) : next.add(cardKey)
      return next
    })
  }

  return <div className="catalog-page">
    <main className="catalog-main">
      <p className="catalog-breadcrumb"><Link to="/">홈</Link><span>›</span><Link to="/destinations">여행지</Link><span>›</span>{config.breadcrumb}</p>
      <div className="catalog-title"><div><h1>{config.title}</h1><p>{config.description}</p></div></div>
      <div className="catalog-tabs">{config.tabs.map(tab => <button key={tab} className={activeTab === tab ? 'is-active' : ''} type="button" onClick={() => { setActiveTab(tab); setCurrentPage(1) }}>{tab}</button>)}</div>
      <div className="catalog-toolbar"><div><>
        <label className="catalog-select"><span>지역</span><select aria-label="지역 선택" value={selectedRegion} onChange={event => { setSelectedRegion(event.target.value); setCurrentPage(1) }}><option>전체 지역</option>{config.regions.map(region => <option key={region}>{region}</option>)}</select></label>
        <label className="catalog-select"><span>정렬</span><select aria-label="정렬 방식" value={sortOrder} onChange={event => { setSortOrder(event.target.value); setCurrentPage(1) }}><option>기본</option><option>이름순</option><option>지역순</option><option>최근 수정순</option></select></label>
      </></div><strong>총 <b>{allCards.length}</b>건</strong></div>
      <div ref={gridRef} className={`catalog-grid${kind === 'course' ? ' catalog-grid--course' : ''}`}>
        {cards.map((item, index) => {
          const cardKey = `${item.id}-${(currentPage - 1) * pageSize + index}`
          const isBookmarked = bookmarkedCards.has(cardKey)
          return <article className="catalog-card" key={cardKey}>
            <Link className="catalog-card__link" to={`/destinations/detail/${item.id}`}>
              <img src={item.image} alt="" />
              <span className="catalog-card__image-tag">{item.tag}</span>
              <div>
                <div className="catalog-card__heading"><h2>{item.title}</h2><small>{item.meta}</small></div>
                <p>{item.description}</p>
                {item.stops ? <div className="catalog-route">{item.stops.map(stop => <small key={stop}><i aria-hidden="true"/><span>{stop}</span></small>)}</div> : <small className="catalog-address"><PlacePinIcon />{item.address}</small>}
              </div>
            </Link>
            {kind !== 'course' && <button className={`catalog-card__bookmark${isBookmarked ? ' is-active' : ''}`} type="button" aria-label={`${item.title} 북마크 ${isBookmarked ? '해제' : '등록'}`} aria-pressed={isBookmarked} onClick={() => toggleBookmark(cardKey)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z" /></svg>
            </button>}
          </article>
        })}
      </div>
      <nav className="catalog-pagination" aria-label="페이지 이동"><button type="button" aria-label="이전 페이지" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map(page => <button key={page} type="button" className={currentPage === page ? 'is-active' : ''} aria-current={currentPage === page ? 'page' : undefined} onClick={() => goToPage(page)}>{page}</button>)}<button type="button" aria-label="다음 페이지" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}>›</button></nav>
    </main>
  </div>
}

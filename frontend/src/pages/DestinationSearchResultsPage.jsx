import { useState } from 'react'
import { Link } from 'react-router-dom'
import TravelSearchModal from '../components/search/TravelSearchModal'
import { destinationItems } from '../data/destinationMocks'
import './DestinationSearchResultsPage.css'

export default function DestinationSearchResultsPage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const params = new URLSearchParams(window.location.search)
  const location = [params.get('region'), params.get('district')].filter(Boolean).join(' ') || '전체 지역'
  const type = params.get('type') || '관광지'
  const detail = params.get('detail')
  const selectedConditions = [`지역 ${location}`, `유형 ${type}`, detail && `상세 ${detail}`].filter(Boolean)
  const items = Array.from({ length: 8 }, (_, index) => destinationItems[index % destinationItems.length])
  return <div className="search-results-page"><main className="search-results-main">
    <section className="search-results-banner"><div className="search-results-banner__summary"><strong>선택한 조건으로 여행지를 찾았어요</strong><p>{selectedConditions.map(condition => <span key={condition}>{condition}</span>)}</p></div><div className="search-results-banner__actions"><button type="button" onClick={() => setIsSearchOpen(true)}>조건 변경</button><button type="button" onClick={() => setIsSearchOpen(true)}>다시 검색</button></div></section>
    <h1>{location} {type} 검색 결과</h1><p>선택한 조건에 맞는 한국관광공사 TourAPI 관광정보입니다.</p><div className="search-results-count">총 <b>{items.length}</b>건</div>
    <div className="search-results-grid">{items.map((item,index) => <Link to={`/destinations/detail/${item.id}`} key={`${item.id}-${index}`}><img src={item.image} alt="" /><div><span>{item.tag}관광지</span><h2>{item.title}</h2><small>📍 {item.address}</small><p>{item.description}</p><div><b>☎ 문의 정보</b><b>🅿 주차 가능</b><b>🕘 운영 정보</b></div></div></Link>)}</div>
    <nav className="catalog-pagination"><button>‹</button><button className="is-active">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button>›</button></nav>
    <p className="search-results-notice">ⓘ 운영시간, 휴무일 등 일부 정보는 제공되지 않을 수 있습니다.</p>
  </main><TravelSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} /></div>
}

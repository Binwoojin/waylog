import { useState } from 'react'
import { Link } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import EnjoySearchModal from '../components/search/EnjoySearchModal'
import { enjoyConfigs } from '../data/enjoyMocks'
import './DestinationSearchResultsPage.css'
import './EnjoySearchResultsPage.css'

const typeMap = { '축제 · 행사':'festivals', 레포츠:'leports', 음식점:'food', 쇼핑:'shopping', 숙박:'stay' }

export default function EnjoySearchResultsPage() {
  const [isSearchOpen,setIsSearchOpen]=useState(false)
  const params=new URLSearchParams(window.location.search)
  const region=params.get('region')||'전체'
  const district=params.get('district')||''
  const type=params.get('type')||'축제 · 행사'
  const category=typeMap[type]||'festivals'
  const config=enjoyConfigs[category]
  const source=region==='전체'?config.items:config.items.filter(item=>item.location.startsWith(region))
  const items=source.length?Array.from({length:8},(_,index)=>source[index%source.length]):[]
  const location=[region,district].filter(value=>value&&value!=='전체').join(' ')||'전체 지역'
  const detail=params.get('detail')
  const selectedConditions=[`지역 ${location}`,`유형 ${type}`,detail&&`상세 ${detail}`].filter(Boolean)

  return <div className="search-results-page enjoy-results-page"><main className="search-results-main">
    <section className="search-results-banner"><div className="search-results-banner__summary"><strong>선택한 조건으로 여행 즐길거리를 찾았어요</strong><p>{selectedConditions.map(condition=><span key={condition}>{condition}</span>)}</p></div><div className="search-results-banner__actions"><button type="button" onClick={()=>setIsSearchOpen(true)}>조건 변경</button><button type="button" onClick={()=>setIsSearchOpen(true)}>다시 검색</button></div></section>
    <h1>{location} {type} 검색 결과</h1><p>선택한 조건에 맞는 한국관광공사 TourAPI 여행정보입니다.</p><div className="search-results-count">총 <b>{items.length}</b>건</div>
    <div className="search-results-grid">{items.map((item,index)=><Link to={`/enjoy/${category}/${item.id}`} key={`${item.id}-${index}`}><img src={item.image} alt=""/><div><span>{config.title}</span><h2>{item.title}</h2><small className="enjoy-results-location"><PlacePinIcon/>{item.location}</small><p>{item.description}</p><div><b>운영 정보</b><b>{item.meta}</b><b>상세정보 확인</b></div></div></Link>)}</div>
    <nav className="catalog-pagination"><button>‹</button><button className="is-active">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button>›</button></nav>
    <p className="search-results-notice">운영시간, 행사 일정, 이용요금 등 일부 정보는 현지 사정에 따라 변경될 수 있습니다.</p>
  </main><EnjoySearchModal isOpen={isSearchOpen} onClose={()=>setIsSearchOpen(false)}/></div>
}

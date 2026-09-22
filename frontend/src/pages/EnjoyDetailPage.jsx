import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import { enjoyConfigs, findEnjoyItem } from '../data/enjoyMocks'
import './EnjoyDetailPage.css'

const categoryFacts = {
  festivals:[['행사 기간','일정 확인'],['이용 요금','프로그램별 상이'],['문의','관광안내소']],
  leports:[['이용 시간','09:00 - 18:00'],['체험 난이도','초보 가능'],['예약','사전 예약 권장']],
  food:[['영업 시간','11:00 - 21:00'],['대표 메뉴','현장 메뉴판 확인'],['주차','인근 주차장 이용']],
  shopping:[['운영 시간','10:00 - 20:00'],['휴무일','점포별 상이'],['결제','점포별 확인']],
  stay:[['체크인','15:00'],['체크아웃','11:00'],['예약','숙소 문의']],
}

export default function EnjoyDetailPage() {
  const { category, id } = useParams()
  const navigate = useNavigate()
  const config=enjoyConfigs[category]||enjoyConfigs.festivals
  const item=findEnjoyItem(category,id)||config.items[0]
  const [saved,setSaved]=useState(false)
  const goBack=()=>window.history.length>1?window.history.back():navigate(`/enjoy/${category}`)
  return <div className="enjoy-detail-page"><main className="enjoy-detail-main">
    <button className="enjoy-detail-back" onClick={goBack}>← 이전 페이지</button>
    <nav className="enjoy-detail-crumb"><Link to="/enjoy">여행 즐기기</Link><i>›</i><Link to={`/enjoy/${category}`}>{config.title}</Link><i>›</i><strong>{item.title}</strong></nav>
    <header className="enjoy-detail-title"><div><span>{config.title}</span><h1>{item.title}</h1><p><PlacePinIcon size={19}/>{item.location}</p></div><button className={saved?'active':''} onClick={()=>setSaved(v=>!v)}><svg viewBox="0 0 24 24"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z"/></svg>{saved?'저장됨':'저장'}</button></header>
    <section className="enjoy-detail-cover"><img src={item.image} alt={item.title}/><div><small>TRAVEL EXPERIENCE</small><strong>{item.description}</strong></div></section>
    <section className="enjoy-detail-facts">{categoryFacts[category].map(([label,value])=><dl key={label}><dt>{label}</dt><dd>{label.includes('기간')?item.meta:value}</dd></dl>)}</section>
    <section className="enjoy-detail-content"><article><small>ABOUT</small><h2>{item.title} 소개</h2><p className="lead">{item.description}.</p><p>방문 전 운영 정보와 이용 조건을 확인하고, 현지의 안내 사항을 따라 안전하고 즐거운 여행을 준비해 보세요. TourAPI 연동 후에는 최신 소개정보와 상세 이용정보가 이 영역에 표시됩니다.</p><div className="enjoy-detail-guide"><h3>이용 안내</h3>{categoryFacts[category].map(([label,value])=><p key={label}><b>{label}</b><span>{label.includes('기간')?item.meta:value}</span></p>)}</div></article><aside><span>방문 전 확인</span><h2>최신 정보를 확인하세요</h2><p>운영시간, 요금, 예약 가능 여부는 현지 사정에 따라 변경될 수 있습니다.</p><button>전화 문의</button><button>정보 오류 제보</button></aside></section>
    <section className="enjoy-detail-map"><div><PlacePinIcon size={30}/><p>지도 API 연동 영역</p></div><aside><span>{config.title}</span><h3>{item.title}</h3><p>{item.location}</p><button>길찾기</button></aside></section>
    <section className="enjoy-detail-nearby"><header><small>MORE {config.title.toUpperCase()}</small><h2>함께 살펴볼 정보</h2></header><div>{config.items.filter(entry=>entry.id!==item.id).slice(0,3).map(entry=><Link to={`/enjoy/${category}/${entry.id}`} key={entry.id}><img src={entry.image} alt=""/><h3>{entry.title}</h3><p><PlacePinIcon size={15}/>{entry.location}</p></Link>)}</div></section>
  </main></div>
}

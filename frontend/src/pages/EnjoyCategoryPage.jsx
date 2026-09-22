import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import { enjoyCategories, enjoyConfigs } from '../data/enjoyMocks'
import './EnjoyCategoryPage.css'
import './EnjoyCategoryPageOverrides.css'

export default function EnjoyCategoryPage() {
  const { category } = useParams()
  const config = enjoyConfigs[category] || enjoyConfigs.festivals
  const [region, setRegion] = useState('전체 지역')
  const [sort, setSort] = useState('기본')
  const [saved, setSaved] = useState(() => new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 9
  const regions = [...new Set(config.items.map(item => item.location.split(/특별|광역/)[0].replace(/도$|시$/,'')))]
  const filtered = region === '전체 지역' ? config.items : config.items.filter(item => item.location.startsWith(region))
  const items = [...filtered].sort((a,b) => sort === '이름순' ? a.title.localeCompare(b.title,'ko') : sort === '지역순' ? a.location.localeCompare(b.location,'ko') : 0)
  const allCards = items.length ? Array.from({length:45},(_,index)=>items[index%items.length]) : []
  const totalPages = Math.max(1, Math.ceil(allCards.length / pageSize))
  const cards = allCards.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return <div className="enjoy-catalog-page"><main className="enjoy-catalog-main">
    <nav className="enjoy-catalog-crumb"><Link to="/">홈</Link><i>›</i><Link to="/enjoy">여행 즐기기</Link><i>›</i><strong>{config.title}</strong></nav>
    <header className="enjoy-catalog-hero"><div><h1>{config.title}</h1><p>{config.description}</p></div><img src={config.cover} alt=""/></header>
    <nav className="enjoy-catalog-tabs">{enjoyCategories.map(entry => <Link className={entry.slug===category?'active':''} to={`/enjoy/${entry.slug}`} key={entry.slug}>{entry.title}</Link>)}</nav>
    <div className="enjoy-catalog-toolbar"><div><label><span>지역</span><select value={region} onChange={e=>{setRegion(e.target.value);setCurrentPage(1)}}><option>전체 지역</option>{regions.map(value=><option key={value}>{value}</option>)}</select></label><label><span>정렬</span><select value={sort} onChange={e=>{setSort(e.target.value);setCurrentPage(1)}}><option>기본</option><option>이름순</option><option>지역순</option></select></label></div><strong>총 <b>{allCards.length}</b>건</strong></div>
    <section className="enjoy-catalog-grid">{cards.map((item,index)=>{const key=`${item.id}-${(currentPage-1)*pageSize+index}`,active=saved.has(key);return <article key={key}><Link to={`/enjoy/${category}/${item.id}`}><img src={item.image} alt=""/><span className="enjoy-catalog-badge">{config.title}</span><div><small>{item.meta}</small><h2>{item.title}</h2><p>{item.description}</p><address><PlacePinIcon/>{item.location}</address></div></Link><button className={active?'active':''} aria-label={`${item.title} 북마크`} aria-pressed={active} onClick={()=>setSaved(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next})}><svg viewBox="0 0 24 24"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z"/></svg></button></article>})}</section>
    <nav className="enjoy-catalog-pagination" aria-label="페이지 이동"><button disabled={currentPage===1} onClick={()=>setCurrentPage(page=>Math.max(1,page-1))}>‹</button>{Array.from({length:totalPages},(_,index)=>index+1).map(page=><button className={page===currentPage?'active':''} aria-current={page===currentPage?'page':undefined} onClick={()=>setCurrentPage(page)} key={page}>{page}</button>)}<button disabled={currentPage===totalPages} onClick={()=>setCurrentPage(page=>Math.min(totalPages,page+1))}>›</button></nav>
  </main></div>
}

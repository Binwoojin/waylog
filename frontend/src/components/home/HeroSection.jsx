import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../layout/Header'
import PlacePinIcon from '../icons/PlacePinIcon'
import TravelSearchModal from '../search/TravelSearchModal'
import heroBackground from '../../assets/figma/hero-main.png'
import './HeroSection.css'

function HeroSection() {
  // heroPhase는 인트로와 검색 안내 문구의 순차 등장 상태를 관리합니다.
  const [heroPhase, setHeroPhase] = useState('hidden')
  // 메인과 여행지 페이지가 동일한 TravelSearchModal을 공유합니다.
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  useEffect(() => {
    /*
     * 첫 문구가 페이드 인된 뒤 1초 동안 머물고,
     * 위로 이동한 다음 검색 안내 문구가 아래에서 올라옵니다.
     */
    const showIntro = window.setTimeout(() => setHeroPhase('intro-visible'), 80)
    const moveIntro = window.setTimeout(() => setHeroPhase('intro-shifted'), 1300)
    const showFinder = window.setTimeout(() => setHeroPhase('complete'), 1850)

    return () => {
      window.clearTimeout(showIntro)
      window.clearTimeout(moveIntro)
      window.clearTimeout(showFinder)
    }
  }, [])

  return (
    <section className="hero-section" style={{ backgroundImage: `url(${heroBackground})` }}>
      <div className="hero-section__overlay" />
      <Header />
      <div className={`hero-section__content hero-section__content--${heroPhase}`}>
        <div className="hero-section__intro">
          <p className="hero-section__eyebrow">WayLog</p>
          <h1 className="hero-section__title">당신의 여행이 모두의 여행이 되다.</h1>
        </div>
        <div className="hero-section__finder">
          <div className="hero-section__finder-main">
            <div>
              <h2>어떤 여행을 찾고 있나요?</h2>
              <p>지역과 테마를 선택해 나에게 맞는 여행지를 찾아보세요.</p>
            </div>
            <button className="hero-section__finder-button" type="button" onClick={() => setIsSearchOpen(true)}>여행지 찾기 <span aria-hidden="true">→</span></button>
          </div>

          {/* 자주 찾는 여행 테마로 바로 이동하는 빠른 탐색 메뉴입니다. */}
          <div className="hero-section__quick-links" aria-label="빠른 여행 테마">
            {/* 현재 실제로 구현된 페이지 범위 안에서만 이동하도록 링크를 구성했습니다. */}
            <Link to="/destinations"><PlacePinIcon />추천 여행지</Link>
            <Link to="/enjoy">✦ 여행 즐기기</Link>
            <Link to="/destinations">≋ 바다 여행</Link>
            <Link to="/destinations">♧ 가족 여행</Link>
            <Link to="/enjoy">⌂ 감성 숙소</Link>
          </div>
        </div>
      </div>
      <TravelSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </section>
  )
}
export default HeroSection

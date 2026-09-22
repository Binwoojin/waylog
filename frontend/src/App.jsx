import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/layout/Layout'
import { apiClient } from './api/client'
import './App.css'
import HeroSection from './components/home/HeroSection'
import RecommendedDestinationSection from './components/home/RecommendedDestinationSection'
import RecommendedCourseSection from './components/home/RecommendedCourseSection'
import ThemeDestinationSection from './components/home/ThemeDestinationSection'
import TravelRecordBanner from './components/home/TravelRecordBanner'
import WeeklyNewsSection from './components/home/WeeklyNewsSection'
import NoticeSection from './components/home/NoticeSection'
import Footer from './components/layout/Footer'
import TravelEnjoyPage from './pages/TravelEnjoyPage'
import DestinationsPage from './pages/DestinationsPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DestinationCatalogPage from './pages/DestinationCatalogPage'
import DestinationSearchResultsPage from './pages/DestinationSearchResultsPage'
import TravelDetailPage from './pages/TravelDetailPage'
import EnjoyCategoryPage from './pages/EnjoyCategoryPage'
import EnjoyDetailPage from './pages/EnjoyDetailPage'
import EnjoySearchResultsPage from './pages/EnjoySearchResultsPage'

/**
 * 홈 API 요청 Promise를 저장합니다.
 *
 * 개발 환경에서 React StrictMode가 useEffect를 두 번 검사하더라도
 * 동일한 /api/home 요청을 재사용해 중복 호출을 방지합니다.
 */
let homeDataPromise = null;

/**
 * 백엔드의 메인 화면 데이터를 한 번만 조회합니다.
 *
 * 요청이 이미 진행 중이거나 완료됐다면 기존 Promise를 반환합니다.
 */
function fetchHomeDataOnce() {
  if (!homeDataPromise) {
    homeDataPromise = apiClient.get('/api/home')
    .catch((error) => {
      /*
         * 요청이 실패했다면 Promise 캐시를 초기화합니다.
         *
         * 이렇게 해야 다음 화면 진입이나 재시도 시
         * API를 다시 호출할 수 있습니다.
      */
      homeDataPromise = null
      throw error
    })
  }
  return homeDataPromise
}

/**
 * WayLog 메인 페이지입니다.
 *
 * /api/home을 한 번 호출한 뒤 응답 데이터를
 * 각 홈 화면 섹션에 props로 전달합니다.
 */

function HomePage({ mainRef }) {
  /**
   * 백엔드가 반환한 메인 화면 전체 데이터입니다.
   *
   * 초기값에서도 모든 필드를 빈 배열로 지정해
   * 하위 컴포넌트가 안전하게 렌더링되도록 합니다.
   */

  const [homeData, setHomeData] = useState({
    recommendedDestinations: [],
    recommendedCourses: [],
    enjoyItems: [],
    festivals: [],
  })

  /**
   * 홈 API 요청 진행 상태입니다.
   */
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 홈 API 요청 실패 시 하위 컴포넌트에 전달할 메시지입니다.
   */
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    /*
     * 컴포넌트가 이미 제거된 후 비동기 요청이 완료될 수 있으므로
     * 상태 변경 가능 여부를 표시합니다.
     */

    let isActive = true

    async function loadHomeData() {
      try {
        setIsLoading(true)
        setErrorMessage('')

        /*
         * 중복 호출 방지 함수로 홈 데이터를 조회합니다.
         */

        const data = await fetchHomeDataOnce()

        if (!isActive) {
          return 
        }

        /*
         * 백엔드 필드가 누락되더라도 각 목록에 빈 배열을 적용합니다.
         */
        setHomeData({
          recommendedDestinations:
          data.recommendedDestinations ?? [],
          recommendedCourses: data.recommendedCourses ?? [],
          enjoyItems: data.enjoyItems ?? [],
          festivals: data.festivals ?? [],
        })
      } catch (error) {
        /*
         * 컴포넌트가 이미 제거된 경우에만
         * 이후 상태 변경을 중단합니다.
         */
        if (!isActive) {
          return
        }

        console.error('메인 화면 데이터 조회 중 오류가 발생했습니다.', error)
        setErrorMessage('메인 화면 데이터를 불러오지 못했습니다.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadHomeData()

     /*
     * 컴포넌트가 화면에서 제거되면 이후 상태 변경을 막습니다.
     */

    return () => {
      isActive = false
    }
  }, [])

  return (
    <div className="App">
        <HeroSection />
        {/*
          메인 비주얼 영역

          HeroSection 내부에는 다음 요소가 들어갑니다.
          - 로고와 내비게이션
          - 로그인 및 회원가입 버튼
          - 메인 소개 문구
          - 여행지와 날짜 검색창 (클릭 시 여행검색 모달 창이 뜸)
          - 빠른 검색 필터
          - 여행 기록하기 버튼
        */}

        <main className="main-content" ref={mainRef}>
          {/*
         * 추천 여행지는 homeData의 recommendedDestinations를
         * 전달받아 렌더링합니다.
         */}

          <RecommendedDestinationSection destinations={
            homeData.recommendedDestinations
          } 
          isLoading={isLoading}
          errorMessage={errorMessage}
          />

          {/*
         * 추천 여행코스는 동일한 API 응답의
         * recommendedCourses를 전달받습니다.
         */}

          <RecommendedCourseSection 
            courses={homeData.recommendedCourses}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />

          {/*
         * 여행을 더 즐겁게 영역은 enjoyItems를 전달받습니다.
         */}

          <ThemeDestinationSection 
            enjoyItems={homeData.enjoyItems}
            isLoading={isLoading}
            errorMessage={errorMessage}
          /> 

          <TravelRecordBanner /> {/* 새로운 여행 기록 작성을 유도하는 CTA 배너 */}
          
          <WeeklyNewsSection 
          festivals={homeData.festivals}
          isLoading={isLoading}
          errorMessage={errorMessage}
          /> {/* 지역 축제와 여행 팁 등의 최신 여행 소식 */}

          <NoticeSection /> {/* 서비스 점검, 운영 안내, 정책 변경 등의 공지사항 */}
        </main>

        <Footer /> {/* 회사 정보와 서비스 메뉴가 표시되는 페이지 하단 영역 */}
      </div>
  )
}

function App() {
  // 메인 콘텐츠가 Hero 위로 올라오는 스크롤 효과를 직접 제어하기 위한 DOM 참조입니다.
  const mainRef = useRef(null)

  useLayoutEffect(() => {
    let animationFrameId = 0

    const updateMainPosition = () => {
      cancelAnimationFrame(animationFrameId)

      animationFrameId = requestAnimationFrame(() => {
        const mainElement = mainRef.current

        if (!mainElement) return

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const scrollingElement = document.scrollingElement ?? document.documentElement
        const scrollTop = scrollingElement.scrollTop

        /*
         * 마우스 휠을 약 두 번 내린 시점부터 main의 상단 곡선이
         * 화면 아래에 보이기 시작하도록 등장 기준을 앞당깁니다.
         * 이후 180px의 짧은 스크롤 구간 동안 원래 위치까지 올라옵니다.
         */
        const mainDocumentTop = mainElement.offsetTop
        const revealStart = Math.max(0, mainDocumentTop - window.innerHeight - 120)
        const revealDistance = 180
        const scrollProgress = Math.min(Math.max((scrollTop - revealStart) / revealDistance, 0), 1)
        const offset = prefersReducedMotion ? 0 : 180 * (1 - scrollProgress)

        mainElement.style.setProperty('--main-scroll-offset', `${offset}px`)
      })
    }

    updateMainPosition()
    window.addEventListener('scroll', updateMainPosition, { passive: true })
    window.addEventListener('resize', updateMainPosition, { passive: true })
    document.addEventListener('scroll', updateMainPosition, { passive: true, capture: true })

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('scroll', updateMainPosition)
      window.removeEventListener('resize', updateMainPosition)
      document.removeEventListener('scroll', updateMainPosition, true)
    }
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage mainRef={mainRef} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route element={<Layout />}>
            <Route path="/enjoy" element={<TravelEnjoyPage />} />
            <Route path="/enjoy/search" element={<EnjoySearchResultsPage />} />
            <Route path="/enjoy/:category/:id" element={<EnjoyDetailPage />} />
            <Route path="/enjoy/:category" element={<EnjoyCategoryPage />} />

            <Route path="/destinations" element={<DestinationsPage />} />
            <Route path="/destinations/search" element={<DestinationSearchResultsPage />} />
            <Route path="/destinations/detail/:id" element={<TravelDetailPage />} />
            <Route path="/destinations/attractions" element={<DestinationCatalogPage kind="attraction" />} />
            <Route path="/destinations/culture" element={<DestinationCatalogPage kind="culture" />} />
            <Route path="/destinations/courses" element={<DestinationCatalogPage kind="course" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

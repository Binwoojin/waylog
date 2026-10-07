import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import banner from '../../assets/enjoy/record.png'
import './HomeSections.css'

export default function TravelRecordBanner() {
  const { member } = useAuth()
  const navigate = useNavigate()

  // 피드의 글쓰기 버튼과 동일한 로그인 유도 패턴: 비로그인 상태면 로그인 화면으로, 로그인 상태면 피드로 이동합니다.
  function handleGoToRecord() {
    navigate(member ? '/feed' : '/login')
  }

  return <section className="travel-record-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(27,81,167,.94), rgba(59,130,246,.68)), url(${banner})` }}>
    <div><p>나만의 여행 이야기를 시작해 보세요</p><h2>여행의 순간을 기록하고, 함께 나눠요</h2></div><button type="button" onClick={handleGoToRecord}>여행 기록하기 <span>→</span></button>
  </section>
}

import banner from '../../assets/figma/record-banner.png'
import './HomeSections.css'

export default function TravelRecordBanner() {
  // 추후 로그인 여부에 따라 여행 기록 작성 화면 또는 로그인 화면으로 분기할 CTA입니다.
  return <section className="travel-record-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(27,81,167,.94), rgba(59,130,246,.68)), url(${banner})` }}>
    <div><p>나만의 여행 이야기를 시작해 보세요</p><h2>여행의 순간을 기록하고, 함께 나눠요</h2></div><button type="button">여행 기록하기 <span>→</span></button>
  </section>
}

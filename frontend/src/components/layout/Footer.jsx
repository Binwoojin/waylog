import { Link } from 'react-router-dom'
import logo from '../../assets/figma/logo.png'
import '../home/HomeSections.css'

// 서비스 소개, 고객지원, 정책 링크를 모든 콘텐츠 페이지 하단에 공통으로 제공합니다.
// 백엔드/라우터 연결 후 각 #앵커를 실제 공지·약관 페이지 경로로 교체할 수 있습니다.
export default function Footer() {
  return (
  <footer className="footer">
    <div className="footer__inner">
      <div className="footer__brand">
        <img src={logo} alt="WayLog" />
        <p>당신의 여행이 모두의 여행이 되다.</p>
      </div>
      <div className="footer__links">
        <div>
          <strong>서비스</strong>
          <Link to="/destinations">여행지</Link>
          <Link to="/destinations/courses">여행 코스</Link>
          {/* 여행 피드 페이지가 생기면 실제 경로로 변경합니다. */}
          <a href="#feed">여행 피드</a>
        </div>
        <div>
          <strong>고객지원</strong>
          {/* 아직 각각의 페이지가 없으므로 현재는 메인의 공지 영역으로 이동합니다. */}
          <a href="#notice">공지사항</a>
          <a href="#faq">자주 묻는 질문</a>
          <a href="#contact">문의하기</a>
        </div>
        <div>
          <strong>약관 및 정책</strong>
          {/* 약관 페이지 구현 후 /terms 등의 실제 경로로 변경합니다. */}
          <a href="#terms">이용약관</a>
          <a href="#privacy">개인정보처리방침</a>
          <a href="#location">위치기반서비스</a>
        </div>
      </div>
    </div>
    <div className="footer__bottom">
      <span>© 2026 WayLog. All rights reserved.</span>
      <span>대한민국의 좋은 여행을 연결합니다.</span>
    </div>
  </footer>
)}

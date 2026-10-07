import { Link } from 'react-router-dom'
import logo from '../../assets/figma/logo.png'
import '../home/HomeSections.css'

/*
 * 목적지가 아직 없는 푸터 항목입니다.
 * Design Ref: §3.2 — 누를 수 있는 것처럼 보이지만 반응이 없는 링크를 없애기 위해
 * 링크가 아닌 일반 텍스트로 두고 "준비 중" 표시를 붙입니다. (포커스 대상에서도 제외)
 * 페이지가 생기면 해당 항목만 <Link>로 바꿉니다.
 */
function PendingFooterItem({ children }) {
  return (
    <span className="footer__pending">
      {children}
      <small className="footer__pending-badge">준비 중</small>
    </span>
  )
}

// 서비스 소개, 고객지원, 정책 링크를 모든 콘텐츠 페이지 하단에 공통으로 제공합니다.
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
          {/* 기능 메뉴는 "준비 중" 페이지로 연결합니다. 피드가 완성되면 같은 경로를 그대로 사용합니다. */}
          <Link to="/feed">여행 피드</Link>
        </div>
        <div>
          <strong>고객지원</strong>
          <Link to="/notices">공지사항</Link>
          <PendingFooterItem>자주 묻는 질문</PendingFooterItem>
          <PendingFooterItem>문의하기</PendingFooterItem>
        </div>
        <div>
          <strong>약관 및 정책</strong>
          <PendingFooterItem>이용약관</PendingFooterItem>
          <PendingFooterItem>개인정보처리방침</PendingFooterItem>
          <PendingFooterItem>위치기반서비스</PendingFooterItem>
        </div>
      </div>
    </div>
    <div className="footer__bottom">
      <span>© 2026 WayLog. All rights reserved.</span>
      <span>대한민국의 좋은 여행을 연결합니다.</span>
    </div>
  </footer>
)}

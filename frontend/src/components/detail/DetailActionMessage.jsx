import './DetailActionMessage.css'

/**
 * 북마크·공유 결과 안내 문구(표시 컴포넌트)
 *
 * role="status"(polite live region)는 DOM에 먼저 있어야 문구 변화를 읽어 줍니다.
 * 그래서 문구가 없을 때도 요소를 그대로 두고 텍스트만 바꿉니다. 같은 높이를 미리 차지해 문구가 뜰 때 헤더가 밀리지 않습니다.
 */
export default function DetailActionMessage({ message }) {
  return <p className="detail-action-message" role="status">{message}</p>
}

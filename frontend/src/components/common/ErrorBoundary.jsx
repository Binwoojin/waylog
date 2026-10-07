import { Component } from 'react'
import { Link } from 'react-router-dom'
import '../../pages/StatusPage.css'

/**
 * 하위 컴포넌트의 렌더링 오류를 잡아 흰 화면 대신 안내 화면을 보여 주는 경계입니다.
 *
 * Design Ref: §1.2 — 새 의존성(react-error-boundary) 없이 class 컴포넌트로 직접 구현합니다.
 * 오류 경계는 아직 함수 컴포넌트 Hook으로 만들 수 없어 class가 필요합니다.
 *
 * 한계 (React 제약, Design Ref: §2.2):
 * - 잡는 오류: 렌더링, 생명주기 메서드, 하위 트리 생성자에서 던진 오류
 * - 잡지 못하는 오류: 이벤트 핸들러(onClick 등), 비동기 코드(Promise, setTimeout, fetch),
 *   경계 컴포넌트 자신의 오류
 *   → 이런 오류는 각 화면이 try/catch와 오류 상태로 직접 처리해야 합니다.
 *
 * variant
 * - 'page': Layout의 본문(Outlet)만 대체합니다. 헤더·푸터는 유지되고 "다시 시도"·"홈으로"를 제공합니다.
 * - 'app' : 최상위에서 화면 전체를 대체합니다. 라우터 상태를 신뢰할 수 없으므로
 *           전체 새로고침(<a href="/">, location.reload)으로 복구합니다.
 *
 * resetKey: 값이 바뀌면 오류 상태를 초기화합니다. (Layout에서 location.key 전달: 이동할 때마다 바뀜)
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  // Design Ref: §6 — 이동이 일어나면(resetKey 변경) 오류 화면에서 자동으로 빠져나옵니다.
  // componentDidUpdate에서 초기화하면 오류가 난 커밋 직후 한 번 더 렌더를 시도하게 되므로,
  // 렌더 전에 실행되는 getDerivedStateFromProps에서 키를 비교합니다.
  // Outlet에 key={pathname}을 주는 방식은 같은 페이지의 파라미터 이동(/enjoy/food → /enjoy/stay)에서도
  // 페이지 상태를 매번 초기화해 기존 동작을 바꾸므로 쓰지 않습니다.
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, resetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error, info) {
    // Design Ref: §7 — 오류 내용은 화면에 표시하지 않고 개발자 콘솔에만 남깁니다.
    console.error('화면을 렌더링하는 중 오류가 발생했습니다.', error, info?.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.variant === 'app') {
      return (
        <main className="status-page status-page--app">
          <section className="status-page__card" role="alert">
            <p className="status-page__eyebrow status-page__eyebrow--error">오류</p>
            <h1 className="status-page__title">일시적인 문제가 발생했습니다</h1>
            <p className="status-page__description">페이지를 새로고침하거나 홈으로 이동해 주세요.</p>
            <div className="status-page__actions">
              <button className="status-page__button status-page__button--primary" type="button" onClick={() => window.location.reload()}>새로고침</button>
              {/* 라우터가 오류 상태일 수 있으므로 Link 대신 전체 새로고침으로 이동합니다. */}
              <a className="status-page__button" href="/">홈으로</a>
            </div>
          </section>
        </main>
      )
    }

    return (
      <main className="status-page">
        <section className="status-page__card" role="alert">
          <p className="status-page__eyebrow status-page__eyebrow--error">오류</p>
          <h1 className="status-page__title">화면을 표시하는 중 문제가 발생했습니다</h1>
          <p className="status-page__description">잠시 후 다시 시도하거나 다른 메뉴로 이동해 주세요.</p>
          <div className="status-page__actions">
            <button className="status-page__button status-page__button--primary" type="button" onClick={this.handleRetry}>다시 시도</button>
            <Link className="status-page__button" to="/">홈으로</Link>
          </div>
        </section>
      </main>
    )
  }
}

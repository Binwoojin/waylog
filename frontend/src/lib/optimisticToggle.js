/**
 * 좋아요·북마크 같은 "토글형 낙관적 업데이트"의 공통 흐름을 뽑아낸 헬퍼.
 *
 * Design Ref: 코드 리뷰 후속 과제 — FeedPage(리듀서 액션 updateItem), FeedDetailPage
 * (useFeedDetail().applyLocalUpdate), FeedUserProfilePage(자체 overrides state)가 각자 다른
 * 모양으로 "낙관적 patch 적용 → 실패 시 롤백"을 구현하고 있었다. 세 화면의 데이터 원천 모양
 * (누적 배열 / 단일 객체 / 페이지+overrides)은 서로 달라 하나의 상태 구조로 합칠 수는 없지만,
 * "먼저 바꾸고, 성공하면 서버 응답으로 다시 맞추고, 실패하면 요청 전 값으로 되돌린다"는 흐름
 * 자체는 동일하다. 그래서 그 흐름만 여기로 뽑고, "patch를 실제로 어떻게 반영하는지"(apply)는
 * 호출부가 그대로 넘긴다 — updateItem(id, patch) / applyLocalUpdate(patch) / setOverride(id, patch).
 *
 * Design Ref: 코드 리뷰 후속 과제 — 같은 게시물의 좋아요/북마크 버튼에 `disabled` 처리가 없어,
 * 첫 번째 토글 응답이 오기 전에 같은 버튼을 다시 누르면 두 요청이 동시에 날아갔다. 응답이 보낸
 * 순서와 다르게 도착하면 버튼 상태가 사용자의 마지막 클릭과 잠깐 어긋났다가 되돌아오는 깜빡임이
 * 생긴다. `key`로 "게시물 id + 토글 종류"를 넘기면, 그 키의 요청이 진행 중인 동안 들어오는 새
 * 요청은 무시한다 — FeedPage/FeedDetailPage/FeedUserProfilePage 세 화면 모두 이 헬퍼를 통해서만
 * 토글하므로, 화면마다 버튼 disabled 상태를 따로 관리하지 않아도 가드가 자동으로 적용된다.
 *
 * @param {object} options
 * @param {string} [options.key] - 진행 중 요청을 식별하는 키(예: `${postId}:like`). 같은 키로
 *   이미 요청이 진행 중이면 이번 호출은 아무 것도 하지 않고 조용히 종료한다. 생략하면 가드 없이
 *   기존처럼 동작한다.
 * @param {(patch: object) => void} options.apply - patch를 실제 상태에 반영하는 함수.
 * @param {object} options.optimisticPatch - 요청을 보내기 전에 즉시 반영할 patch.
 * @param {object} options.revertPatch - 요청이 실패하면 되돌릴 patch(보통 요청 전 값 그대로).
 * @param {() => Promise<any>} options.request - 실제 API 호출.
 * @param {(result: any) => object} [options.reconcile] - 요청이 성공하면 응답으로 다시 맞출 patch를
 *   만든다. 생략하면 request의 반환값을 그대로 patch로 적용한다.
 * @param {(error: unknown) => void} [options.onError] - 실패 시 로깅 등 부수 효과. 롤백 자체는
 *   이 헬퍼가 항상 수행하므로, 호출부는 로깅만 신경 쓰면 된다.
 */
const pendingKeys = new Set()

export async function runOptimisticToggle({ key, apply, optimisticPatch, revertPatch, request, reconcile, onError }) {
  if (key != null) {
    if (pendingKeys.has(key)) return
    pendingKeys.add(key)
  }

  apply(optimisticPatch)

  try {
    const result = await request()
    apply(reconcile ? reconcile(result) : result)
  } catch (error) {
    onError?.(error)
    apply(revertPatch)
  } finally {
    if (key != null) pendingKeys.delete(key)
  }
}

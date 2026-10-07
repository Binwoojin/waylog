import { describe, expect, it, vi } from 'vitest'
import { runOptimisticToggle } from '../../lib/optimisticToggle'

// 테스트마다 키를 새로 만들어 모듈 안의 pendingKeys 상태가 케이스 사이에 새지 않게 합니다.
let seq = 0
const uniqueKey = () => `post-${++seq}:like`

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('runOptimisticToggle', () => {
  it('낙관적 patch를 먼저 적용하고, 응답으로 reconcile한 patch로 다시 맞춘다', async () => {
    const apply = vi.fn()
    const request = vi.fn().mockResolvedValue({ liked: true, likeCount: 8 })

    await runOptimisticToggle({
      key: uniqueKey(),
      apply,
      optimisticPatch: { liked: true, likeCount: 8 },
      revertPatch: { liked: false, likeCount: 7 },
      request,
      reconcile: result => ({ liked: result.liked, likeCount: result.likeCount }),
    })

    expect(request).toHaveBeenCalledTimes(1)
    expect(apply.mock.calls).toEqual([
      [{ liked: true, likeCount: 8 }],
      [{ liked: true, likeCount: 8 }],
    ])
  })

  it('reconcile이 없으면 요청 응답 자체를 patch로 적용한다', async () => {
    const apply = vi.fn()

    await runOptimisticToggle({
      key: uniqueKey(),
      apply,
      optimisticPatch: { bookmarked: true },
      revertPatch: { bookmarked: false },
      request: async () => ({ bookmarked: true, bookmarkCount: 3 }),
    })

    expect(apply).toHaveBeenLastCalledWith({ bookmarked: true, bookmarkCount: 3 })
  })

  it('요청이 실패하면 onError를 부르고 revertPatch로 되돌린 뒤 오류를 밖으로 던지지 않는다', async () => {
    const apply = vi.fn()
    const onError = vi.fn()
    const failure = new Error('network')

    await expect(runOptimisticToggle({
      key: uniqueKey(),
      apply,
      optimisticPatch: { liked: true },
      revertPatch: { liked: false },
      request: () => Promise.reject(failure),
      onError,
    })).resolves.toBeUndefined()

    expect(onError).toHaveBeenCalledWith(failure)
    expect(apply.mock.calls).toEqual([[{ liked: true }], [{ liked: false }]])
  })

  it('같은 키의 요청이 진행 중이면 두 번째 호출은 아무것도 하지 않는다', async () => {
    const key = uniqueKey()
    const pending = deferred()
    const firstApply = vi.fn()
    const secondApply = vi.fn()
    const secondRequest = vi.fn()

    const first = runOptimisticToggle({
      key,
      apply: firstApply,
      optimisticPatch: { liked: true },
      revertPatch: { liked: false },
      request: () => pending.promise,
    })

    await runOptimisticToggle({
      key,
      apply: secondApply,
      optimisticPatch: { liked: false },
      revertPatch: { liked: true },
      request: secondRequest,
    })

    expect(secondApply).not.toHaveBeenCalled()
    expect(secondRequest).not.toHaveBeenCalled()

    pending.resolve({ liked: true })
    await first
  })

  it('요청이 끝나면 키가 풀려 같은 키로 다시 토글할 수 있다(성공)', async () => {
    const key = uniqueKey()
    const request = vi.fn().mockResolvedValue({})

    await runOptimisticToggle({ key, apply: vi.fn(), optimisticPatch: {}, revertPatch: {}, request })
    await runOptimisticToggle({ key, apply: vi.fn(), optimisticPatch: {}, revertPatch: {}, request })

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('요청이 실패해도 키가 풀려 다시 토글할 수 있다', async () => {
    const key = uniqueKey()
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({})

    await runOptimisticToggle({ key, apply: vi.fn(), optimisticPatch: {}, revertPatch: {}, request, onError: vi.fn() })
    await runOptimisticToggle({ key, apply: vi.fn(), optimisticPatch: {}, revertPatch: {}, request })

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('서로 다른 키(같은 게시물의 좋아요와 북마크)는 독립적으로 동작한다', async () => {
    const postId = uniqueKey().split(':')[0]
    const pending = deferred()
    const likeRequest = vi.fn(() => pending.promise)
    const bookmarkRequest = vi.fn().mockResolvedValue({})

    const like = runOptimisticToggle({
      key: `${postId}:like`,
      apply: vi.fn(),
      optimisticPatch: {},
      revertPatch: {},
      request: likeRequest,
    })

    await runOptimisticToggle({
      key: `${postId}:bookmark`,
      apply: vi.fn(),
      optimisticPatch: {},
      revertPatch: {},
      request: bookmarkRequest,
    })

    expect(bookmarkRequest).toHaveBeenCalledTimes(1)

    pending.resolve({})
    await like
  })

  it('key를 생략하면 가드 없이 동시에 두 번 요청한다', async () => {
    const request = vi.fn(() => new Promise(() => {}))

    runOptimisticToggle({ apply: vi.fn(), optimisticPatch: {}, revertPatch: {}, request })
    runOptimisticToggle({ apply: vi.fn(), optimisticPatch: {}, revertPatch: {}, request })

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('optimistic patch 적용 자체가 던져도 키가 남지 않아 다음 토글이 막히지 않는다', async () => {
    const key = uniqueKey()
    const request = vi.fn().mockResolvedValue({})
    const brokenApply = vi.fn(() => {
      throw new Error('render failed')
    })

    await expect(runOptimisticToggle({
      key,
      apply: brokenApply,
      optimisticPatch: {},
      revertPatch: {},
      request,
    })).rejects.toThrow('render failed')

    await runOptimisticToggle({ key, apply: vi.fn(), optimisticPatch: {}, revertPatch: {}, request })

    expect(request).toHaveBeenCalledTimes(1)
  })
})

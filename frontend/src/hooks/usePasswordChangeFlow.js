import { useCallback, useEffect, useRef, useState } from 'react'
import { changeMyPassword, confirmMyEmailCode, sendMyEmailCode } from '../api/userApi'

const CODE_VALID_SECONDS = 180

/*
 * 비밀번호 변경 상태 머신 훅: idle → code-sent → verified → done
 *
 * Design Ref: mypage-bookmarks.design.md §2.2, §4.3 — 이메일 인증 코드 발송/확인/비밀번호 변경이라는
 * 기존 백엔드 3단계 체인을 화면(PasswordChangeForm)과 분리해 둔다. 폼 컴포넌트와 분리해 두면
 * 후속에 ForgotPasswordPage를 실제로 연동할 때도 이 훅을 그대로 재사용할 수 있다(설계 §2.2).
 *
 * 이미 로그인한 사용자의 email을 고정값으로 받는다 — ForgotPasswordPage처럼 임의 이메일을
 * 입력받지 않는다(본인 계정만 인증).
 *
 * stage: 'idle' | 'code-sent' | 'verified' | 'done'
 */
export function usePasswordChangeFlow(email) {
  const [stage, setStage] = useState('idle')
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const verificationTokenRef = useRef('')

  useEffect(() => {
    if (stage !== 'code-sent' || secondsLeft <= 0) return undefined

    const timerId = window.setInterval(() => {
      setSecondsLeft(current => Math.max(current - 1, 0))
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [stage, secondsLeft])

  const reset = useCallback(() => {
    setStage('idle')
    setError('')
    setSecondsLeft(0)
    verificationTokenRef.current = ''
  }, [])

  const sendCode = useCallback(async () => {
    if (!email) return
    setIsSending(true)
    setError('')

    try {
      await sendMyEmailCode(email)
      setStage('code-sent')
      setSecondsLeft(CODE_VALID_SECONDS)
    } catch (sendError) {
      setError(sendError.message || '인증번호 발송에 실패했습니다.')
    } finally {
      setIsSending(false)
    }
  }, [email])

  const verifyCode = useCallback(async authCode => {
    if (!/^\d{6}$/.test(authCode)) {
      setError('인증번호 6자리를 입력해 주세요.')
      return
    }
    if (secondsLeft <= 0) {
      setError('인증번호가 만료되었습니다. 다시 받아 주세요.')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const verificationToken = await confirmMyEmailCode(email, authCode)
      verificationTokenRef.current = verificationToken
      setStage('verified')
    } catch (verifyError) {
      setError(verifyError.message || '인증번호가 일치하지 않습니다.')
    } finally {
      setIsVerifying(false)
    }
  }, [email, secondsLeft])

  const submitPassword = useCallback(async password => {
    if (!verificationTokenRef.current) {
      setError('이메일 인증을 먼저 완료해 주세요.')
      setStage('idle')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await changeMyPassword({ email, password, verificationToken: verificationTokenRef.current })
      setStage('done')
    } catch (submitError) {
      setError(submitError.message || '비밀번호 변경에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }, [email])

  return {
    stage,
    isSending,
    isVerifying,
    isSubmitting,
    error,
    secondsLeft,
    sendCode,
    verifyCode,
    submitPassword,
    reset,
  }
}

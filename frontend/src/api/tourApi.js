import { apiClient } from './client'

/*
 * TourAPI 콘텐츠 API 모듈
 *
 * Design Ref: §9 — 화면은 상세 API URL을 직접 쓰지 않고 이 함수만 호출합니다.
 * 응답은 출처(목업/API)와 관계없이 상세 화면이 쓰는 view model(§3.1)로 바꿔 돌려줍니다.
 */

const EMPTY_ADDRESS = '주소 정보 없음'
const CONTACT_LABELS = ['문의 및 안내', '문의']

/**
 * 통합 상세 조회: GET /api/v1/tour/contents/{contentId}?contentTypeId=
 *
 * 성공: view model 반환
 * 실패: ApiError(404·400·502 등, client가 던짐) 또는 형식이 다른 응답이면 Error
 */
export async function fetchTourDetail(contentId, contentTypeId) {
  // Design Ref: §7 — contentId는 경로에 넣기 전에 인코딩하고, 쿼리는 URLSearchParams로 직렬화합니다.
  const query = new URLSearchParams({ contentTypeId: String(contentTypeId) })
  const data = await apiClient.get(`/api/v1/tour/contents/${encodeURIComponent(contentId)}?${query}`)
  return toTourDetail(data)
}

/**
 * API 응답(TourDetailResponse) → 상세 view model
 *
 * Design Ref: §1.2 fail-closed — client.js는 JSON이 아닌 200 응답을 {}로 돌려주므로,
 * 제목이 없는 응답은 성공으로 보지 않고 오류로 처리합니다(빈 상세 화면 방지).
 */
export function toTourDetail(data) {
  if (!data || typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error('상세 응답 형식이 올바르지 않습니다.')
  }

  const infos = (Array.isArray(data.detailInfos) ? data.detailInfos : [])
    .map(info => ({ label: toPlainText(info?.label), value: toPlainText(info?.value) }))
    // Design Ref: §3.2 규칙 5 — 정리 후 값이 비는 항목은 표시하지 않습니다.
    .filter(info => info.label && info.value)

  const contactInfo = infos.find(info => CONTACT_LABELS.includes(info.label))

  return {
    source: 'api',
    id: String(data.contentId ?? ''),
    title: data.title.trim(),
    image: typeof data.image === 'string' && data.image.trim() ? data.image : null,
    address: typeof data.address === 'string' && data.address.trim() ? data.address.trim() : EMPTY_ADDRESS,
    typeLabel: typeof data.contentTypeName === 'string' ? data.contentTypeName : '',
    description: toPlainText(data.overview),
    infos,
    contact: contactInfo ? contactInfo.value : null,
  }
}

/**
 * TourAPI 텍스트의 HTML을 줄바꿈이 있는 순수 텍스트로 바꿉니다.
 *
 * Design Ref: §3.2 — overview·detailInfos에는 <br>, &nbsp; 등이 섞여 옵니다.
 * DOMParser로 만든 문서는 스크립트를 실행하지 않고 이미지도 불러오지 않으므로
 * 태그 제거·엔티티 복원에 안전하게 쓸 수 있습니다. 결과는 텍스트로만 렌더링합니다(dangerouslySetInnerHTML 미사용).
 */
export function toPlainText(value) {
  if (value == null) return ''

  // <br> 바로 뒤에 원문 개행이 이어지면(<br>\n) 줄바꿈이 두 번 생기므로 뒤따르는 개행까지 함께 치환합니다.
  const withLineBreaks = String(value).replace(/<br\s*\/?>[ \t]*(?:\r?\n)?/gi, '\n')
  const text = new DOMParser().parseFromString(withLineBreaks, 'text/html').body.textContent ?? ''

  return text
    // &nbsp;는 DOMParser가 U+00A0으로 복원하므로 일반 공백으로 바꿉니다.
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/*
 * 전화번호 패턴: 한국 전화번호 형태만 번호로 인정합니다.
 * - 0으로 시작하는 지역번호·휴대폰·050x 번호. 지역번호 괄호 허용: "(064)710-7912", "02)2133-5555"
 * - 국제 형식 +82. 지역번호 앞 0은 생략 가능: "+82-2-1234-5678"
 * - 15xx ~ 19xx 대표번호: "1588-1234"
 * 구분자는 하이픈·점만 허용하고, 공백은 지역번호 뒤에서만 허용합니다.
 * 공백·괄호를 번호 안쪽 문자로 허용하면 "02-123-4567 (2)"의 뒤 숫자까지 한 번호로 합쳐지기 때문입니다.
 * 앞뒤에 숫자가 붙어 있으면 번호의 일부만 잡은 것이므로 매치하지 않습니다(lookbehind/lookahead).
 */
const PHONE_NUMBER_PATTERN = /(?<!\d)(?:(?:\+82[-. ]?\(?0?\d{1,3}\)?|\(?0\d{1,3}\)?)[-. ]?\d{3,4}[-.]?\d{4}|1[5-9]\d{2}[-.]?\d{4})(?!\d)/g
// 번호 밖에 이만큼 이어진 숫자가 남아 있으면 인식하지 못한 다른 번호일 수 있습니다("1330 1588-1234").
// "09:00~18:00"의 시각, "내선 23"은 2자리라 해당하지 않습니다.
const LEFTOVER_NUMBER_PATTERN = /\d{4,}/
const PHONE_MIN_DIGITS = 7
const PHONE_MAX_DIGITS = 12

/**
 * 문의처 문자열 → tel: 링크. 전화번호 하나로 확정할 수 없으면 null(텍스트로만 표시)
 *
 * Design Ref: §3.2 연락처 링크, §7 — 외부 문자열을 href에 그대로 넣지 않고,
 * 번호가 여러 개인 문의처를 이어 붙여 엉뚱한 번호로 전화 거는 일을 막습니다.
 * 잘못된 번호로 전화가 걸리는 것보다 링크가 없는 편이 안전하므로, 확신할 수 없으면 null입니다.
 * 1. 한국 전화번호 형태(PHONE_NUMBER_PATTERN)가 정확히 1개가 아니면 null
 * 2. 번호를 뺀 나머지에 4자리 이상 숫자가 남아 있으면 null (다른 번호일 수 있음)
 * 3. "02-3700-3900~1"처럼 ~로 이어진 범위 번호면 null
 * 4. 숫자가 7~12자리가 아니면 null (국가번호 +는 유지)
 * 두 상세 화면이 함께 씁니다.
 */
export function toTelHref(contact) {
  if (typeof contact !== 'string') return null

  const numbers = [...contact.matchAll(PHONE_NUMBER_PATTERN)]
  if (numbers.length !== 1) return null

  const [match] = numbers
  const before = contact.slice(0, match.index)
  const after = contact.slice(match.index + match[0].length)
  if (LEFTOVER_NUMBER_PATTERN.test(before) || LEFTOVER_NUMBER_PATTERN.test(after)) return null
  if (/~\s*$/.test(before) || /^\s*~/.test(after)) return null

  const digits = match[0].replace(/\D/g, '')
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) return null

  return `tel:${match[0].startsWith('+') ? '+' : ''}${digits}`
}

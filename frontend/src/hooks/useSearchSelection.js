import { useReducer } from 'react'

/*
 * 검색 모달 선택 상태 reducer
 *
 * Design Ref: §3.5 — 지역을 바꾸면 시군구를, 유형을 바꾸면 세부 항목을 지우는 규칙을
 * 한 곳에 모아 여행지 모달과 즐기기 모달이 공유합니다. 기존 SearchModal의
 * `setRegion(item); setDistrict('')` 동작과 같습니다.
 *
 * selection: { region: string, district: string, type: string, detail: string, keyword: string } ('' = 선택 안 함)
 *
 * keyword (tour-course-list-integration §9.1)
 * 여행코스 유형은 지역·세부 항목 대신 키워드 검색 하나로 동작합니다(D-4). 기존 필드에
 * 하나만 추가하는 상위 호환 확장이라 EnjoySearchModal은 이 필드를 몰라도 동작이 바뀌지 않습니다.
 */

const EMPTY_SELECTION = { region: '', district: '', type: '', detail: '', keyword: '' }

// 순수 함수로 export합니다(테스트 가능하게, §3.5).
export function searchSelectionReducer(state, action) {
  switch (action.type) {
    case 'selectRegion':
      return { ...state, region: action.value, district: '' }
    case 'selectDistrict':
      return { ...state, district: action.value }
    case 'selectType':
      return { ...state, type: action.value, detail: '' }
    case 'selectDetail':
      return { ...state, detail: action.value }
    case 'selectKeyword':
      return { ...state, keyword: action.value }
    case 'reset':
      return EMPTY_SELECTION
    default:
      return state
  }
}

function initSelection(initialSelection) {
  return { ...EMPTY_SELECTION, ...initialSelection }
}

/**
 * @param initialSelection 모달이 열릴 때(마운트 시) 채울 초기 선택값. 이후 렌더에서는 무시합니다.
 * @returns [selection, actions] — actions.selectRegion(value) 등
 */
export function useSearchSelection(initialSelection) {
  const [selection, dispatch] = useReducer(searchSelectionReducer, initialSelection, initSelection)

  const actions = {
    selectRegion: value => dispatch({ type: 'selectRegion', value }),
    selectDistrict: value => dispatch({ type: 'selectDistrict', value }),
    selectType: value => dispatch({ type: 'selectType', value }),
    selectDetail: value => dispatch({ type: 'selectDetail', value }),
    selectKeyword: value => dispatch({ type: 'selectKeyword', value }),
    reset: () => dispatch({ type: 'reset' }),
  }

  return [selection, actions]
}

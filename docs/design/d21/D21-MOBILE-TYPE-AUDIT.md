# D21 — 모바일 폰트·가시성 감사

대상: `umph112/matchpost@50a938f32939` · 11px 미만 텍스트 **113곳** 전수 검색 결과

---

# 0. 기준 — 「배지」와 「문장」을 다르게 본다

113곳 대부분은 **배지·라벨**이고 프로토타입 규격(9.5–10.5px / 700–800)과 일치합니다.
크기만으로 판정하면 정상까지 다 건드리게 됩니다. 기준은 이렇습니다:

| 종류 | 최소 | 예 |
| --- | --- | --- |
| **배지 · 카운트 · 단위** | 9.5px / 700 | 「협업」 「미응답」 「3」 「M」 |
| **메타데이터** (시각 · 진행 N/M) | 10px | 「오후 3:20」 「3/8」 |
| **읽어야 하는 문장** | **11.5px** | 안내문 · 설명 · 사유 |
| **누를 수 있는 것** | **12px + 최소 높이 44px** | 링크 · 버튼 |

⚠️ **문장을 배지 크기로 쓰지 마세요.** 한 번 읽고 넘기는 것과 눈으로 훑는 것은 다릅니다.

---

# 1. 고칠 것 — 문장이 배지 크기인 곳

## 1-1. 말풍선 안내 문구 (D17 에서 제가 10px 로 지시한 것 — 제 오류)

```
src/components/messages/MessageBubble.tsx:124   「다른 참여자에게는 가지 않았어요」
src/components/messages/MessageBubble.tsx:132   「참여자 모두에게 같은 내용이 갔어요」
```

`text-[10px] text-[#93A3B8]` → **`text-[11.5px] text-[#7C7C88]`**

문장이고, 모바일에서 읽어야 하는 내용입니다. 색도 `#93A3B8` 는 흰 배경에서 대비가
약합니다(3.1:1). `#7C7C88` 로 올리면 4.6:1 이 됩니다.

⚠️ 배지 옆 한 줄로 붙어 있어 길어지면 줄바꿈됩니다. **배지 아래 줄로 내리세요** —
`flex-wrap` 대신 배지 줄 다음에 별도 `<p>` 로.

## 1-2. 대비가 낮은 설명문

```
src/components/BlogAnalyticsCard.tsx:230, 247, 264, 324, 364   text-[10.5px] text-[#C4C4CE]
```

`#C4C4CE` 는 흰 배경에서 **2.1:1** 입니다 — 정상 시력에서도 흐릿합니다.
`364` 는 「상세 분석 보기 →」로 **누르는 것**입니다.

- 설명문 → `text-[11.5px] text-[#9A9AA5]`
- `364` 링크 → `text-[12px] text-[#B45309]` + `min-h-[44px]` (모바일)

## 1-3. 딜시트 안의 누를 수 있는 것들

```
src/components/DealSheet.tsx:522, 658, 683, 693, 701, 715
```

전부 `text-[10px]` 인데 **링크·버튼**입니다 — 「평가하기」 「친구등록 제안」 「취소 요청」 등.

DealSheet 은 PC 전용 안내가 붙은 화면이라 PC 에서는 그대로 둬도 됩니다.
다만 **모바일에서 이 표가 카드로 바뀔 때** 12px + 44px 로 올라가야 합니다.

```
text-[10px] [.adv-mobile_&]:text-[12px] [.adv-mobile_&]:min-h-[44px]
```

모바일 카드 변환이 아직이면 **이번엔 손대지 말고** 그때 함께 하세요.

## 1-4. 9px — 두 곳만

```
src/components/messages/MessageBubble.tsx:104   아바타 이니셜 (20px 원 안)
src/components/MatchScore.tsx:63                「M」 단위
src/components/InfluencerShell.tsx:121          탭 배지 숫자 (15px 원 안)
src/components/BlogAnalyticsCard.tsx:160        순위 배지
```

앞 셋은 **작은 원 안의 한 글자**라 9px 이 맞습니다. 키우면 원을 벗어납니다.
`BlogAnalyticsCard:160` 만 확인해 주세요 — 원 안이 아니면 9.5px 로.

---

# 2. 손대지 말 것 (확인 완료 · 정상)

| 종류 | 위치 | 이유 |
| --- | --- | --- |
| 배지 9.5–10.5px | `connections:127,129` · `search:377,766` · `workload:148` · `SettlementsView:240,396` · `ConversationRow:72,79,81` 등 | 프로토타입 규격 그대로 |
| 요약칸 부제 10.5px | `earnings:430,435,440,445` | 부제이고 `#9A9AA5` 로 대비 확보 |
| 사이드바 그룹 라벨 10px | `AdvertiserShell:173` · `InfluencerShell:143` | 프로토타입 값 |
| 말풍선 시각 10px | `MessageBubble:160` | 메타데이터 |
| 진행 카운터 10px | `DealSheet:532,533` | 「3/8」 「38%」 — 숫자 |
| 푸터 저작권 10.5px | `Footer:71` | 법정 고지의 관행 |
| 달력 칸 라벨 9.5–10px | `CampaignCalendar:113,114` · `HomeCalendar:91,96` | 칸이 작아 그 이상 안 들어감 |

---

# 3. 확인

```bash
# 문장이 10px 이하로 남아 있는지 — 배지가 아닌 것
grep -rn "text-\[10px\]\|text-\[10.5px\]" src/components/messages/MessageBubble.tsx
grep -rn "#C4C4CE" src/components/BlogAnalyticsCard.tsx    # 0 이어야 함
```

브라우저 (모바일 폭 390px):
- [ ] 대시 말풍선의 「참여자 모두에게…」가 배지 **아래 줄**에 11.5px 로
- [ ] 내 채널 분석의 설명문이 흐릿하지 않음
- [ ] 「상세 분석 보기 →」를 손가락으로 누를 수 있음 (44px)
- [ ] 아바타 이니셜·탭 숫자가 원 안에 그대로 들어감

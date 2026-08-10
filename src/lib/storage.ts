// D6 F3 — 대시 첨부파일(chat-files 버킷)은 업로드일로부터 7일 뒤 자동 삭제.
// 캠페인 가이드 파일(campaign-guides)은 캠페인이 진행되는 동안 계속 필요하므로 대상이 아니다.
export const ATTACHMENT_TTL_DAYS = 7

export function attachmentExpiresAt(createdAt: string): Date {
  const d = new Date(createdAt)
  d.setDate(d.getDate() + ATTACHMENT_TTL_DAYS)
  return d
}

export function attachmentDaysLeft(createdAt: string): number {
  const ms = attachmentExpiresAt(createdAt).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function isAttachmentExpired(createdAt: string): boolean {
  return attachmentExpiresAt(createdAt).getTime() <= Date.now()
}

// public URL(".../object/public/chat-files/chat/xxx.jpg")에서 버킷 하위 경로만 뽑아낸다.
export function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marker.length))
}

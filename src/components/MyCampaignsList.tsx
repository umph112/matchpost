'use client'

import { useState } from 'react'
import Link from 'next/link'

type Campaign = {
  id: string
  title: string
  date: string
  location_city: string | null
  location_district: string | null
  derivedStatus: '진행중' | '마감' | '캔슬' | '완료'
  stats: { total: number; confirmed: number; negotiating: number }
}

const STATUS_STYLE: Record<string, string> = {
  진행중: 'bg-amber-100 text-amber-700',
  완료: 'bg-green-100 text-green-600',
  마감: 'bg-gray-100 text-gray-500',
  캔슬: 'bg-red-100 text-red-500',
}

// 진행중 = '진행중' / 종료 = 마감·완료·캔슬
const isOngoing = (s: string) => s === '진행중'

export default function MyCampaignsList({ campaigns }: { campaigns: Campaign[] }) {
  const [tab, setTab] = useState<'ongoing' | 'ended'>('ongoing')

  const ongoing = campaigns.filter((c) => isOngoing(c.derivedStatus))
  const ended = campaigns.filter((c) => !isOngoing(c.derivedStatus))
  const list = tab === 'ongoing' ? ongoing : ended

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTab('ongoing')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            tab === 'ongoing' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          진행중 {ongoing.length}
        </button>
        <button
          onClick={() => setTab('ended')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            tab === 'ended' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          종료 {ended.length}
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm">
          {tab === 'ongoing' ? '진행중인 캠페인이 없어요.' : '종료된 캠페인이 없어요.'}
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-amber-400">
              <Link href={`/advertiser/campaigns/${c.id}`} className="block hover:opacity-70 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      📅 {c.date}　📍 {c.location_city} {c.location_district}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[c.derivedStatus]}`}>
                    {c.derivedStatus}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-gray-600">👥 참여 {c.stats.total}</span>
                  <span className="text-green-600">확정 {c.stats.confirmed}</span>
                  <span className="text-amber-600">협의중 {c.stats.negotiating}</span>
                </div>
              </Link>
              <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-50">
                <Link href={`/advertiser/campaigns/${c.id}`} className="text-xs text-amber-600 font-medium">
                  딜시트 →
                </Link>
                <Link
                  href={`/advertiser/campaigns/new?copy=${c.id}`}
                  className="ml-auto text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
                >
                  📋 복사 재등록
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

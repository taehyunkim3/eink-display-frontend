"use client";

import { useState } from "react";
import {
  SCREEN_PAGE_COUNT,
  SCREEN_PAGE_TITLES,
  ScreenView
} from "@/components/screen-view";
import type { DashboardData, DeviceStatus } from "@/lib/types";

type PreviewScreenProps = {
  data: DashboardData;
  deviceStatus: DeviceStatus;
};

function wrapPage(page: number) {
  return ((page % SCREEN_PAGE_COUNT) + SCREEN_PAGE_COUNT) % SCREEN_PAGE_COUNT;
}

export function PreviewScreen({ data, deviceStatus }: PreviewScreenProps) {
  const [page, setPage] = useState(() => wrapPage(deviceStatus.page));
  const previewStatus = { ...deviceStatus, page };

  return (
    <div className="flex flex-col gap-3">
      <section className="eink-frame" aria-label="800 x 480 device preview">
        <ScreenView data={data} deviceStatus={previewStatus} />
      </section>

      <div className="flex flex-wrap items-center gap-2" aria-label="Preview page controls">
        <button
          type="button"
          onClick={() => setPage((current) => wrapPage(current - 1))}
          className="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-bold"
          aria-label="이전 페이지"
        >
          이전
        </button>
        <button
          type="button"
          onClick={() => setPage((current) => wrapPage(current + 1))}
          className="border-2 border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
          aria-label="다음 페이지"
        >
          다음
        </button>

        <div className="flex flex-wrap gap-2 pl-0 md:pl-2">
          {SCREEN_PAGE_TITLES.map((title, index) => {
            const selected = index === page;

            return (
              <button
                key={title}
                type="button"
                onClick={() => setPage(index)}
                className={`border-2 border-neutral-900 px-3 py-2 text-sm font-bold ${
                  selected ? "bg-neutral-900 text-white" : "bg-white text-neutral-900"
                }`}
                aria-pressed={selected}
              >
                {index + 1}. {title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

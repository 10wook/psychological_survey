"use client";

import { Field, Select } from "@/components/ui";

// 생년월일 드롭다운 (이슈 #32).
// - 년: 1900 ~ 올해 (최근 년도가 위)
// - 월: 1~12
// - 일: 선택한 년·월에 따른 실제 일수(28~31)만 노출
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1900 + 1 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 해당 년·월의 마지막 일. 월 미선택 시 31. 년 미선택 시 윤년으로 취급해 2월 29일 허용. */
export function daysInMonth(year: number | null, month: number | null): number {
  if (!month) return 31;
  // Date(year, month, 0) = 해당 월 마지막 날. 년 미선택이면 윤년(2000) 기준.
  return new Date(year ?? 2000, month, 0).getDate();
}

export interface BirthdateValue {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
}

export function BirthdateFields({
  value,
  onChange,
  idPrefix = "birth",
}: {
  value: BirthdateValue;
  onChange: (patch: Partial<BirthdateValue>) => void;
  idPrefix?: string;
}) {
  const year = value.birthYear ? Number(value.birthYear) : null;
  const month = value.birthMonth ? Number(value.birthMonth) : null;
  const maxDay = daysInMonth(year, month);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  /** 년·월 변경으로 선택한 일이 범위를 벗어나면 일을 초기화한다. */
  function patchWithDayClamp(patch: Partial<BirthdateValue>) {
    const nextYear = patch.birthYear !== undefined ? Number(patch.birthYear) || null : year;
    const nextMonth = patch.birthMonth !== undefined ? Number(patch.birthMonth) || null : month;
    const day = value.birthDay ? Number(value.birthDay) : null;
    if (day && day > daysInMonth(nextYear, nextMonth)) {
      onChange({ ...patch, birthDay: "" });
      return;
    }
    onChange(patch);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Field label="출생년" htmlFor={`${idPrefix}-year`} required>
        <Select
          id={`${idPrefix}-year`}
          value={value.birthYear}
          onChange={(e) => patchWithDayClamp({ birthYear: e.target.value })}
          required
        >
          <option value="" disabled>
            년도
          </option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="월" htmlFor={`${idPrefix}-month`} required>
        <Select
          id={`${idPrefix}-month`}
          value={value.birthMonth}
          onChange={(e) => patchWithDayClamp({ birthMonth: e.target.value })}
          required
        >
          <option value="" disabled>
            월
          </option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </Select>
      </Field>
      <Field label="일" htmlFor={`${idPrefix}-day`} required>
        <Select
          id={`${idPrefix}-day`}
          value={value.birthDay}
          onChange={(e) => onChange({ birthDay: e.target.value })}
          required
        >
          <option value="" disabled>
            일
          </option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}일
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

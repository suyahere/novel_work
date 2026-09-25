"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type WorkRecord = {
  id: number;
  date: string;
  amount: number;
};

export default function Home() {

  useEffect(() => {
    const testSupabase = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*");

      console.log("Supabase data:", data);
      console.log("Supabase error:", error);
    };

    testSupabase();
  }, []);

  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [todayAmount, setTodayAmount] = useState("");

  const hasTodayRecord = (user: string) => {
    const userRecords = getUserRecords(
      user,
      currentMonthKey
    );

    const todayString = `${currentMonth}월 ${currentDay}일`;

    return userRecords.some(
      (record) => record.date === todayString
    );
  };

  const [users, setUsers] = useState<string[]>([]);
  const [allUserRecords, setAllUserRecords] = useState<
    Record<string, WorkRecord[]>
  >({});
  const [userId, setUserId] = useState<string | null>(null);

  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingAmount, setEditingAmount] = useState("");

  const [showAllRecords, setShowAllRecords] = useState(false);

  // 현재 날짜
  const now = new Date();

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(
    2,
    "0"
  )}`;

  const currentMonthLabel = `${currentYear}년 ${currentMonth}월`;

  // 현재 보고 있는 달
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  // 저장된 월 목록
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // 월 키를 화면에 표시할 이름으로 변환
  const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");

  return `${year}년 ${Number(month)}월`;
  };

  const getMonthTabLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");

  return `${year.slice(2)}-${month}`;
  };

   // 로그인한 사용자의 월 목록과 현재 달 기록 불러오기
  useEffect(() => {
    if (!isLoggedIn || !nickname || !userId) return;

    const loadRecords = async () => {
      setSelectedMonth(currentMonthKey);
      setRecordsLoaded(false);

      const { data, error } = await supabase
        .from("work_records")
        .select("id, date, amount")
        .eq("user_id", userId)
        .eq("year_month", currentMonthKey)
        .order("date", { ascending: false });

      const { data: monthRows, error: monthError } = await supabase
        .from("work_records")
        .select("year_month")
        .eq("user_id", userId);

      if (!monthError) {
        const months = Array.from(
          new Set((monthRows ?? []).map((row) => row.year_month))
        );

        if (!months.includes(currentMonthKey)) {
          months.push(currentMonthKey);
        }

        months.sort((a, b) => b.localeCompare(a));

        setAvailableMonths(months);
      }

      if (error) {
        console.error("기록 불러오기 실패:", error);
        setRecords([]);
        setRecordsLoaded(true);
        return;
      }

      setRecords(data ?? []);
      setRecordsLoaded(true);
    };

    loadRecords();
  }, [isLoggedIn, nickname, userId]);

  useEffect(() => {
    if (!isLoggedIn || !showAllRecords) return;

    const loadAllRecords = async () => {
      const { data: userRows, error: userError } = await supabase
        .from("users")
        .select("id, nickname")
        .order("nickname", { ascending: true });

      if (userError) {
        console.error("전체 사용자 불러오기 실패:", userError);
        return;
      }

      const { data: recordRows, error: recordError } = await supabase
        .from("work_records")
        .select("id, user_id, date, amount")
        .eq("year_month", currentMonthKey);

      if (recordError) {
        console.error("전체 기록 불러오기 실패:", recordError);
        return;
      }

      const recordMap: Record<string, WorkRecord[]> = {};

      for (const user of userRows ?? []) {
        recordMap[user.nickname] = [];
      }

      for (const record of recordRows ?? []) {
        const user = (userRows ?? []).find(
          (item) => item.id === record.user_id
        );

        if (!user) continue;

        recordMap[user.nickname].push({
          id: record.id,
          date: record.date,
          amount: record.amount,
        });
      }

      setUsers((userRows ?? []).map((user) => user.nickname));
      setAllUserRecords(recordMap);
    };

    loadAllRecords();
  }, [isLoggedIn, showAllRecords, currentMonthKey]);

  useEffect(() => {
    const savedUserId = localStorage.getItem("our-work-user-id");

    if (!savedUserId) return;

    const restoreLogin = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, nickname")
        .eq("id", savedUserId)
        .maybeSingle();

      if (error || !data) {
        localStorage.removeItem("our-work-user-id");
        return;
      }

      setUserId(data.id);
      setNickname(data.nickname);
      setIsLoggedIn(true);
      setRecordsLoaded(false);
    };

    restoreLogin();
  }, []);

  // 월을 선택했을 때 해당 월 기록 불러오기
  const handleMonthChange = async (monthKey: string) => {
    if (!userId) return;

    setSelectedMonth(monthKey);
    setEditingId(null);
    setEditingAmount("");
    setRecordsLoaded(false);

    const { data, error } = await supabase
      .from("work_records")
      .select("id, date, amount")
      .eq("user_id", userId)
      .eq("year_month", monthKey)
      .order("date", { ascending: false });

    if (error) {
      console.error("월별 기록 불러오기 실패:", error);
      setRecords([]);
    } else {
      setRecords(data ?? []);
    }

    setRecordsLoaded(true);
  };
  // 로그인
  const handleLogin = async () => {
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname || pin.length !== 4) {
      alert("닉네임과 4자리 PIN을 입력해주세요.");
      return;
    }

    const { data: existingUser, error: findError } =
      await supabase
        .from("users")
        .select("id, nickname, pin")
        .eq("nickname", trimmedNickname)
        .maybeSingle();

    if (findError) {
      console.error(findError);
      alert("로그인 중 오류가 발생했습니다.");
      return;
    }

    // 처음 사용하는 사용자
    if (!existingUser) {
      const { data: newUser, error: insertError } =
        await supabase
          .from("users")
          .insert({
            nickname: trimmedNickname,
            pin: pin,
          })
          .select("id, nickname")
          .single();

      if (insertError) {
        console.error(insertError);
        alert("사용자 등록 중 오류가 발생했습니다.");
        return;
      }

      setUsers((prev) => {
        if (prev.includes(trimmedNickname)) {
          return prev;
        }

        return [...prev, trimmedNickname];
      });

      localStorage.setItem("our-work-user-id", newUser.id);
      setUserId(newUser.id);
      setNickname(newUser.nickname);
      setRecordsLoaded(false);
      setIsLoggedIn(true);

      return;
    }

    // 기존 사용자 PIN 확인
    if (existingUser.pin !== pin) {
      alert("PIN이 올바르지 않습니다.");
      return;
    }

    localStorage.setItem("our-work-user-id", existingUser.id);
    setUserId(existingUser.id);
    setNickname(existingUser.nickname);
    setRecordsLoaded(false);
    setIsLoggedIn(true);
  };

  // 오늘 작업량 기록
  const handleRecord = async () => {
    const amount = Number(todayAmount);

    if (
      todayAmount.trim() === "" ||
      isNaN(amount) ||
      amount < 0
    ) {
      alert("작업량을 올바르게 입력해주세요.");
      return;
    }

    if (!userId) {
      alert("로그인 정보가 없습니다.");
      return;
    }

    const todayString = `${currentMonth}월 ${currentDay}일`;

    const existingRecord = records.find(
      (record) => record.date === todayString
    );

    if (existingRecord) {
      alert(
        "이미 오늘의 작업량 입력이 완료되었습니다.\n목록에서 수정해주세요."
      );
      return;
    }

    const { data: newRecord, error } = await supabase
      .from("work_records")
      .insert({
        user_id: userId,
        year_month: currentMonthKey,
        date: todayString,
        amount,
      })
      .select("id, date, amount")
      .single();

    if (error) {
      console.error("작업량 저장 실패:", error);
      alert("작업량 저장 중 오류가 발생했습니다.");
      return;
    }

    setRecords((prev) => [
      newRecord,
      ...prev,
    ]);

    if (!availableMonths.includes(currentMonthKey)) {
      const updatedMonths = [
        currentMonthKey,
        ...availableMonths,
      ].sort((a, b) => b.localeCompare(a));

      setAvailableMonths(updatedMonths);
    }

    if (selectedMonth !== currentMonthKey) {
      setSelectedMonth(currentMonthKey);
    }

    setTodayAmount("");

    alert("오늘의 작업량이 기록되었습니다.");
  };

  // 수정 시작
  const startEditing = (record: WorkRecord) => {
    setEditingId(record.id);
    setEditingAmount(String(record.amount));
  };

  // 수정 저장
  const saveEdit = async (id: number) => {
    const amount = Number(editingAmount);

    if (
      editingAmount.trim() === "" ||
      isNaN(amount) ||
      amount < 0
    ) {
      alert("작업량을 올바르게 입력해주세요.");
      return;
    }

    const { data: updatedRecord, error } = await supabase
      .from("work_records")
      .update({
        amount,
      })
      .eq("id", id)
      .select("id, date, amount")
      .single();

    if (error) {
      console.error("작업량 수정 실패:", error);
      alert("작업량 수정 중 오류가 발생했습니다.");
      return;
    }

    setRecords((prev) =>
      prev.map((record) =>
        record.id === id
          ? updatedRecord
          : record
      )
    );

    setEditingId(null);
    setEditingAmount("");
  };

  // 로그아웃
  const handleLogout = () => {
    setIsLoggedIn(false);
    setRecordsLoaded(false);
    setRecords([]);
    setNickname("");
    setPin("");
    setUserId(null);
    localStorage.removeItem("our-work-user-id");
    setShowAllRecords(false);
    setSelectedMonth(currentMonthKey);
    setAvailableMonths([]);
  };

  // 특정 사용자의 특정 월 기록
  const getUserRecords = (
    user: string,
    monthKey: string
  ): WorkRecord[] => {
    if (monthKey !== currentMonthKey) return [];

    return allUserRecords[user] ?? [];
  };

  // 오늘 작업량
  const getTodayAmount = (user: string) => {
    const userRecords = getUserRecords(
      user,
      currentMonthKey
    );

    const todayString = `${currentMonth}월 ${currentDay}일`;

    const todayRecord = userRecords.find(
      (record) => record.date === todayString
    );

    return todayRecord?.amount ?? 0;
  };

  // 특정 월 누적 작업량
  const getMonthlyAmount = (
    user: string,
    monthKey: string
  ) => {
    const userRecords = getUserRecords(
      user,
      monthKey
    );

    return userRecords.reduce(
      (total, record) => total + record.amount,
      0
    );
  };

  const hasMonthlyRecord = (
    user: string,
    monthKey: string
  ) => {
    const userRecords = getUserRecords(
      user,
      monthKey
    );

    return userRecords.length > 0;
  };

  // 현재 보고 있는 달의 총량
  const monthlyTotal = records.reduce(
    (total, record) => total + record.amount,
    0
  );

  // 현재 보고 있는 달의 날짜 수
  const getDaysInMonth = (monthKey: string) => {
    const [year, month] = monthKey
      .split("-")
      .map(Number);

    return new Date(year, month, 0).getDate();
  };

  const selectedDaysInMonth =
    getDaysInMonth(selectedMonth);

  const [selectedYear, selectedMonthNumber] =
    selectedMonth.split("-").map(Number);

  const isCurrentMonth =
    selectedMonth === currentMonthKey;

  // 해당 월의 날짜 문자열
  const getDateString = (day: number) => {
    return `${selectedMonthNumber}월 ${day}일`;
  };

  // 로그인 화면
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] px-5 py-8 text-[#484558]">
        <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-sm items-center justify-center">
          <div className="mx-auto w-full max-w-sm md:max-w-md">

            <div className="mb-9 text-center">
              <div className="mb-3 text-4xl">
                🌿
              </div>

              <h1 className="text-3xl font-bold tracking-[0.08em]">
                OUR WORK
              </h1>

              <p className="mt-3 text-sm text-[#77738B]">
                함께 기록하는 우리의 작업량
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  닉네임
                </label>

                <input
                  type="text"
                  value={nickname}
                  onChange={(e) =>
                    setNickname(e.target.value)
                  }
                  placeholder="닉네임을 입력해주세요"
                  className="w-full rounded-2xl border border-[#D1CFE6] bg-[#F8F7F4] px-4 py-4 text-base outline-none transition focus:border-[#9F9BCF] focus:ring-2 focus:ring-[#E8E6F2]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  PIN
                </label>

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) =>
                    setPin(
                      e.target.value.replace(/\D/g, "")
                    )
                  }
                  placeholder="숫자 4자리"
                  className="w-full rounded-2xl border border-[#D1CFE6] bg-[#F8F7F4] px-4 py-4 text-base tracking-[0.3em] outline-none transition focus:border-[#9F9BCF] focus:ring-2 focus:ring-[#E8E6F2]"
                />
              </div>

              <button
                onClick={handleLogin}
                className="mt-3 w-full rounded-2xl bg-[#9F9BCF] py-4 text-base font-bold text-white shadow-sm transition active:scale-[0.98]"
              >
                로그인
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // 전체 기록 화면
  if (showAllRecords) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] px-5 py-6 text-[#484558]">
        <div className="mx-auto w-full max-w-sm md:max-w-md">

          <div className="mb-7 flex items-center justify-between">
            <button
              onClick={() =>
                setShowAllRecords(false)
              }
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm"
            >
              ←
            </button>

            <h1 className="text-xl font-bold">
              전체 기록
            </h1>

            <div className="w-10" />
          </div>

          {/* 오늘의 기록 */}
          <section className="mb-5 rounded-[24px] bg-white p-5 shadow-[0_6px_25px_rgba(72,69,88,0.06)]">
            <div className="mb-4">
              <p className="text-xs font-semibold tracking-wider text-[#9F9BCF]">
                TODAY
              </p>

              <h2 className="mt-1 text-lg font-bold">
                오늘의 작업량
              </h2>
            </div>

            <div className="space-y-2">
              {users
                .map((user) => ({
                  name: user,
                  amount: getTodayAmount(user),
                  hasRecord: hasTodayRecord(user),
                }))
                .sort((a, b) => {
                  // 기록한 사람을 먼저
                  if (a.hasRecord && !b.hasRecord) return -1;
                  if (!a.hasRecord && b.hasRecord) return 1;

                  // 둘 다 미기록이면 가나다순
                  if (!a.hasRecord && !b.hasRecord) {
                    return a.name.localeCompare(b.name, "ko");
                  }

                  // 둘 다 기록했으면
                  // 1자 이상은 작업량 높은 순
                  // 0자는 가나다순
                  if (a.amount > 0 && b.amount > 0) {
                    return b.amount - a.amount;
                  }

                  if (a.amount > 0 && b.amount === 0) {
                    return -1;
                  }

                  if (a.amount === 0 && b.amount > 0) {
                    return 1;
                  }

                  // 둘 다 0자면 가나다순
                  return a.name.localeCompare(b.name, "ko");
                })
                .map((person) => (
                  <div
                    key={person.name}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                      person.hasRecord
                        ? "bg-[#F8F7F4]"
                        : "bg-[#F8F7F4]"
                    }`}
                  >
                    <span
                      className={
                        person.hasRecord
                          ? "font-medium"
                          : "font-medium text-[#A9A7B2]"
                      }
                    >
                      {person.name}
                    </span>

                    {person.hasRecord && (
                      <span className="font-bold">
                        {person.amount}자
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </section>

          {/* 이번 달 기록 */}
          <section className="rounded-[24px] bg-white p-5 shadow-[0_6px_25px_rgba(72,69,88,0.06)]">
            <div className="mb-4">
              <p className="text-xs font-semibold tracking-wider text-[#9F9BCF]">
                THIS MONTH
              </p>

              <h2 className="mt-1 text-lg font-bold">
                이번 달 누적 작업량
              </h2>
            </div>

            <div className="space-y-2">
              {users
                .map((user) => ({
                  name: user,
                  amount: getMonthlyAmount(
                    user,
                    currentMonthKey
                  ),
                  hasRecord: hasMonthlyRecord(
                    user,
                    currentMonthKey
                  ),
                }))
                .sort((a, b) => {
                  // 기록한 사람을 먼저
                  if (a.hasRecord && !b.hasRecord) return -1;
                  if (!a.hasRecord && b.hasRecord) return 1;

                  // 둘 다 미기록이면 가나다순
                  if (!a.hasRecord && !b.hasRecord) {
                    return a.name.localeCompare(b.name, "ko");
                  }

                  // 둘 다 기록했으면
                  // 1자 이상은 작업량 높은 순
                  // 0자는 가나다순
                  if (a.amount > 0 && b.amount > 0) {
                    return b.amount - a.amount;
                  }

                  if (a.amount > 0 && b.amount === 0) {
                    return -1;
                  }

                  if (a.amount === 0 && b.amount > 0) {
                    return 1;
                  }

                  // 둘 다 0자면 가나다순
                  return a.name.localeCompare(b.name, "ko");
                })
                .map((person) => (
                  <div
                    key={person.name}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                      person.hasRecord
                        ? "bg-[#F8F7F4]"
                        : "bg-[#F8F7F4]"
                    }`}
                  >
                    <span
                      className={
                        person.hasRecord
                          ? "font-medium"
                          : "font-medium text-[#A9A7B2]"
                      }
                    >
                      {person.name}
                    </span>

                    {person.hasRecord && (
                      <span className="font-bold">
                        {person.amount}자
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </section>
        </div>
      </main>
    );
  }

  // 메인 화면
  return (
    <main className="min-h-screen bg-[#F8F7F4] px-5 py-6 text-[#484558]">
      <div className="mx-auto w-full max-w-sm md:max-w-md">

        {/* 헤더 */}
        <header className="mb-7 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.15em] text-[#9F9BCF]">
              OUR WORK
            </p>

            <h1 className="mt-1 text-xl font-bold">
              안녕하세요, {nickname}님 🌿
            </h1>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-full bg-white px-3 py-2 text-xs font-medium text-[#77738B] shadow-sm"
          >
            로그아웃
          </button>
        </header>

        {/* 오늘의 작업량 */}
        <section className="rounded-[28px] bg-white p-5 shadow-[0_8px_30px_rgba(72,69,88,0.07)]">
          <div className="mb-5">
            <p className="text-xs font-semibold tracking-wider text-[#9F9BCF]">
              TODAY
            </p>

            <h2 className="mt-1 text-xl font-bold">
              오늘의 작업량
            </h2>
          </div>

          <div className="relative">
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={todayAmount}
              onChange={(e) =>
                setTodayAmount(e.target.value)
              }
              placeholder="00"
              className="w-full rounded-2xl border-2 border-[#D1CFE6] bg-[#F8F7F4] px-5 py-5 pr-14 text-3xl font-bold text-[#484558] outline-none transition placeholder:text-[#D1CFE6] focus:border-[#9F9BCF]"
            />

            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-bold text-[#77738B]">
              자
            </span>
          </div>

          <button
            onClick={handleRecord}
            className="mt-4 w-full rounded-2xl bg-[#9F9BCF] py-4 text-base font-bold text-white shadow-sm transition active:scale-[0.98]"
          >
            오늘의 작업량 기록하기
          </button>
        </section>

        {/* 선택된 달의 총량 */}
        <section className="mt-5 rounded-[28px] bg-[#E8E6F2] p-6">
          <p className="text-xs font-semibold tracking-wider text-[#77738B]">
            {isCurrentMonth
              ? "THIS MONTH"
              : selectedMonth.toUpperCase()}
          </p>

          <div className="mt-2 flex items-end justify-between">
            <h2 className="text-lg font-bold">
              {getMonthLabel(selectedMonth)} 작업량
            </h2>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">
                {monthlyTotal}
              </span>

              <span className="font-semibold">
                자
              </span>
            </div>
          </div>
        </section>

        {/* 월별 탭 */}
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              작업량 기록
            </h2>

            <span className="text-xs text-[#77738B]">
              {records.length}일
            </span>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {availableMonths.map((monthKey) => (
              <button
                key={monthKey}
                type="button"
                onClick={() =>
                  handleMonthChange(monthKey)
                }
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                  selectedMonth === monthKey
                    ? "bg-[#9F9BCF] text-white"
                    : "bg-white text-[#77738B]"
                }`}
              >
                {getMonthTabLabel(monthKey)}
              </button>
            ))}
          </div>

          {/* 기록 목록 */}
          <div className="space-y-2">
            {Array.from(
              { length: selectedDaysInMonth },
              (_, index) => {
                const day =
                  selectedDaysInMonth - index;

                const dateString =
                  getDateString(day);

                const record = records.find(
                  (item) =>
                    item.date === dateString
                );

                // 현재 달이면 오늘 이후 날짜는 표시하지 않음
                if (
                  isCurrentMonth &&
                  day > currentDay
                ) {
                  return null;
                }

                return (
                  <div
                    key={dateString}
                    className="flex items-center gap-3"
                  >
                    {record &&
                    editingId === record.id ? (
                      <div className="flex flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-4 shadow-[0_3px_15px_rgba(72,69,88,0.04)]">
                        <span className="flex-1 font-medium">
                          {record.date}
                        </span>

                        <div className="relative w-24">
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={editingAmount}
                            onChange={(e) =>
                              setEditingAmount(
                                e.target.value
                              )
                            }
                            autoFocus
                            className="w-full rounded-xl border border-[#D1CFE6] bg-[#F8F7F4] px-3 py-2 pr-7 text-right font-bold outline-none focus:border-[#9F9BCF]"
                          />

                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-[#77738B]">
                            자
                          </span>
                        </div>

                        <button
                          onClick={() =>
                            saveEdit(record.id)
                          }
                          className="shrink-0 rounded-xl bg-[#9F9BCF] px-3 py-2 text-xs font-bold text-white"
                        >
                          저장
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center rounded-2xl bg-white px-4 py-4 shadow-[0_3px_15px_rgba(72,69,88,0.04)]">
                        <span className="flex-1 font-medium">
                          {dateString}
                        </span>

                        {record ? (
                          <button
                            type="button"
                            onClick={() =>
                              startEditing(record)
                            }
                            className="w-20 text-center font-bold"
                            aria-label={`${record.amount}자 수정`}
                          >
                            {record.amount}자
                          </button>
                        ) : (
                          <span className="w-20 text-center font-bold text-[#D98282]">
                            X
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </section>

        {/* 전체 기록 */}
        <button
          onClick={() =>
            setShowAllRecords(true)
          }
          className="mb-6 mt-7 w-full rounded-2xl border-2 border-[#D1CFE6] bg-white py-4 text-sm font-bold text-[#484558] transition active:scale-[0.98]"
        >
          👥 전체 기록 보기
        </button>
      </div>
    </main>
  );
}
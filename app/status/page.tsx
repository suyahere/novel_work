"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type User = {
  id: string;
  nickname: string;
};

type WorkStatus = {
  user_id: string;
  is_working: boolean;
};

export default function StatusPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [statuses, setStatuses] = useState<WorkStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const savedUserId = localStorage.getItem("our-work-user-id");

    if (!savedUserId) {
      setLoading(false);
      return;
    }

    setCurrentUserId(savedUserId);

    const loadData = async () => {
      const [
        { data: userRows, error: userError },
        { data: statusRows, error: statusError },
      ] = await Promise.all([
        supabase
          .from("users")
          .select("id, nickname")
          .order("nickname", { ascending: true }),

        supabase
          .from("work_status")
          .select("user_id, is_working"),
      ]);

      if (userError) {
        console.error("사용자 목록 불러오기 실패:", userError);
        setLoading(false);
        return;
      }

      if (statusError) {
        console.error("작업 상태 불러오기 실패:", statusError);
        setLoading(false);
        return;
      }

      setUsers(userRows ?? []);
      setStatuses(statusRows ?? []);
      setLoading(false);
    };

    loadData();

    const channel = supabase
      .channel("work-status-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_status",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedStatus = payload.old as WorkStatus;

            setStatuses((prev) =>
              prev.filter(
                (status) => status.user_id !== deletedStatus.user_id
              )
            );

            return;
          }

          const newStatus = payload.new as WorkStatus;

          setStatuses((prev) => {
            const exists = prev.some(
              (status) => status.user_id === newStatus.user_id
            );

            if (exists) {
              return prev.map((status) =>
                status.user_id === newStatus.user_id
                  ? newStatus
                  : status
              );
            }

            return [...prev, newStatus];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isWorking = (userId: string) => {
    return (
      statuses.find((status) => status.user_id === userId)
        ?.is_working ?? false
    );
  };

  const currentUser = users.find(
    (user) => user.id === currentUserId
  );

  const toggleWorking = async () => {
    if (!currentUserId || updating) return;

    const currentWorking = isWorking(currentUserId);
    const nextWorking = !currentWorking;

    setUpdating(true);

    const { error } = await supabase
      .from("work_status")
      .upsert(
        {
          user_id: currentUserId,
          is_working: nextWorking,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (error) {
      console.error("작업 상태 변경 실패:", error);
      alert("작업 상태 변경 중 오류가 발생했습니다.");
    }

    setUpdating(false);
  };

  if (!currentUserId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7F4] px-4 text-[#484558]">
        <div className="text-center">
          <p className="mb-4 text-sm">
            로그인이 필요합니다.
          </p>

          <Link
            href="/"
            className="text-sm font-bold text-[#7773B5] hover:underline"
          >
            ← OUR WORK로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const otherUsers = users
    .filter((user) => user.id !== currentUserId)
    .sort((a, b) => {
      const aWorking = isWorking(a.id);
      const bWorking = isWorking(b.id);

      if (aWorking !== bWorking) {
        return aWorking ? -1 : 1;
      }

      return a.nickname.localeCompare(b.nickname, "ko");
    });

  return (
    <main className="min-h-screen bg-[#F8F7F4] px-4 py-8 text-[#484558]">
      <div className="mx-auto w-full max-w-2xl">
        {/* 상단 */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-[#77738B] hover:underline"
          >
            ← OUR WORK
          </Link>

          <h1 className="text-xl font-bold">
            작업 현황
          </h1>

          <div className="w-16" />
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white py-10 text-center text-sm text-[#77738B] shadow-sm">
            불러오는 중...
          </div>
        ) : (
          <>
            {/* 내 작업 상태 */}
            <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold">
                    {currentUser?.nickname}
                  </span>

                  {isWorking(currentUserId) && (
                    <span className="rounded-full bg-[#E8E6F2] px-2.5 py-1 text-xs font-bold text-[#7773B5]">
                      작업중
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={toggleWorking}
                  disabled={updating}
                  className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition active:scale-95 ${
                    isWorking(currentUserId)
                      ? "bg-[#D98282]"
                      : "bg-[#9F9BCF]"
                  }`}
                >
                  {isWorking(currentUserId)
                    ? "종료"
                    : "작업중"}
                </button>
              </div>
            </section>

            {/* 다른 사용자 */}
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {otherUsers.map((user) => {
                  const working = isWorking(user.id);

                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-2xl bg-[#F8F7F4] px-4 py-4"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${
                            working
                              ? "text-[#484558]"
                              : "text-[#AAA7B5]"
                          }`}
                        >
                          {user.nickname}
                        </span>

                        {working && (
                          <span className="rounded-full bg-[#E8E6F2] px-2.5 py-1 text-xs font-bold text-[#7773B5]">
                            작업중
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
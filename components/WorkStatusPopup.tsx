"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type User = {
  id: string;
  nickname: string;
};

type WorkStatus = {
  user_id: string;
  is_working: boolean;
};

export default function WorkStatusPopup() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [statuses, setStatuses] = useState<WorkStatus[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUserId = localStorage.getItem("our-work-user-id");

    if (!savedUserId) return;

    setCurrentUserId(savedUserId);

    const loadData = async () => {
      const [{ data: userRows, error: userError }, { data: statusRows, error: statusError }] =
        await Promise.all([
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
        return;
      }

      if (statusError) {
        console.error("작업 상태 불러오기 실패:", statusError);
        return;
      }

      setUsers(userRows ?? []);
      setStatuses(statusRows ?? []);
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
            setStatuses((prev) =>
              prev.filter(
                (status) =>
                  status.user_id !== (payload.old as WorkStatus).user_id
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

  const getWorkingStatus = (userId: string) => {
    return (
      statuses.find((status) => status.user_id === userId)?.is_working ??
      false
    );
  };

  const toggleWorking = async () => {
    if (!currentUserId || loading) return;

    setLoading(true);

    const currentStatus = getWorkingStatus(currentUserId);
    const nextStatus = !currentStatus;

    const { error } = await supabase
      .from("work_status")
      .upsert(
        {
          user_id: currentUserId,
          is_working: nextStatus,
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

    setLoading(false);
  };

  if (!currentUserId) {
    return null;
  }

  const workingUsers = users.filter((user) =>
    getWorkingStatus(user.id)
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-[#9F9BCF] px-5 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95"
      >
        📝 작업 현황
        {workingUsers.length > 0 && (
          <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-[#9F9BCF]">
            {workingUsers.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#484558]">
                작업 현황
              </h2>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xl text-[#AAA7B5]"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {users.map((user) => {
                const isWorking = getWorkingStatus(user.id);
                const isMe = user.id === currentUserId;

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-2xl bg-[#F8F7F4] px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#484558]">
                        {user.nickname}
                      </span>

                      {isWorking && (
                        <span className="rounded-full bg-[#E8E6F2] px-2 py-1 text-xs font-bold text-[#7773B5]">
                          작업중
                        </span>
                      )}
                    </div>

                    {isMe && (
                      <button
                        type="button"
                        onClick={toggleWorking}
                        disabled={loading}
                        className={`rounded-xl px-3 py-2 text-xs font-bold transition active:scale-95 ${
                          isWorking
                            ? "bg-[#D98282] text-white"
                            : "bg-[#9F9BCF] text-white"
                        }`}
                      >
                        {isWorking ? "종료" : "작업중"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

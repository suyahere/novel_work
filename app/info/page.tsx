"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type InfoPost = {
  id: number;
  nickname: string;
  content: string;
  created_at: string;
};

export default function InfoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [posts, setPosts] = useState<InfoPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUserId = localStorage.getItem("our-work-user-id");

    if (savedUserId) {
      setUserId(savedUserId);
    }

    const loadPosts = async () => {
      const { data, error } = await supabase
        .from("info_posts")
        .select("id, nickname, content, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("정보 게시글 불러오기 실패:", error);
      } else {
        setPosts(data ?? []);
      }

      setLoading(false);
    };

    loadPosts();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const loadUser = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("nickname")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        setNickname(data.nickname);
      }
    };

    loadUser();
  }, [userId]);

  const handleSubmit = async () => {
    const trimmedContent = content.trim();

    if (!userId || !nickname) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!trimmedContent) {
      alert("내용을 입력해주세요.");
      return;
    }

    if (trimmedContent.length > 300) {
      alert("내용은 300자까지 입력할 수 있습니다.");
      return;
    }

    const { data, error } = await supabase
      .from("info_posts")
      .insert({
        user_id: userId,
        nickname,
        content: trimmedContent,
      })
      .select("id, nickname, content, created_at")
      .single();

    if (error) {
      console.error("정보 게시글 저장 실패:", error);
      alert("글 저장 중 오류가 발생했습니다.");
      return;
    }

    setPosts((prev) => [data, ...prev]);
    setContent("");
  };

  const renderContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (/^https?:\/\/[^\s]+$/.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-[#7773B5] underline"
          >
            {part}
          </a>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  return (
    <main className="min-h-screen bg-[#F8F7F4] px-4 py-8 text-[#484558]">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-[#77738B] hover:underline"
          >
            ← OUR WORK
          </Link>

          <h1 className="text-xl font-bold">정보</h1>

          <div className="w-16" />
        </div>

        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={300}
            placeholder="함께 공유할 정보를 적어주세요."
            className="min-h-28 w-full resize-none rounded-xl border-0 bg-[#F8F7F4] p-4 text-sm outline-none placeholder:text-[#AAA7B5]"
          />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-[#77738B]">
              {content.length} / 300
            </span>

            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-xl bg-[#9F9BCF] px-5 py-2 text-sm font-bold text-white transition hover:opacity-90"
            >
              저장
            </button>
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-[#77738B]">
              정보를 불러오는 중...
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-[#77738B]">
              아직 등록된 정보가 없어요.
            </div>
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-bold">{post.nickname}</span>

                  <span className="text-xs text-[#AAA7B5]">
                    {new Date(post.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>

                <div className="whitespace-pre-wrap break-words text-sm leading-6">
                  {renderContent(post.content)}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  is_flagged: boolean;
  flag_reason: string | null;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          setMessages((prev) => [
            payload.new as Message,
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchMessages() {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', {
        ascending: false,
      })
      .limit(100);

    if (onlyFlagged) {
      query = query.eq('is_flagged', true);
    }

    if (search.trim()) {
      query = query.ilike(
        'message',
        `%${search}%`
      );
    }

    const { data, error } = await query;

    if (!error && data) {
      setMessages(data);
    }
  }

  async function shadowBan(email: string | null) {
    if (!email) {
      alert('Este mensaje no tiene email de remitente.');
      return;
    }

    await supabase
      .from('profiles')
      .update({
        shadow_banned: true,
      })
      .eq('email', email);

    alert('User shadowbanned');
  }

  async function banUser(email: string | null) {
    if (!email) {
      alert('Este mensaje no tiene email de remitente.');
      return;
    }

    await supabase.from('banned_users').insert({
      email,
      reason: 'Admin moderation',
      is_permanent: true,
    });

    alert('User banned');
  }

  useEffect(() => {
    fetchMessages();
  }, [onlyFlagged]);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-4xl font-bold">
          Messages Moderation
        </h1>

        <div className="flex gap-3">
          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search messages..."
            className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 outline-none"
          />

          <button
            onClick={fetchMessages}
            className="bg-pink-600 hover:bg-pink-700 px-4 py-2 rounded-xl"
          >
            Search
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <input
          type="checkbox"
          checked={onlyFlagged}
          onChange={() =>
            setOnlyFlagged(!onlyFlagged)
          }
        />

        <span>Only flagged messages</span>
      </div>

      <div className="space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-2xl border p-5 ${
              msg.is_flagged
                ? 'border-red-500 bg-red-500/10'
                : 'border-zinc-800 bg-zinc-900'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-zinc-400 text-sm">
                  Sender
                </p>

                <p className="font-mono text-xs">
                  {msg.sender_id}
                </p>
              </div>

              <div>
                <p className="text-zinc-400 text-sm">
                  Receiver
                </p>

                <p className="font-mono text-xs">
                  {msg.receiver_id}
                </p>
              </div>

              <div>
                <p className="text-zinc-400 text-sm">
                  Time
                </p>

                <p className="text-xs">
                  {new Date(
                    msg.created_at
                  ).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-zinc-400 text-sm mb-1">
                Message
              </p>

              <p className="text-lg break-words">
                {msg.message}
              </p>
            </div>

            {msg.is_flagged && (
              <div className="mb-4">
                <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">
                  {msg.flag_reason}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() =>
                  banUser(msg.sender_id)
                }
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl"
              >
                Ban User
              </button>

              <button
                onClick={() =>
                  shadowBan(msg.sender_id)
                }
                className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-xl"
              >
                Shadowban
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { useAuth } from "@/app/providers/AuthProvider";
import { showAppAlert } from "@/src/client/notify";

type ChatMessage = {
  id: string;
  senderId: string;
  senderRole: "customer" | "professional";
  text: string;
  createdAt: string;
};

const POLL_INTERVAL_MS = 8_000;

// Chat interno por solicitud, habilitado solo una vez que hay match
// (presupuesto aceptado — mismo chequeo que hace el servidor). Existe para
// que cliente y profesional no tengan que pasarse teléfono/email y seguir
// hablando fuera de Fiakto, donde no queda ningún registro: el servidor ya
// oculta contactos que se intenten pegar (ver redactContactInfo).
export function RequestChat({ requestId }: { requestId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const knownCountRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      if (!user) return;
      const token = await user.getIdToken();
      const response = await fetch(`/api/requests/${requestId}/messages`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = (await response.json()) as { messages: ChatMessage[] };
      if (data.messages.length > knownCountRef.current && knownCountRef.current > 0) {
        showAppAlert("Fiakto", "Tenés un mensaje nuevo.");
      }
      knownCountRef.current = data.messages.length;
      setMessages(data.messages);
    }

    void load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, requestId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!user || !text.trim()) return;
    setSending(true);
    setError("");
    setNotice("");
    const token = await user.getIdToken();
    const response = await fetch(`/api/requests/${requestId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setSending(false);
    if (!response.ok) {
      setError("No pudimos enviar el mensaje. Probá de nuevo.");
      return;
    }
    const data = (await response.json()) as { message: ChatMessage; redacted: boolean };
    setMessages((current) => [...(current ?? []), data.message]);
    knownCountRef.current += 1;
    setText("");
    if (data.redacted) {
      setNotice("Ocultamos un teléfono/email de tu mensaje — coordiná todo por este chat.");
    }
  }

  if (!user) return null;

  return (
    <div className="mt-8 border-t border-[#181713]/15 pt-6">
      <h2 className="mb-1 text-lg font-semibold">Chat</h2>
      <p className="mb-3 text-xs text-[#777166]">
        Todo lo que hables acá queda registrado en Fiakto. Evitá compartir teléfono o email — se
        oculta automáticamente.
      </p>

      <div
        ref={listRef}
        className="mb-3 flex max-h-80 flex-col gap-2 overflow-y-auto border border-[#181713]/10 bg-[#fffdf8] p-3"
      >
        {messages === null && <p className="text-sm text-[#777166]">Cargando…</p>}
        {messages !== null && messages.length === 0 && (
          <p className="text-sm text-[#777166]">Todavía no hay mensajes. Escribí el primero.</p>
        )}
        {messages?.map((message) => {
          const isOwn = message.senderId === user.uid;
          return (
            <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isOwn ? "bg-[#dc4b2f] text-white" : "bg-[#181713]/5 text-[#181713]"
                }`}
              >
                {message.text}
              </p>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          aria-label="Escribir un mensaje"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={2000}
          placeholder="Escribí un mensaje…"
          className="h-11 flex-1 border border-[#181713]/30 bg-transparent px-3 text-sm outline-none focus:border-[#dc4b2f]"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="bg-[#181713] px-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "…" : "Enviar"}
        </button>
      </form>
      {notice && <p className="mt-2 text-xs font-semibold text-[#777166]">{notice}</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-[#b52f1c]">
          {error}
        </p>
      )}
    </div>
  );
}

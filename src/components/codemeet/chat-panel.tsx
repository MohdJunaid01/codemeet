"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';
import { techSupport } from "@/ai/flows/tech-support";
import { useToast } from "@/hooks/use-toast";
import { ChatMessage } from "./chat-message";

export type Message = {
    id: string;
    name: string;
    text: string;
    isHelp?: boolean;
    isAIMessage?: boolean;
};
  
type ChatPanelProps = {
    isOpen: boolean;
    onClose: () => void;
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    userName: string;
};

export function ChatPanel({ isOpen, onClose, messages, setMessages, userName }: ChatPanelProps) {
    const [newMessage, setNewMessage] = useState("");
    const [loadingAI, setLoadingAI] = useState(false);
    const { toast } = useToast();

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const isHelpRequest = newMessage.trim().startsWith("@help");

        const userMessage: Message = {
            id: uuidv4(),
            name: userName,
            text: newMessage,
            isHelp: isHelpRequest,
        };

        setMessages(prev => [...prev, userMessage]);
        setNewMessage("");

        if (isHelpRequest) {
            setLoadingAI(true);
            try {
                const issue = newMessage.replace(/^@help\s*/, '');

                const history = messages
                    .filter(m => (m.isHelp && m.name === userName) || (m.isAIMessage))
                    .map(m => ({
                        role: m.isAIMessage ? 'model' as const : 'user' as const,
                        content: m.text.replace(/^@help\s*/, ''),
                    }));

                const result = await techSupport({ issue, history });
                const aiResponse: Message = {
                    id: uuidv4(),
                    name: "AI Support",
                    text: result.response,
                    isAIMessage: true
                };
                setMessages(prev => [...prev, aiResponse]);
            } catch (error) {
                console.error("Error with AI support:", error);
                toast({
                    variant: "destructive",
                    title: "AI Support Error",
                    description: "Could not get a response from the AI assistant."
                });
            } finally {
                setLoadingAI(false);
            }
        }
    }

  return (
    <aside
      className={cn(
        "w-80 border-l border-border bg-card text-card-foreground flex-col h-full transition-all duration-300 ease-in-out",
        isOpen ? "flex" : "hidden"
      )}
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-bold">Chat</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
            {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} currentUserName={userName} />
            ))}
            {loadingAI && (
                <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>AI Support is typing...</span>
                </div>
            )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-border">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type @help or a message..."
            autoComplete="off"
            disabled={loadingAI}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || loadingAI}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}

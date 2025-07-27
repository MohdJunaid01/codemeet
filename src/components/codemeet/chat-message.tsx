"use client";

import { cn } from "@/lib/utils";
import type { Message } from "./chat-panel";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Bot, User } from "lucide-react";

type ChatMessageProps = {
    message: Message;
    currentUserName: string;
};

export function ChatMessage({ message, currentUserName }: ChatMessageProps) {
    const isCurrentUser = message.name === currentUserName;
    const isAIMessage = message.isAIMessage;

    if (message.isHelp) {
        return (
            <div className="text-center text-xs text-muted-foreground italic my-2 p-2 bg-muted/50 rounded-lg">
                <p>
                    <span className="font-bold">You</span> asked for help: "{message.text.replace(/^@help\s*/, '')}"
                </p>
                <p>(This message is only visible to you)</p>
            </div>
        )
    }

  return (
    <div
      className={cn(
        "flex items-start gap-3 my-4",
        isCurrentUser && "justify-end"
      )}
    >
        {!isCurrentUser && (
             <Avatar className="h-8 w-8">
                {isAIMessage ? <Bot className="h-full w-full p-1.5" /> :  <User className="h-full w-full p-1.5" />}
            </Avatar>
        )}
      <div
        className={cn(
          "p-3 rounded-lg max-w-xs lg:max-w-md",
          isCurrentUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
          isAIMessage && "bg-accent/50 border border-accent"
        )}
      >
        {!isCurrentUser && (
            <p className="text-xs font-bold mb-1">
                {message.name}
            </p>
        )}
        <p className="text-sm">{message.text}</p>
      </div>
      {isCurrentUser && (
         <Avatar className="h-8 w-8">
            <User className="h-full w-full p-1.5" />
        </Avatar>
      )}
    </div>
  );
}
